import { json, type ActionFunctionArgs, type LoaderFunctionArgs, redirect, TypedResponse } from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate, useRouteError, useSearchParams } from "@remix-run/react";
import { useState, useEffect, useRef } from "react";
import { checkStudentEligibility, createInitialPaymentRecord, type EligibilityStatus, getSupabaseServerClient } from "~/utils/supabase.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon, ReloadIcon} from "@radix-ui/react-icons";
import {siteConfig} from "~/config/site";
import {Checkbox} from "~/components/ui/checkbox";
import {formatDate} from "~/utils/misc";
import {RadioGroup, RadioGroupItem} from "~/components/ui/radio-group";
import {Label} from "~/components/ui/label";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import type { AvailableDiscountCode, AvailableDiscountsResponse } from '~/routes/api.available-discounts.$familyId';
import type { DiscountValidationResult } from "~/types/discount";

// Payment Calculation (Flat Monthly Rate)
//
// The logic resides entirely within the loader function of the payment page (app/routes/_layout.family.payment.tsx). With automatic discounts now in place,
// all students pay the same flat monthly rate, and discounts are applied automatically based on enrollment events and other criteria.
//
//  1 Fetch Successful Payment History: The loader queries the payments table for all records associated with the current family_id that have a status of 'succeeded'.
//  2 Fetch Payment-Student Links: It then queries the payment_students junction table to find out which specific student_id was included in each of those successful payments.
//  3 Count Past Payments Per Student: For each student belonging to the family, the code counts how many times their student_id appears in the results from step 2 (i.e., how many successful payments they have been part
//    of in the past). This is kept for historical tracking purposes.
//  4 Set Flat Monthly Rate: All students now use the same monthly rate (siteConfig.pricing.monthly) regardless of their payment history.
//     Automatic discounts will be applied at checkout for new students and other qualifying events.
//  5 Pass to Component: The calculated nextPaymentAmount and nextPaymentTierLabel (along with eligibility status) for each student are then passed as studentPaymentDetails to the payment page component for display and
//    use in the dynamic total calculation when checkboxes are selected.


// Define the structure for student payment details, including eligibility
interface StudentPaymentDetail {
    studentId: string;
    firstName: string;
    lastName: string;
    eligibility: EligibilityStatus; // Current status (Trial, Paid, Expired)
    needsPayment: boolean; // True if status is Trial or Expired
    nextPaymentAmount: number; // Amount in dollars for monthly payment
    nextPaymentTierLabel: string; // Label for payment (Monthly)
    pastPaymentCount: number; // Kept for historical tracking
    // Stripe Price ID for monthly payment
    nextPaymentPriceId: string; // Stripe Price ID for monthly payment
}

// Define payment options
type PaymentOption = 'monthly' | 'yearly' | 'individual';

// Updated Loader data interface
export interface LoaderData {
    familyId: string;
    familyName: string;
    // No longer need the separate 'students' array, details are in studentPaymentDetails
    studentPaymentDetails?: StudentPaymentDetail[];
    // stripePublishableKey is no longer needed here
    hasAvailableDiscounts: boolean; // Whether there are any available discount codes
    error?: string;
}

