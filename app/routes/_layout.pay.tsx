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
  type ReactNode,
} from "react";
import PaymentForm from "~/components/payment/PaymentForm";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import type { Database } from "~/types/database.types";
import {
  formatMoney,
  toCents,
  toCentsFromUnknown,
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
import { ArrowLeft, CreditCard, Receipt, ShieldCheck } from "lucide-react";

type PaymentColumns = Database["public"]["Tables"]["payments"]["Row"];
type PaymentStudentRow = Database["public"]["Tables"]["payment_students"]["Row"];
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
  family: { name?: string; email?: string | undefined; postal_code?: string | undefined } | null;
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
  const subtotalCents = toCentsFromUnknown(payment.subtotal_amount, { numberUnit: "cents" });
  const totalCents = toCentsFromUnknown(payment.total_amount, { numberUnit: "cents" });

  const formData = new FormData();
  formData.append("familyId", payment.family_id);
  formData.append("familyName", payment.family?.name ?? "Unknown Family");
  formData.append("supabasePaymentId", payment.id);
  formData.append("subtotalAmount", subtotalCents.toString());
  formData.append("totalAmount", totalCents.toString());

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
    family: payment.family ? {
      name: payment.family.name ?? undefined,
      email: payment.family.email ?? undefined,
      postal_code: payment.family.postal_code ?? undefined,
    } : null,
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
        await updatePaymentStatus({
          paymentId: paymentWithDerived.id,
          status: "succeeded",
          providerReceiptUrl: providerIntent.receiptUrl ?? null,
          paymentMethod: providerIntent.paymentMethodType ?? null,
          paymentIntentId: providerIntent.id,
        });
        throw redirect(
          `/payment/success?payment_intent=${providerIntent.id}`,
          { headers: response.headers },
        );
      }

      if (providerIntent.status === "cancelled") {
        await updatePaymentStatus({
          paymentId: paymentWithDerived.id,
          status: "failed",
          providerReceiptUrl: null,
          paymentMethod: providerIntent.paymentMethodType ?? null,
          paymentIntentId: providerIntent.id,
        });
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
  const providerName = formatPaymentProvider(providerConfig.provider);


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
      <div className="min-h-screen page-background-styles py-12 text-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="page-card-styles text-center">
            <Alert variant="destructive" className="text-left">
              <AlertTitle>Error Loading Payment</AlertTitle>
              <AlertDescription>{loaderError}</AlertDescription>
            </Alert>
            <div className="mt-8">
              <Button asChild>
                <Link to="/family">Return to Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="min-h-screen page-background-styles py-12 text-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="page-card-styles text-center">
            <Alert variant="destructive" className="text-left">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>Payment data is unexpectedly missing.</AlertDescription>
            </Alert>
            <div className="mt-8">
              <Button asChild>
                <Link to="/family">Return to Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isInitializingPayment = paymentIntentFetcher.state === "submitting";
  const paymentStatusLabel = formatPaymentStatus(payment.status);
  const hasDiscount = Boolean(payment.discount_amount && payment.discount_amount > 0);

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to="/family"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Account
        </Link>

        <section className="page-card-styles mb-8">
          <div className="grid gap-8 lg:grid-cols-[1.35fr,0.95fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-green-600 dark:text-green-400">
                Secure Checkout
              </p>
              <h1 className="page-header-styles mt-3 mb-4">Complete Your Payment</h1>
              <p className="text-lg leading-relaxed text-gray-600 dark:text-gray-300">
                Review the payment summary and finish checkout securely through {providerName}.
              </p>

              <div className="grid gap-4 md:grid-cols-3 mt-8">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Account</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {payment.family?.name ?? "N/A"}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Product</p>
                  <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {getPaymentProductDescription(payment.type)}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-800/70">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                  <div className="mt-2">
                    <span className={getPaymentStatusClasses(payment.status)}>
                      {paymentStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-green-200/70 bg-gradient-to-br from-green-50 to-amber-50 p-6 shadow-sm dark:border-green-500/20 dark:from-green-950/30 dark:to-gray-900">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700 dark:text-green-300">
                Amount Due
              </p>
              <p className="mt-4 text-4xl font-bold text-gray-900 dark:text-white">
                {formatMoney(payment.total_amount)}
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Any applicable taxes and discounts are already reflected in this total.
              </p>

              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                  <dt className="text-gray-600 dark:text-gray-400">Subtotal</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">
                    {formatMoney(payment.subtotal_amount)}
                  </dd>
                </div>
                {groupedTaxes.map((tax) => (
                  <div key={tax.description} className="flex items-center justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                    <dt className="text-gray-600 dark:text-gray-400">{tax.description}</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white">
                      {formatMoney(tax.amount)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-green-200/80 pt-4 dark:border-green-500/20">
                  <dt className="text-gray-600 dark:text-gray-400">Total</dt>
                  <dd className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatMoney(payment.total_amount)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="page-card-styles">
            <div className="flex items-start gap-4 mb-6">
              <div className="rounded-2xl bg-green-100 p-3 text-green-700 dark:bg-green-500/10 dark:text-green-300">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Checkout</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Your payment details are processed securely by {providerName}.
                </p>
              </div>
            </div>

            {payment.status === "failed" && (
              <Alert variant="warning" className="mb-6">
                <AlertTitle>Previous Attempt Failed</AlertTitle>
                <AlertDescription>
                  Your last payment attempt did not go through. Review your payment details and try again.
                </AlertDescription>
              </Alert>
            )}

            {isInitializingPayment && (
              <Alert className="mb-6">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Preparing Secure Checkout</AlertTitle>
                <AlertDescription>
                  We&apos;re initializing your payment session now.
                </AlertDescription>
              </Alert>
            )}

            {state.fetcherError && (
              <Alert variant="destructive" className="mb-6">
                <AlertTitle>Initialization Error</AlertTitle>
                <AlertDescription>{state.fetcherError}</AlertDescription>
              </Alert>
            )}

            <PaymentForm
              payment={payment}
              providerConfig={providerConfig}
              clientSecret={state.clientSecret}
              providerData={{ squareCheckoutUrl: state.squareCheckoutUrl }}
              onError={handleError}
            />

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link to="/family">Cancel and Return to Account</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="page-card-styles">
              <div className="flex items-start gap-4 mb-6">
                <div className="rounded-2xl bg-gray-100 p-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                  <Receipt className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Details</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Review the details associated with this payment session.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <PaymentDetailRow label="Account" value={payment.family?.name ?? "N/A"} />
                {payment.family?.email && (
                  <PaymentDetailRow label="Email" value={payment.family.email} />
                )}
                <PaymentDetailRow label="Product" value={getPaymentProductDescription(payment.type)} />
                <PaymentDetailRow label="Provider" value={providerName} />
                <PaymentDetailRow
                  label="Status"
                  value={
                    <span className={getPaymentStatusClasses(payment.status)}>
                      {paymentStatusLabel}
                    </span>
                  }
                />
                <PaymentDetailRow
                  label="Subtotal"
                  value={formatMoney(payment.subtotal_amount)}
                />
                {hasDiscount && (
                  <PaymentDetailRow
                    label="Discount"
                    value="Included in subtotal"
                  />
                )}
                {groupedTaxes.map((tax) => (
                  <PaymentDetailRow
                    key={tax.description}
                    label={tax.description}
                    value={formatMoney(tax.amount)}
                  />
                ))}
                <PaymentDetailRow
                  label="Total"
                  value={formatMoney(payment.total_amount)}
                  emphasized
                />
              </div>
            </div>

            <div className="page-card-styles">
              <div className="flex items-start gap-4 mb-4">
                <div className="rounded-2xl bg-green-100 p-3 text-green-700 dark:bg-green-500/10 dark:text-green-300">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Secure Checkout</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    This payment link stays tied to the same payment record, so you can safely return and complete it later if checkout is interrupted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentDetailRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/70">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-2 text-gray-900 dark:text-white">
        <span className={emphasized ? "text-lg font-bold" : "text-base font-semibold"}>
          {value}
        </span>
      </div>
    </div>
  );
}

function formatPaymentProvider(provider: PaymentProviderId) {
  if (provider === "stripe") return "Stripe";
  if (provider === "square") return "Square";
  return "our payment provider";
}

function formatPaymentStatus(status: string | null | undefined) {
  if (status === "succeeded") return "Paid";
  if (status === "failed") return "Failed";
  return "Pending";
}

function getPaymentStatusClasses(status: string | null | undefined) {
  if (status === "succeeded") {
    return "inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-300";
  }
  if (status === "failed") {
    return "inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300";
  }
  return "inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200";
}

export function ErrorBoundary() {
  const error = useRouteError();

  // Extract payment ID from URL if available
  const url = typeof window !== 'undefined' ? window.location.pathname : '';
  const paymentIdMatch = url.match(/\/pay\/([^/]+)/);
  const paymentId = paymentIdMatch ? paymentIdMatch[1] : 'unknown';

  // Log comprehensive error details
  console.error("[PaymentPage ErrorBoundary] Payment page error caught:", {
    paymentId,
    url,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    timestamp: new Date().toISOString()
  });

  // Additional logging for better debugging
  if (error instanceof Error) {
    console.error(`[PaymentPage ErrorBoundary] Error name: ${error.name}`);
    console.error(`[PaymentPage ErrorBoundary] Error message: ${error.message}`);
    console.error(`[PaymentPage ErrorBoundary] Error stack:`, error.stack);
  }

  return (
    <div className="min-h-screen page-background-styles py-12 text-foreground">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="page-card-styles">
          <Alert variant="destructive">
            <AlertTitle>Payment Page Error</AlertTitle>
            <AlertDescription>
              Sorry, something went wrong while loading the payment page. Please try again later or contact support.
              {paymentId !== 'unknown' && (
                <span className="block mt-2 text-sm font-mono">Reference ID: {paymentId}</span>
              )}
            </AlertDescription>
          </Alert>
          <div className="mt-8">
            <Button asChild>
              <Link to="/family">Return to Account</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
