import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type TypedResponse,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import PaymentForm from "~/components/payment/PaymentForm";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { Database } from "~/types/database.types";
import {
  formatMoney,
  toCents,
  serializeMoney,
  deserializeMoney,
  type Money,
  type MoneyJSON,
  ZERO_MONEY,
  addMoney,
} from "~/utils/money";
import { moneyFromRow } from "~/utils/database-money";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
  updatePaymentStatus,
} from "~/utils/supabase.server";
import { getPaymentProvider } from "~/services/payments/index.server";
import type { ClientRenderConfig, PaymentProviderId } from '~/services/payments/types.server';
import { getFamilyPaymentOptions, type EnrollmentPaymentOption } from "~/services/enrollment-payment.server";

type PaymentColumns = Database["public"]["Tables"]["payments"]["Row"];
type PaymentStudentRow = Database["public"]["Tables"]["payment_students"]["Row"];
type FamilyRow = Database["public"]["Tables"]["families"]["Row"];
type PaymentTaxRow = Database["public"]["Tables"]["payment_taxes"]["Row"];
type TaxRateRow = Database["public"]["Tables"]["tax_rates"]["Row"];

type PaymentTaxWithDescription = Omit<Pick<PaymentTaxRow, "tax_name_snapshot" | "tax_amount">, "tax_amount"> & {
  tax_amount: Money;
  tax_rates: Pick<TaxRateRow, "description"> | null;
};

type PaymentWithDetails = Omit<PaymentColumns, "amount" | "tax_amount" | "subtotal_amount" | "total_amount"> & {
  subtotal_amount: Money;
  total_amount: Money;
  tax_amount: Money;
  family: Pick<FamilyRow, "name" | "email" | "postal_code"> | null;
  payment_taxes: PaymentTaxWithDescription[];
  payment_students: Array<Pick<PaymentStudentRow, "student_id">>;
  individualSessionUnitAmountCents?: number | null;
  individualSessionQuantity?: number | null;
};

type SerializedPaymentTaxWithDescription = Omit<PaymentTaxWithDescription, "tax_amount"> & {
  tax_amount: MoneyJSON;
};

type SerializedPaymentWithDetails = Omit<PaymentWithDetails, "subtotal_amount" | "total_amount" | "tax_amount" | "payment_taxes"> & {
  subtotal_amount: MoneyJSON;
  total_amount: MoneyJSON;
  tax_amount: MoneyJSON;
  payment_taxes: SerializedPaymentTaxWithDescription[];
};

type LoaderData = {
  payment?: SerializedPaymentWithDetails;
  error?: string;
  paymentProviderId: PaymentProviderId;
  providerConfig: ClientRenderConfig;
  providerCapabilities: {
    requiresClientSecret: boolean;
    requiresCheckoutUrl: boolean;
  };
};

type RawPaymentTaxWithDescription = Omit<PaymentTaxWithDescription, "tax_amount"> & {
  tax_amount: number;
};

type RawPaymentWithDetails = Omit<PaymentWithDetails, "subtotal_amount" | "total_amount" | "tax_amount" | "payment_taxes"> & {
  subtotal_amount: number;
  total_amount: number;
  payment_taxes: RawPaymentTaxWithDescription[];
};

type LoaderPaymentQuery = RawPaymentWithDetails | null;

type LoaderPaymentResult = {
  data: LoaderPaymentQuery;
  error: { message: string } | null;
};

function serializePayment(payment: PaymentWithDetails): SerializedPaymentWithDetails {
  return {
    ...payment,
    subtotal_amount: serializeMoney(payment.subtotal_amount),
    total_amount: serializeMoney(payment.total_amount),
    tax_amount: serializeMoney(payment.tax_amount),
    payment_taxes: payment.payment_taxes.map((tax) => ({
      ...tax,
      tax_amount: serializeMoney(tax.tax_amount),
    })),
  };
}