// Loader function
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by layout, but handle defensively
        throw redirect("/login", {headers});
    }

    // Get profile to find family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single() as { data: { family_id: string | null } | null, error: Error };

    if (profileError || !profileData?.family_id) {
        console.error("Payment Loader Error: Failed to load profile or family_id", profileError?.message);
        // Redirect back to family portal with an error message? Or throw a generic error?
        // For now, throw an error that the boundary can catch.
        throw new Response("Could not load your family information. Please try again.", {status: 500});
    }

    const familyId = profileData.family_id;

    // --- Fetch Family, Students, and Payment History ---

    // 1. Fetch Family Name
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single() as { data: { name: string | null } | null, error: Error };

    if (familyError || !familyData) {
        console.error("Payment Loader Error: Failed to load family name", familyError?.message);
        throw new Response("Could not load family details.", {status: 500, headers});
    }
    const familyName: string = familyData.name!;

    // 2. Fetch Students for the Family
    const {data: studentsData, error: studentsError} = await supabaseServer
        .from('students')
        .select('id::text, first_name::text, last_name::text')
        .eq('family_id', familyId);

    if (studentsError) {
        console.error("Payment Loader Error: Failed to load students", studentsError.message);
        throw new Response("Could not load student information.", {status: 500, headers});
    }
    if (!studentsData || studentsData.length === 0) {
        // Return specific error handled by the component
        return json({
            familyId,
            familyName,
            // No students found, return empty details
            error: "No students found in this family.",
            hasAvailableDiscounts: false
        }, {headers});
    }
    const students = studentsData; // Keep full student list

    // 3. Fetch Successful Payments for the Family
    const {data: paymentsData, error: paymentsError} = await supabaseServer
        .from('payments')
        .select('id, status') // Only need id and status
        .eq('family_id', familyId)
        .eq('status', 'succeeded'); // Only count successful payments

    if (paymentsError) {
        console.error("Payment Loader Error: Failed to load payments", paymentsError.message);
        throw new Response("Could not load payment history.", {status: 500, headers});
    }
    const successfulPaymentIds = paymentsData?.map(p => p.id) || [];

    // 4. Fetch Payment-Student Links for Successful Payments
    let paymentStudentLinks: Array<{ student_id: string, payment_id: string }> = [];
    if (successfulPaymentIds.length > 0) {
        const {data: linksData, error: linksError} = await supabaseServer
            .from('payment_students')
            .select('student_id, payment_id')
            .in('payment_id', successfulPaymentIds) as {
            data: Array<{ student_id: string, payment_id: string }> | null,
            error: Error
        };

        if (linksError) {
            console.error("Payment Loader Error: Failed to load payment links", linksError.message);
            throw new Response("Could not load payment link history.", {status: 500, headers});
        }
        paymentStudentLinks = linksData || [];
    }

    // --- Calculate Eligibility and Next Payment Details Per Student ---
    const studentPaymentDetails: StudentPaymentDetail[] = [];
    // let totalAmountInCents = 0; // Remove pre-calculation

    for (const student of students) {
        // 1. Check current eligibility
        const eligibility = await checkStudentEligibility(student.id, supabaseServer);

        // 2. Determine next payment amount - now using flat monthly rate
        // Automatic discounts will handle reduced pricing for new students
        const pastPaymentCount = paymentStudentLinks.filter(link => link.student_id === student.id).length;
        const nextPaymentAmount = siteConfig.pricing.monthly;
        const nextPaymentTierLabel = "Monthly";
        const nextPaymentPriceId = siteConfig.stripe.priceIds.monthly;

        // 3. Determine if group class payment is needed now
        // Eligibility check already filters for group payments ('Paid - Monthly', 'Paid - Yearly', 'Expired', 'Trial')
        const needsPayment = eligibility.reason === 'Trial' || eligibility.reason === 'Expired';

        studentPaymentDetails.push({
            studentId: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            eligibility: eligibility,
            needsPayment: needsPayment,
            nextPaymentAmount: nextPaymentAmount, // This is the calculated MONTHLY amount
            nextPaymentTierLabel: nextPaymentTierLabel, // Monthly tier label
            nextPaymentPriceId: nextPaymentPriceId, // Monthly tier Price ID
            pastPaymentCount: pastPaymentCount,
        });
    }

    // --- Check for Available Discounts ---
    // Check if there are any active discount codes available for this family
    const { data: availableDiscountsData, error: discountsError } = await supabaseServer
        .from('discount_codes')
        .select('id')
        .eq('is_active', true)
        .or(`family_id.eq.${familyId},family_id.is.null`) // Family-specific or global discounts
        .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString()) // Not expired (null means never expires)
        .limit(1); // We only need to know if any exist

    const hasAvailableDiscounts = !discountsError && availableDiscountsData && availableDiscountsData.length > 0;

    // --- Prepare and Return Data ---
    // Stripe key is no longer needed in the loader for this page

    // Return data without pre-calculated total
    return json({
        familyId,
        familyName,
        studentPaymentDetails, // This now contains all student info needed
        hasAvailableDiscounts, // Whether there are available discount codes
        // stripePublishableKey removed
    }, {headers});
}


// --- Action Function ---
type ActionResponse = {
    error?: string;
    fieldErrors?: { [key: string]: string };
    zeroPayment?: boolean;
};

// Update return type: Action returns JSON data (success/error)
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionResponse & { success?: boolean; paymentId?: string }>> {
    const { response } = getSupabaseServerClient(request);
    const formData = await request.formData();

    const familyId = formData.get('familyId') as string;
    const paymentOption = formData.get('paymentOption') as PaymentOption;
    const studentIdsString = formData.get('studentIds') as string; // Comma-separated, potentially empty
    const oneOnOneQuantityStr = formData.get('oneOnOneQuantity') as string; // Quantity for individual
    const discountCodeId = formData.get('discountCodeId') as string | null; // Discount code ID
    const discountAmountStr = formData.get('discountAmount') as string | null; // Discount amount

    // --- Validation ---
    const fieldErrors: ActionResponse['fieldErrors'] = {};
    if (!familyId) fieldErrors.familyId = "Missing family information."; // Should not happen if form is correct
    if (!paymentOption) fieldErrors.paymentOption = "Payment option is required.";

    const studentIds = (paymentOption === 'monthly' || paymentOption === 'yearly')
        ? (studentIdsString ? studentIdsString.split(',').filter(id => id) : [])
        : [];

    let oneOnOneQuantity = 1; // Default
    if (paymentOption === 'individual') {
        if (!oneOnOneQuantityStr || isNaN(parseInt(oneOnOneQuantityStr)) || parseInt(oneOnOneQuantityStr) <= 0) {
            fieldErrors.oneOnOneQuantity = "A valid positive quantity is required for Individual Sessions.";
        } else {
            oneOnOneQuantity = parseInt(oneOnOneQuantityStr);
        }
    } else if ((paymentOption === 'monthly' || paymentOption === 'yearly') && studentIds.length === 0) {
        fieldErrors.studentIds = "Please select at least one student for group payments.";
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please correct the errors below.", fieldErrors }, { status: 400, headers: response.headers });
    }
    // --- End Validation ---


    // --- Server-Side Calculation & Payment Record Creation ---
    let totalAmountInCents = 0;
    let type: Database['public']['Enums']['payment_type_enum']; // Use 'type' variable

    try {
        // --- Restore Original Logic ---
        if (paymentOption === 'individual') {
            type = 'individual_session'; // Assign to 'type'
            totalAmountInCents = siteConfig.pricing.oneOnOneSession * oneOnOneQuantity * 100;
        } else if (paymentOption === 'yearly') {
            type = 'yearly_group'; // Assign to 'type'
            totalAmountInCents = siteConfig.pricing.yearly * studentIds.length * 100;
        } else { // Monthly
            type = 'monthly_group'; // Assign to 'type'
            // Use flat monthly rate for all students - automatic discounts will handle reduced pricing
            totalAmountInCents = siteConfig.pricing.monthly * studentIds.length * 100;
        }
        // Rename totalAmountInCents to subtotalAmountInCents for clarity
        const subtotalAmountInCents = totalAmountInCents;

        // Parse discount amount
        const discountAmount = discountAmountStr ? parseInt(discountAmountStr, 10) : 0;
        
        // Apply discount to subtotal
        const finalSubtotalInCents = Math.max(0, subtotalAmountInCents - discountAmount);

        // Handle zero payment case - create a succeeded payment record directly
        if (finalSubtotalInCents <= 0) {
            console.log("[Action] Zero payment detected. Creating succeeded payment record directly.");
            
            // Create the initial payment record with zero amount
            const { data: paymentRecord, error: createError } = await createInitialPaymentRecord(
                familyId,
                finalSubtotalInCents, // This will be 0
                studentIds,
                type,
                null, // orderId
                discountCodeId,
                discountAmount
            );

            if (createError || !paymentRecord?.id) {
                console.error("[Action] Error creating zero payment record:", createError);
                return json({ error: `Failed to initialize payment: ${createError || 'Payment ID missing'}` }, { status: 500, headers: response.headers });
            }

            // Update the payment status to succeeded since no actual payment is needed
            console.log(`[Action] Attempting to update payment ${paymentRecord.id} to succeeded status`);
            
            // Use the same client pattern as createInitialPaymentRecord for consistency
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl || !supabaseServiceKey) {
                console.error("[Action] Missing Supabase environment variables for payment update");
                return json({ error: "Failed to complete zero payment: Missing configuration" }, { status: 500, headers: response.headers });
            }
            const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);
            
            const { data: updateData, error: updateError } = await supabaseAdmin
                .from('payments')
                .update({
                    status: 'succeeded',
                    payment_date: new Date().toISOString().split('T')[0], // Convert to YYYY-MM-DD format for date field
                    payment_method: 'discount_100_percent'
                })
                .eq('id', paymentRecord.id)
                .select('id, status, payment_method, payment_date');

            if (updateError) {
                console.error("[Action] Error updating zero payment to succeeded:", updateError);
                return json({ error: `Failed to complete zero payment: ${updateError.message}` }, { status: 500, headers: response.headers });
            }

            console.log(`[Action] Zero payment update result:`, updateData);
            console.log(`[Action] Zero payment completed successfully (ID: ${paymentRecord.id}).`);
            return json({ success: true, paymentId: paymentRecord.id, zeroPayment: true }, { headers: response.headers });
        }

        // Create the initial payment record
        // console.log("[Action] Calling createInitialPaymentRecord with subtotal...");
        const { data: paymentRecord, error: createError } = await createInitialPaymentRecord(
            familyId,
            finalSubtotalInCents, // Pass the final subtotal after discount
            studentIds, // Pass selected student IDs (empty for individual)
            type, // Pass 'type' variable
            null, // orderId
            discountCodeId, // Pass discount code ID
            discountAmount // Pass discount amount
        );
        // console.log(`[Action] createInitialPaymentRecord result: data=${JSON.stringify(paymentRecord)}, error=${createError}`);

        if (createError || !paymentRecord?.id) {
            console.error("[Action] Error condition met after createInitialPaymentRecord. Returning JSON error.", createError);
            return json({ error: `Failed to initialize payment: ${createError || 'Payment ID missing'}` }, { status: 500, headers: response.headers });
        }

        // Return full JSON success data including paymentId
        const paymentId = paymentRecord.id;
        // console.log(`[Action] Payment record created successfully (ID: ${paymentId}). Returning success JSON with paymentId...`);
        return json({ success: true, paymentId: paymentId }, { headers: response.headers }); // Return success and ID

    } catch (error) {
        // This catch block handles actual errors
        // No need to check for Response instance here anymore
        const message = error instanceof Error ? error.message : "An unexpected error occurred during payment setup.";
        console.error("Action Error (in catch):", message); // Clarify log source
        return json({ error: message }, { status: 500, headers: response.headers });
    } // The main try block ends here
}