function deserializePayment(payment: SerializedPaymentWithDetails): PaymentWithDetails {
  return {
    ...payment,
    subtotal_amount: deserializeMoney(payment.subtotal_amount),
    total_amount: deserializeMoney(payment.total_amount),
    tax_amount: deserializeMoney(payment.tax_amount),
    payment_taxes: payment.payment_taxes.map((tax) => ({
      ...tax,
      tax_amount: deserializeMoney(tax.tax_amount),
    })),
  };
}

type ActionSuccessResponse = {
  clientSecret: string;
  supabasePaymentId: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  provider: PaymentProviderId;
  error?: never;
};

type ActionErrorResponse = {
  clientSecret?: never;
  supabasePaymentId?: never;
  subtotalAmount?: never;
  taxAmount?: never;
  totalAmount?: never;
  provider?: PaymentProviderId;
  error: string;
};

type ApiActionResponse = ActionSuccessResponse | ActionErrorResponse;

function getPaymentIntentFormData(payment: PaymentWithDetails) {
  const formData = new FormData();
  formData.append("familyId", payment.family_id);
  formData.append("familyName", payment.family?.name ?? "Unknown Family");
  formData.append("supabasePaymentId", payment.id);
  formData.append("subtotalAmount", toCents(payment.subtotal_amount).toString());
  formData.append("totalAmount", toCents(payment.total_amount).toString());

  let paymentOption:
    | "monthly"
    | "yearly"
    | "individual"
    | "store"
    | "event"
    | null = null;
  let priceId: string | null = null;
  let quantity: string | null = null;

  switch (payment.type) {
    case "monthly_group":
      paymentOption = "monthly";
      break;
    case "yearly_group":
      paymentOption = "yearly";
      priceId = "yearly"; // Provider-neutral price identifier
      break;
    case "individual_session":
      paymentOption = "individual";
      priceId = "oneOnOneSession"; // Provider-neutral price identifier
      if (payment.individualSessionQuantity && payment.individualSessionQuantity > 0) {
        quantity = payment.individualSessionQuantity.toString();
      } else if (payment.individualSessionUnitAmountCents && payment.individualSessionUnitAmountCents > 0) {
        const subtotalCents = toCents(payment.subtotal_amount);
        if (subtotalCents > 0) {
          const calculatedQuantity = Math.round(
            subtotalCents / payment.individualSessionUnitAmountCents,
          );
          quantity = calculatedQuantity.toString();
        }
      }
      break;
    case "store_purchase":
      paymentOption = "store";
      break;
    case "event_registration":
      paymentOption = "event";
      break;
    default:
      return { formData: null, error: "Unsupported payment type for online checkout." };
  }

  if (!paymentOption) {
    return {
      formData: null,
      error: "Unable to determine payment configuration. Please contact support.",
    };
  }

  formData.append("paymentOption", paymentOption);

  const studentIds = payment.payment_students?.map((ps) => ps.student_id) ?? [];
  if (studentIds.length > 0) {
    formData.append("studentIds", studentIds.join(","));
  }

  if ((paymentOption === "yearly" || paymentOption === "individual") && !priceId) {
    return {
      formData: null,
      error: `Configuration error: Price ID missing for ${paymentOption}.`,
    };
  }
  if (priceId) {
    formData.append("priceId", priceId);
  }

  if (paymentOption === "individual" && !quantity) {
    return {
      formData: null,
      error: "Configuration error: Quantity missing for individual session.",
    };
  }
  if (quantity) {
    formData.append("quantity", quantity);
  }

  if (paymentOption === "store") {
    if (!payment.order_id) {
      return {
        formData: null,
        error: "Configuration error: Cannot process store payment without linked order.",
      };
    }
    formData.append("orderId", payment.order_id);
  }

  return { formData, error: null } as const;
}