export default function FamilyPaymentPage() {
    // Destructure the updated loader data (no stripePublishableKey)
    const {
        familyId,
        studentPaymentDetails,
        hasAvailableDiscounts,
        // stripePublishableKey removed
        error: loaderError
    } = useLoaderData<typeof loader>();
    // Use fetcher instead of actionData/navigation for this form
    const fetcher = useFetcher<ActionResponse & { success?: boolean; paymentId?: string }>();
    const navigate = useNavigate();
    const formRef = useRef<HTMLFormElement>(null); // Add ref for the form
    const [searchParams] = useSearchParams(); // Get search params

    // --- Restore State & Calculations ---
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    // Set initial payment option based on URL query param, default to 'monthly'
    const initialOption = searchParams.get('option') === 'individual' ? 'individual' : 'monthly';
    const [paymentOption, setPaymentOption] = useState<PaymentOption>(initialOption); // State for payment option
    const [oneOnOneQuantity, setOneOnOneQuantity] = useState(1); // State for 1:1 session quantity
    const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null); // State for applied discount
    const [applyDiscount, setApplyDiscount] = useState(true);
    const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
    const [availableDiscounts, setAvailableDiscounts] = useState<AvailableDiscountCode[]>([]);
    const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);
    const [showPaymentForm, setShowPaymentForm] = useState(true);
    
    const discountsFetcher = useFetcher<AvailableDiscountsResponse>();

    // Determine if any student is eligible for a group payment to enable/disable options
    const hasEligibleStudentsForGroupPayment = studentPaymentDetails?.some(d => d.needsPayment) ?? false;

    // const isSubmitting = fetcher.state !== 'idle'; // Unused: fetcher.state is used directly in button disabled prop

    // --- Dynamic Calculation (Subtotal, Tax, Total) ---
    const calculateAmounts = () => {
        let subtotal = 0;
        if (paymentOption === 'monthly' || paymentOption === 'yearly') {
            selectedStudentIds.forEach(id => {
                const detail = studentPaymentDetails!.find(d => d.studentId === id);
                if (detail) {
                    const amount = paymentOption === 'yearly'
                        ? siteConfig.pricing.yearly // Use fixed yearly price
                        : detail.nextPaymentAmount; // Use calculated monthly price
                    subtotal += amount * 100; // Add amount in cents to subtotal
                }
            });
        } else if (paymentOption === 'individual') { // Corrected check
            subtotal = siteConfig.pricing.oneOnOneSession * oneOnOneQuantity * 100; // Calculate subtotal
        }

        // Apply discount if available
        const discountAmount = appliedDiscount?.discount_amount || 0;
        const discountedSubtotal = Math.max(0, subtotal - discountAmount);

        // Tax is calculated by Stripe, only return subtotal for display here
        const total = discountedSubtotal; // For display purposes, total initially equals discounted subtotal

        return { subtotal, discountAmount, total }; // Include discount information
    };

    // Helper function to format currency amounts
    const formatCurrency = (amountInCents: number): string => {
        const amount = amountInCents / 100;
        const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
        return `$${formatted}`;
    };

    // Helper function to calculate percentage savings for display
    const calculatePercentageSavings = (discount: AvailableDiscountCode, subtotalInCents: number): string => {
        if (discount.discount_type === 'percentage') {
            const savingsAmount = (subtotalInCents * discount.discount_value) / 100;
            return formatCurrency(savingsAmount);
        }
        return formatCurrency(discount.discount_value * 100); // Fixed amount
    };

    const { subtotal: currentSubtotalInCents, discountAmount: currentDiscountAmountInCents, total: currentTotalInCents } = calculateAmounts();
    const currentSubtotalDisplay = formatCurrency(currentSubtotalInCents);
    const currentDiscountDisplay = appliedDiscount ? formatCurrency(currentDiscountAmountInCents) : null;
    const currentTotalDisplay = formatCurrency(currentTotalInCents);
    // --- End Dynamic Calculation ---


    // Navigation is handled by the effect below at line 620

    // --- Event Handlers ---
    const handleCheckboxChange = (studentId: string, checked: boolean | 'indeterminate') => {
        setSelectedStudentIds(prev => {
            const next = new Set(prev);
            if (checked === true) {
                next.add(studentId);
            } else {
                next.delete(studentId);
            }
            return next;
        });
        // Reset discount when selection changes
        setAppliedDiscount(null);
    };



    // Reset discount when payment option changes
    useEffect(() => {
        setAppliedDiscount(null);
    }, [paymentOption]);

    // Reset discount when one-on-one quantity changes
    useEffect(() => {
        if (paymentOption === 'individual') {
            setAppliedDiscount(null);
        }
    }, [oneOnOneQuantity, paymentOption]);

    // Fetch available discounts when checkbox is checked
    useEffect(() => {
        if (applyDiscount && hasAvailableDiscounts && currentSubtotalInCents > 0) {
            setIsLoadingDiscounts(true);
            const params = new URLSearchParams();
            if (selectedStudentIds.size === 1) {
                params.set('studentId', Array.from(selectedStudentIds)[0]);
            }
            const applicableTo = paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group';
            params.set('applicableTo', applicableTo);
            
            discountsFetcher.load(`/api/available-discounts/${familyId}?${params.toString()}`);
        } else if (!applyDiscount) {
            setAvailableDiscounts([]);
            setSelectedDiscountId('');
            setAppliedDiscount(null);
        }
    // Intentionally excluding discountsFetcher to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyDiscount, hasAvailableDiscounts, currentSubtotalInCents, familyId, selectedStudentIds, paymentOption]);

    // Handle discounts fetcher response
    useEffect(() => {
        if (discountsFetcher.data && discountsFetcher.state === 'idle') {
            const discounts = discountsFetcher.data.discounts || [];
            // Sort by decreasing value (most rewarding at top)
            const sortedDiscounts = discounts.sort((a, b) => {
                const aValue = a.discount_type === 'percentage' ? a.discount_value : a.discount_value;
                const bValue = b.discount_type === 'percentage' ? b.discount_value : b.discount_value;
                return bValue - aValue;
            });
            setAvailableDiscounts(sortedDiscounts);
            // Auto-select the best discount (first in sorted list)
            if (sortedDiscounts.length > 0) {
                setSelectedDiscountId(sortedDiscounts[0].id);
            }
            setIsLoadingDiscounts(false);
        }
    // Intentionally excluding discountsFetcher to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discountsFetcher.data, discountsFetcher.state]);

    // Validate discount when selected
    useEffect(() => {
        if (selectedDiscountId && applyDiscount) {
            const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId);
            if (selectedDiscount) {
                // Replace fetcher.submit with regular fetch for JSON data
                const validateDiscount = async () => {
                    try {
                        const response = await fetch('/api/discount-codes/validate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                code: selectedDiscount.code,
                                family_id: familyId,
                                student_id: selectedStudentIds.size === 1 ? Array.from(selectedStudentIds)[0] : '',
                                subtotal_amount: currentSubtotalInCents,
                                applicable_to: paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group'
                            })
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.is_valid) {
                                setAppliedDiscount(data);
                            } else {
                                setAppliedDiscount(null);
                            }
                        } else {
                            console.error('Failed to validate discount:', response.statusText);
                            setAppliedDiscount(null);
                        }
                    } catch (error) {
                        console.error('Error validating discount:', error);
                        setAppliedDiscount(null);
                    }
                };
                
                validateDiscount();
            }
        }
    }, [selectedDiscountId, applyDiscount, availableDiscounts, familyId, selectedStudentIds, currentSubtotalInCents, paymentOption]);

    // Discount validation response is now handled directly in the fetch call above

    // Remove handlePaymentSubmit function - logic moved to action

    // --- End Event Handlers ---

    // --- Effect for Form Visibility Control ---
    useEffect(() => {

        if (fetcher.state === 'submitting') {
            setShowPaymentForm(false);
        } else if (fetcher.state === 'idle') {
            if (fetcher.data?.error) {
                // Show form again if there's an error
                setShowPaymentForm(true);
            } else if (!fetcher.data?.success) {
                // Show form if idle and no success (initial state)
                setShowPaymentForm(true);
            }
            // If success but still on this page after a delay, show form again
            else if (fetcher.data?.success) {
                setTimeout(() => {
                    setShowPaymentForm(true);
                }, 2000); // Wait 2 seconds for navigation
            }
        }
    }, [fetcher.state, fetcher.data?.error, fetcher.data?.success, showPaymentForm]);

    // --- Effect for Client-Side Navigation (using fetcher data) ---
    useEffect(() => {
        // Check for both success flag and paymentId before navigating
        if (fetcher.data?.success && fetcher.data?.paymentId) {
            // For zero payments, go directly to family portal; otherwise go to payment page
            if (fetcher.data?.zeroPayment) {
                navigate(`/family`);
            } else {
                navigate(`/pay/${fetcher.data.paymentId}`);
            }
        }
    }, [fetcher.data, fetcher.state, navigate]);
    // --- End Effect ---


    // Handle case where loader found no students (error message comes from loader data)
    if (loaderError === "No students found in this family.") {
        return (
            <div className="container mx-auto px-4 py-8 max-w-md">
                <Alert variant="destructive">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>No Students Found</AlertTitle>
                    <AlertDescription>
                        You must have at least one student registered in your family to make a payment.
                        Please <Link to="/family/add-student" className="font-medium underline">add a
                        student</Link> first.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Remove Stripe key check - key is only needed on the /pay page now

    // Handle other potential loader errors (e.g., failed to get familyId)
    // studentPaymentDetails will be empty if students couldn't be loaded properly by the loader logic
    if (!familyId || !studentPaymentDetails) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-md">
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error Loading Payment Details</AlertTitle>
                    <AlertDescription>
                        Could not load necessary payment information. Please return to the
                        <Link to="/family" className="font-medium underline px-1">Family Portal</Link>
                        and try again, or contact support if the problem persists.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    // Removed old static calculation logic

    return (
        <div className="container mx-auto px-4 py-8 max-w-lg"> {/* Increased max-width */}
            <h1 className="text-2xl font-bold mb-6 text-center">Make Payment</h1>

            {/* Display errors from fetcher.data */}
            {fetcher.data?.error && (
                <Alert variant="destructive" className="mb-4">
                    <ExclamationTriangleIcon className="h-4 w-4"/>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{fetcher.data.error}</AlertDescription>
                    {/* Optionally display field-specific errors */}
                    {fetcher.data.fieldErrors && (
                        <ul className="list-disc pl-5 mt-2 text-sm">
                            {Object.entries(fetcher.data.fieldErrors).map(([field, error]) => (
                                error ? <li key={field}>{error}</li> : null
                            ))}
                        </ul>
                    )}
                </Alert>
            )}

            {/* Payment Form - conditionally rendered */}
            {showPaymentForm ? (
                <>
                    {/* Restore Payment Option Selection */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">Choose Payment Option</h2>
                {/* Use value prop for controlled component, remove defaultValue */}
                <RadioGroup value={paymentOption}
                            onValueChange={(value) => setPaymentOption(value as PaymentOption)} className="space-y-2">
                    {/* Option 1: Monthly Group Fees */}
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="opt-monthly" disabled={!hasEligibleStudentsForGroupPayment} tabIndex={1}/>
                        <Label htmlFor="opt-monthly"
                               className={`text-sm ${!hasEligibleStudentsForGroupPayment ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}>Pay Monthly Group Class Fees</Label>
                    </div>
                    {/* Option 2: Yearly Group Fees */}
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yearly" id="opt-yearly" disabled={!hasEligibleStudentsForGroupPayment} tabIndex={2}/>
                        <Label htmlFor="opt-yearly" className={`text-sm ${!hasEligibleStudentsForGroupPayment ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}>Pay Yearly Group Class Fees
                            ({siteConfig.pricing.currency}{siteConfig.pricing.yearly}/student)</Label>
                    </div>
                    {/* Option 3: Individual Session */}
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="individual" id="opt-individual" tabIndex={3}/> {/* Corrected value */}
                        <Label htmlFor="opt-individual" className="text-sm">Purchase Individual Session(s) {/* Corrected label */}
                            ({siteConfig.pricing.currency}{siteConfig.pricing.oneOnOneSession}/session)</Label>
                    </div>
                </RadioGroup>

                {/* Conditional UI for Individual Session Quantity */}
                {paymentOption === 'individual' && ( // Corrected check
                    <div className="mt-4 pl-6">
                        <Label htmlFor="oneOnOneQuantity">Number of Sessions:</Label>
                        <Input
                            id="oneOnOneQuantity"
                            type="number"
                            min="1"
                            value={oneOnOneQuantity}
                            onChange={(e) => setOneOnOneQuantity(parseInt(e.target.value, 10) || 1)}
                            className="mt-1 w-20"
                            tabIndex={4}
                        />
                         {fetcher.data?.fieldErrors?.oneOnOneQuantity && ( // Use fetcher.data
                            <p className="text-red-500 text-sm mt-1">{fetcher.data.fieldErrors.oneOnOneQuantity}</p>
                        )}
                    </div>
                )}
            </div>


            {/* Restore Student Selection & Payment Details Section (Conditional) */}
            {(paymentOption === 'monthly' || paymentOption === 'yearly') && studentPaymentDetails && studentPaymentDetails.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">
                        {paymentOption === 'yearly' ? 'Select Students for Yearly Payment' : 'Select Students for Monthly Payment'}
                    </h2>
                     {fetcher.data?.fieldErrors?.studentIds && ( // Use fetcher.data
                        <p className="text-red-500 text-sm mb-3">{fetcher.data.fieldErrors.studentIds}</p>
                    )}

                    {/* Student List with Checkboxes */}
                    <div className="space-y-4 mb-6">
                        {studentPaymentDetails.map(detail => (
                            <div key={detail.studentId}
                                 className={`flex items-start space-x-3 p-3 rounded-md ${detail.needsPayment ? 'border border-gray-200 dark:border-gray-700' : 'opacity-70 bg-gray-50 dark:bg-gray-700/50'}`}>
                                {detail.needsPayment ? (
                                    <Checkbox
                                        id={`student-${detail.studentId}`}
                                        checked={selectedStudentIds.has(detail.studentId)}
                                        onCheckedChange={(checked) => handleCheckboxChange(detail.studentId, checked)}
                                        className="mt-1" // Align checkbox better
                                        tabIndex={5}
                                    />
                                ) : (
                                    <div className="w-4 h-4 mt-1"> {/* Placeholder for alignment */} </div>
                                )}
                                <div className="flex-1">
                                    <label
                                        htmlFor={detail.needsPayment ? `student-${detail.studentId}` : undefined}
                                        className={`font-medium ${detail.needsPayment ? 'cursor-pointer' : 'cursor-default'}`}
                                    >
                                        {detail.firstName} {detail.lastName}
                                    </label>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        { (detail.eligibility.reason === 'Paid - Monthly' ||detail.eligibility.reason === 'Paid - Yearly')
                                            && detail.eligibility.lastPaymentDate &&
                                            `Active (Last Paid: ${formatDate(detail.eligibility.lastPaymentDate, { formatString: 'MMM d, yyyy' })})`
                                        }
                                        {detail.eligibility.reason === 'Trial' &&
                                            `On Free Trial`
                                        }
                                        {detail.eligibility.reason === 'Expired' && detail.eligibility.lastPaymentDate &&
                                            `Expired (Last Paid: ${formatDate(detail.eligibility.lastPaymentDate, { formatString: 'MMM d, yyyy' })})`
                                        }
                                        {detail.eligibility.reason === 'Expired' && !detail.eligibility.lastPaymentDate &&
                                            `Expired (No payment history)`
                                        }
                                    </p>
                                    {/* Show relevant price based on selection */}
                                    {detail.needsPayment && paymentOption === 'monthly' && (
                                        <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-1">
                                            Next Monthly
                                            Payment: {formatCurrency(detail.nextPaymentAmount * 100)} ({detail.nextPaymentTierLabel})
                                        </p>
                                    )}
                                    {detail.needsPayment && paymentOption === 'yearly' && (
                                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-1">
                                            Yearly
                                            Payment: {formatCurrency(siteConfig.pricing.yearly * 100)}
                                        </p>
                                    )}
                                    {/* Show message if payment not needed */}
                                    {!detail.needsPayment && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Group class payment not currently due.
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )} {/* End conditional student selection div */}


            {/* Discount Code Section */}
            {currentSubtotalInCents > 0 && hasAvailableDiscounts && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                    <div className="flex items-center space-x-2 mb-4">
                        <Checkbox
                            id="apply-discount"
                            checked={applyDiscount}
                            onCheckedChange={(checked) => setApplyDiscount(checked === true)}
                            disabled={fetcher.state !== 'idle'}
                            tabIndex={6}
                        />
                        <Label htmlFor="apply-discount" className="text-lg font-semibold">
                            Apply Discount Code
                        </Label>
                    </div>

                    {applyDiscount && (
                        <div className="space-y-4">
                            {isLoadingDiscounts ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <ReloadIcon className="h-4 w-4 animate-spin" />
                                    Loading available discounts...
                                </div>
                            ) : availableDiscounts.length > 0 ? (
                                <div>
                                    <Label htmlFor="discount-select" className="text-sm font-medium mb-2 block">
                                        Select Discount Code
                                    </Label>
                                    <Select
                                        value={selectedDiscountId}
                                        onValueChange={setSelectedDiscountId}
                                        disabled={fetcher.state !== 'idle'}
                                    >
                                        <SelectTrigger className="w-full" tabIndex={7}>
                                            <SelectValue placeholder="Choose a discount code" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableDiscounts.map((discount) => {
                                                const savingsDisplay = calculatePercentageSavings(discount, currentSubtotalInCents);
                                                const displayText = discount.discount_type === 'percentage' 
                                                    ? `${discount.code} - ${discount.discount_value}% off (Save ${savingsDisplay})`
                                                    : `${discount.code} - ${savingsDisplay} off`;
                                                return (
                                                    <SelectItem key={discount.id} value={discount.id}>
                                                        {displayText}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                    
                                    {/* Validation loading state is now handled in the async function */}
                                    
                                    {appliedDiscount && (
                                        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mt-4">
                                            <CheckCircledIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            <AlertDescription className="text-green-800 dark:text-green-200">
                                                <strong>Discount Applied: {appliedDiscount.code}</strong>
                                                <div className="text-sm mt-1">
                                                    Discount: {formatCurrency(appliedDiscount.discount_amount)}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {/* Validation errors are now handled in the async function */}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No discount codes are currently available for this payment.
                                </p>
                            )}
                            
                            {discountsFetcher.data?.error && (
                                <Alert variant="destructive">
                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                    <AlertDescription>
                                        {discountsFetcher.data.error}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Combined Total & Pricing Info Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                {/* Calculated Amounts */}
                <div className="space-y-2 border-b pb-4 mb-4 dark:border-gray-600">
                    <div className="flex justify-between items-center text-md">
                        <span>Subtotal:</span>
                        <span>{currentSubtotalDisplay}</span>
                    </div>
                    {appliedDiscount && currentDiscountDisplay && (
                        <div className="flex justify-between items-center text-md text-green-600 dark:text-green-400">
                            <span>Discount ({appliedDiscount.code}):</span>
                            <span>-{currentDiscountDisplay}</span>
                        </div>
                    )}
                    {/* Tax line removed - will be calculated by Stripe */}
                    <div className="flex justify-between items-center font-bold text-lg mt-2">
                        <span>Total Due:</span>
                        {/* Display discounted total + Tax indicator, or just total for zero payments */}
                        <span>{currentTotalInCents <= 0 ? currentTotalDisplay : `${currentTotalDisplay} + Tax`}</span>
                    </div>
                </div>

                {/* Pricing Info Alert */}
                <Alert variant="default"
                       className="bg-blue-50 dark:bg-gray-700 border-blue-200 dark:border-gray-600">
                    <InfoCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-300"/>
                    <AlertTitle className="text-blue-800 dark:text-blue-200">How Pricing Works</AlertTitle>
                    <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                        Your first class is a <span className="font-semibold">{siteConfig.pricing.freeTrial}</span>.
                        Monthly fee: {formatCurrency(siteConfig.pricing.monthly * 100)}/mo per student.
                        Yearly fee: {formatCurrency(siteConfig.pricing.yearly * 100)}/year per student.
                        1:1 Sessions: {formatCurrency(siteConfig.pricing.oneOnOneSession * 100)}/session.
                        New students may be eligible for automatic discounts.
                        Prices shown are before tax. Applicable taxes (e.g., GST, PST) will be added to the final amount.
                    </AlertDescription>
                </Alert>
            </div>

            {/* Payment Form - Use standard form with fetcher.Form and add ID */}
            <fetcher.Form method="post" ref={formRef} id="payment-setup-form"> {/* Use fetcher.Form and add ID */}
                {/* Hidden fields for family info and selections */}
                <input type="hidden" name="familyId" value={familyId}/>
                <input type="hidden" name="paymentOption" value={paymentOption}/>
                {/* Pass selected student IDs */}
                <input type="hidden" name="studentIds" value={Array.from(selectedStudentIds).join(',')}/>
                {/* Pass quantity if individual option is selected */}
                {paymentOption === 'individual' && (
                    <input type="hidden" name="oneOnOneQuantity" value={oneOnOneQuantity}/>
                )}
                {/* Pass discount information if applied */}
                {appliedDiscount && (
                    <>
                        <input type="hidden" name="discountCodeId" value={appliedDiscount.discount_code_id}/>
                        <input type="hidden" name="discountAmount" value={appliedDiscount.discount_amount}/>
                    </>
                )}

                {/* Button is now outside the form but linked by the 'form' attribute */}
            </fetcher.Form> {/* fetcher.Form ends here */}

            {/* Button moved outside the form, now submits the form directly */}
            <div className="mt-6"> {/* Add some margin */}
                <Button
                    type="submit" // Change type to submit
                    form="payment-setup-form" // Associate with the form's new ID
                    className="w-full"
                    // Disable based on fetcher state and validation logic (removed zero payment check)
                    disabled={
                        fetcher.state !== 'idle' || // Disable if fetcher is not idle
                        ((paymentOption === 'monthly' || paymentOption === 'yearly') && selectedStudentIds.size === 0) ||
                        (paymentOption === 'individual' && oneOnOneQuantity <= 0)
                    }
                    tabIndex={8}
                >
                    {/* Display calculated total on button or "Proceed" for zero payments */}
                    {fetcher.state !== 'idle' 
                        ? "Setting up payment..." 
                        : currentTotalInCents <= 0 
                            ? "Proceed" 
                            : `Proceed to Pay ${currentTotalDisplay}`
                    }
                </Button>
            </div>

                    <div className="mt-4 text-center">
                        <Link to="/family" className="text-sm text-blue-600 hover:underline dark:text-blue-400"> {/* Link to family portal */}
                            Cancel and return to Family Portal
                        </Link>
                    </div>
                </>
            ) : (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
                    <div className="flex items-center justify-center mb-4">
                        <ReloadIcon className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">Processing Payment...</h2>
                    <p className="text-gray-600 dark:text-gray-400">Please wait while we set up your payment.</p>
                </div>
            )}
        </div>
    );
}

// Error Boundary remains largely the same, but use useRouteError()
export function ErrorBoundary() {
    const error = useRouteError(); // Use this hook

    // Basic error display
    return (
        <div className="container mx-auto px-4 py-8 max-w-lg"> {/* Match container width */}
            <Alert variant="destructive">
                <ExclamationTriangleIcon className="h-4 w-4"/>
                <AlertTitle>Payment Page Error</AlertTitle>
                <AlertDescription>
                    {error instanceof Error
                        ? error.message
                        : "An unexpected error occurred while loading the payment page."}
                    Please try returning to the <Link to="/family" className="font-medium underline px-1">Family
                    Portal</Link>.
                </AlertDescription>
                {/* Optional: Display stack trace in development */}
                {process.env.NODE_ENV === "development" && error instanceof Error && (
                    <pre
                        className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs dark:bg-red-900/50 dark:text-red-100">
                        {error.stack}
                    </pre>
                )}
            </Alert>
        </div>
    );
}