export async function loader({ request, params }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
  const provider = getPaymentProvider();
  const paymentProviderId = provider.id as PaymentProviderId;
  const renderConfig = provider.getClientRenderConfig();

  const providerCapabilities = {
    requiresClientSecret: provider.requiresClientSecret(),
    requiresCheckoutUrl: provider.requiresCheckoutUrl(),
  };

  if (!provider.isConfigured()) {
    return json<LoaderData>(
      {
        error: "Payment gateway configuration error.",
        paymentProviderId,
        providerConfig: renderConfig,
        providerCapabilities,
      },
      { status: 500 },
    );
  }

  const paymentId = params.paymentId;
  if (!paymentId) {
    return json<LoaderData>(
      {
        error: "Payment ID is required",
        paymentProviderId,
        providerConfig: renderConfig,
        providerCapabilities,
      },
      { status: 400 },
    );
  }

  if (paymentId === "event-payment-success") {
    return redirect("/events");
  }

  const { response } = getSupabaseServerClient(request);
  const supabaseAdmin = getSupabaseAdminClient();

  const { data: payment, error }: LoaderPaymentResult = await supabaseAdmin
    .from("payments")
    .select(
      `
        id,
        family_id,
        subtotal_amount,
        total_amount,
        payment_date,
        payment_method,
        status,
        stripe_session_id, 
        payment_intent_id,
        receipt_url,
        notes,
        type,
        order_id,
        family:family_id (name, email, postal_code),
        payment_students (student_id),
        payment_taxes (
          tax_name_snapshot,
          tax_amount,
          tax_rates (description)
        )
      `,
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    return json<LoaderData>(
      {
        error: `Failed to load payment details: ${error.message}`,
        paymentProviderId,
        providerConfig: renderConfig,
        providerCapabilities,
      },
      { status: 500, headers: response.headers },
    );
  }

  if (!payment) {
    return json<LoaderData>(
      {
        error: "Payment record not found.",
        paymentProviderId,
        providerConfig: renderConfig,
        providerCapabilities,
      },
      { status: 404, headers: response.headers },
    );
  }

  let individualSessionUnitAmountCents: number | null = null;
  let individualSessionQuantity: number | null = null;

  if (payment.type === "individual_session") {
    try {
      const familyPaymentOptions = await getFamilyPaymentOptions(payment.family_id, supabaseAdmin);
      const pricingByStudent = new Map<string, EnrollmentPaymentOption[]>(
        familyPaymentOptions.map(option => [option.studentId, option.enrollments]),
      );
      const studentIds = payment.payment_students?.map((ps) => ps.student_id) ?? [];

      const resolveIndividualSessionAmountCents = (): number | null => {
        for (const studentId of studentIds) {
          const enrollments = pricingByStudent.get(studentId) ?? [];
          const match = enrollments.find((enrollment) => enrollment.individualSessionAmount);
          if (match?.individualSessionAmount) {
            return toCents(match.individualSessionAmount);
          }
        }
        for (const option of familyPaymentOptions) {
          const match = option.enrollments.find((enrollment) => enrollment.individualSessionAmount);
          if (match?.individualSessionAmount) {
            return toCents(match.individualSessionAmount);
          }
        }
        return null;
      };

      const unitAmountCents = resolveIndividualSessionAmountCents();
      if (unitAmountCents && unitAmountCents > 0) {
        individualSessionUnitAmountCents = unitAmountCents;
        if (payment.subtotal_amount) {
          individualSessionQuantity = Math.round(payment.subtotal_amount / unitAmountCents);
        }
      }
    } catch (pricingError) {
      console.error('[Payment loader] Failed to derive individual session pricing:', pricingError);
    }
  }

  const paymentTaxesWithMoney: PaymentTaxWithDescription[] = (payment.payment_taxes ?? []).map((tax) => ({
    ...tax,
    tax_amount: moneyFromRow("payment_taxes", "tax_amount", tax),
  }));

  const subtotalMoney = moneyFromRow("payments", "subtotal_amount", payment);
  const totalMoney = moneyFromRow("payments", "total_amount", payment);
  const totalTaxMoney = paymentTaxesWithMoney.reduce<Money>(
    (acc, tax) => addMoney(acc, tax.tax_amount),
    ZERO_MONEY,
  );

  const paymentWithDerived: PaymentWithDetails = {
    ...payment,
    subtotal_amount: subtotalMoney,
    total_amount: totalMoney,
    tax_amount: totalTaxMoney,
    payment_taxes: paymentTaxesWithMoney,
    payment_students: payment.payment_students ?? [],
    individualSessionUnitAmountCents,
    individualSessionQuantity,
  };

  const paymentIntentId = paymentWithDerived.payment_intent_id; // Generic payment intent ID for all providers
  if (paymentWithDerived.status === "pending" && paymentIntentId) {
    try {
      const providerIntent = await provider.retrievePaymentIntent(
        paymentIntentId,
        { includeLatestCharge: true, includePaymentMethod: true },
      );

      if (providerIntent.status === "succeeded") {
        await updatePaymentStatus(
          paymentWithDerived.id,
          "succeeded",
          providerIntent.receiptUrl ?? null,
          providerIntent.paymentMethodType ?? null,
          providerIntent.id,
        );
        throw redirect(
          `/payment/success?payment_intent=${providerIntent.id}`,
          { headers: response.headers },
        );
      }

      if (providerIntent.status === "canceled") {
        await updatePaymentStatus(paymentWithDerived.id, "failed", null, providerIntent.paymentMethodType ?? null, providerIntent.id);
      }
    } catch (providerError) {
      console.error(
        `[Payment loader] Failed to reconcile provider intent ${paymentIntentId}:`,
        providerError,
      );
    }
  }

  return json<LoaderData>(
    {
      payment: serializePayment(paymentWithDerived),
      paymentProviderId,
      providerConfig: renderConfig,
      providerCapabilities,
    },
    { headers: response.headers },
  );
}


function getPaymentProductDescription(
  type: Database["public"]["Enums"]["payment_type_enum"] | undefined | null,
) {
  switch (type) {
    case "monthly_group":
      return "Monthly Group Class Fee";
    case "yearly_group":
      return "Yearly Group Class Fee";
    case "individual_session":
      return "Individual Session(s)";
    case "store_purchase":
      return "Store Item Purchase";
    case "event_registration":
      return "Event Registration Fee";
    case "other":
      return "Other Payment";
    default:
      return "Unknown Item";
  }
}

type ProviderAwareState = {
  clientSecret: string | null;
  squareCheckoutUrl: string | null;
  fetcherError: string | null;
};

export default function PaymentPage() {
  const {
    payment: serializedPayment,
    error: loaderError,
    providerConfig,
    providerCapabilities,
  } = useLoaderData<LoaderData>();
  const payment = useMemo(
    () => (serializedPayment ? deserializePayment(serializedPayment) : undefined),
    [serializedPayment],
  );

  const paymentIntentFetcher = useFetcher<ApiActionResponse>();

  const [state, setState] = useState<ProviderAwareState>({
    clientSecret: null,
    squareCheckoutUrl: null,
    fetcherError: null,
  });

  // Memoize the onError callback to prevent unnecessary re-renders
  const handleError = useCallback((message: string) => {
    setState((prev) => ({ ...prev, fetcherError: message || prev.fetcherError }));
  }, []);

  const requiresClientSecret = providerCapabilities.requiresClientSecret;
  const requiresCheckoutUrl = providerCapabilities.requiresCheckoutUrl;

  const groupedTaxes = useMemo(() => {
    if (!payment?.payment_taxes) return [] as Array<{ description: string; amount: Money }>;
    const taxMap = new Map<string, Money>();
    payment.payment_taxes.forEach((tax) => {
      const key = tax.tax_rates?.description || tax.tax_name_snapshot || "Unknown Tax";
      const currentAmount = taxMap.get(key) ?? ZERO_MONEY;
      taxMap.set(key, addMoney(currentAmount, tax.tax_amount));
    });
    return Array.from(taxMap.entries()).map(([description, amount]) => ({ description, amount }));
  }, [payment?.payment_taxes]);


  const submitPaymentIntent = useCallback(() => {
    if (!payment) return;
    if (!(requiresClientSecret || requiresCheckoutUrl)) return;
    if (paymentIntentFetcher.state !== "idle") return;
    if (paymentIntentFetcher.data) return;
    if (requiresClientSecret && state.clientSecret) return;
    if (requiresCheckoutUrl && state.squareCheckoutUrl) return;

    const { formData, error } = getPaymentIntentFormData(payment);
    if (error || !formData) {
      setState((prev) => ({ ...prev, fetcherError: error ?? "Unable to prepare payment." }));
      return;
    }
    paymentIntentFetcher.submit(formData, {
      method: "post",
      action: "/api/create-payment-intent",
    });
  }, [requiresCheckoutUrl, requiresClientSecret, payment, paymentIntentFetcher, state.clientSecret, state.squareCheckoutUrl]);

  useEffect(() => {
    if (!payment) return;
    submitPaymentIntent();
  }, [payment, submitPaymentIntent]);

  useEffect(() => {
    const data = paymentIntentFetcher.data;
    if (!data) return;

    if ("error" in data && data.error) {
      setState((prev) => ({ ...prev, fetcherError: data.error }));
      return;
    }

    if ("clientSecret" in data) {
      // Provider response processing - data.provider indicates the actual response format
      if (requiresClientSecret && data.provider === providerConfig.provider) {
        setState({ clientSecret: data.clientSecret ?? null, squareCheckoutUrl: null, fetcherError: null });
      } else if (requiresCheckoutUrl && data.provider === providerConfig.provider) {
        setState({ clientSecret: null, squareCheckoutUrl: data.clientSecret ?? null, fetcherError: null });
      }
    }
  }, [paymentIntentFetcher.data, requiresClientSecret, requiresCheckoutUrl, providerConfig.provider]);


  if (loaderError) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <Alert variant="destructive">
          <AlertTitle>Error Loading Payment</AlertTitle>
          <AlertDescription>{loaderError}</AlertDescription>
        </Alert>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Payment data is unexpectedly missing.</AlertDescription>
        </Alert>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  const initializationMessage =
    paymentIntentFetcher.state === "submitting"
      ? "Initializing payment..."
      : state.fetcherError ?? null;

  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
        Complete Your Payment
      </h1>

      {payment.status === "failed" && (
        <Alert variant="warning" className="mb-4">
          <AlertTitle>Previous Attempt Failed</AlertTitle>
          <AlertDescription>
            Your previous attempt to complete this payment failed. Please check your details and try again.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded text-left">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Family:</span> {payment.family?.name ?? "N/A"}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Subtotal:</span> {formatMoney(payment.subtotal_amount)}
          {payment.discount_amount && payment.discount_amount > 0 && (
            <span className="text-green-600 dark:text-green-400 ml-2">(discount applied)</span>
          )}
        </p>
        {groupedTaxes.map((tax) => (
          <p key={tax.description} className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">{tax.description}:</span> {formatMoney(tax.amount)}
          </p>
        ))}
        <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-2 border-t pt-2 dark:border-gray-600">
          <span className="font-semibold">Total Amount:</span> {formatMoney(payment.total_amount)}
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Product:</span> {getPaymentProductDescription(payment.type)}
        </p>
      </div>

      {initializationMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Initialization</AlertTitle>
          <AlertDescription>{initializationMessage}</AlertDescription>
        </Alert>
      )}

      <PaymentForm
        payment={payment}
        providerConfig={providerConfig}
        clientSecret={state.clientSecret}
        providerData={{ squareCheckoutUrl: state.squareCheckoutUrl }}
        onError={handleError}
      />

      <div className="mt-6 text-center">
        <a href="/family" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">
          Cancel and return to Family Portal
        </a>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("[PaymentPage ErrorBoundary]", error);
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Alert variant="destructive">
        <AlertTitle>Payment Page Error</AlertTitle>
        <AlertDescription>
          Sorry, something went wrong while loading the payment page. Please try again later or contact support.
        </AlertDescription>
      </Alert>
      <Link to="/" className="mt-4 inline-block text-blue-600 hover:underline">
        Return Home
      </Link>
    </div>
  );
}
