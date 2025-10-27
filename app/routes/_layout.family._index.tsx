import {json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect, TypedResponse} from "@remix-run/node"; // Import redirect
import {Link, useLoaderData} from "@remix-run/react";
import {type EligibilityStatus, getSupabaseServerClient} from "~/utils/supabase.server"; // Import eligibility check
import { performance } from "node:perf_hooks";
import { parse } from "cookie";
import {getIncompleteRegistrations, dismissIncompleteRegistration, type IncompleteRegistrationWithEvent} from "~/services/incomplete-registration.server";
import { getCurrentDateTimeInTimezone } from "~/utils/misc";
import type { Database } from "~/types/database.types";

// Simple in-memory cache for required waivers (rarely changes)
const REQUIRED_WAIVERS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let requiredWaiversCache: { data: Array<{id: string; title: string}>; expiresAt: number } | null = null;

// Batch check eligibility for multiple students
async function batchCheckStudentEligibility(
    studentIds: string[],
    supabase: ReturnType<typeof getSupabaseServerClient>['supabaseServer']
): Promise<Map<string, EligibilityStatus>> {
    if (studentIds.length === 0) {
        return new Map();
    }

    // Fetch enrollments and payments in PARALLEL
    const [{data: allEnrollments}, {data: allPayments}] = await Promise.all([
        supabase
            .from('enrollments')
            .select('student_id, paid_until, status')
            .in('student_id', studentIds)
            .in('status', ['active', 'trial'])
            .order('paid_until', {ascending: false}),
        supabase
            .from('payment_students')
            .select(`
                student_id,
                payments!inner (
                    payment_date,
                    type,
                    status
                )
            `)
            .in('student_id', studentIds)
            .eq('payments.status', 'succeeded')
            .order('payments.payment_date', {ascending: false})
    ]);

    // Group enrollments by student
    const enrollmentsByStudent = new Map<string, typeof allEnrollments>();
    allEnrollments?.forEach(enrollment => {
        const existing = enrollmentsByStudent.get(enrollment.student_id) || [];
        existing.push(enrollment);
        enrollmentsByStudent.set(enrollment.student_id, existing);
    });

    // Group payments by student (get latest only)
    type PaymentRecord = NonNullable<typeof allPayments>[number];
    const paymentByStudent = new Map<string, PaymentRecord>();
    allPayments?.forEach(payment => {
        if (!paymentByStudent.has(payment.student_id)) {
            paymentByStudent.set(payment.student_id, payment);
        }
    });

    const today = getCurrentDateTimeInTimezone();
    const results = new Map<string, EligibilityStatus>();

    // Process each student
    studentIds.forEach(studentId => {
        const enrollments = enrollmentsByStudent.get(studentId) || [];

        if (enrollments.length === 0) {
            results.set(studentId, {eligible: false, reason: 'Expired'});
            return;
        }

        // Check for trial
        const trialEnrollment = enrollments.find(e => e.status === 'trial');
        if (trialEnrollment) {
            results.set(studentId, {eligible: true, reason: 'Trial'});
            return;
        }

        // Check active paid enrollments
        const activeEnrollments = enrollments.filter(e => e.status === 'active');
        for (const enrollment of activeEnrollments) {
            if (enrollment.paid_until) {
                const paidUntilDate = new Date(enrollment.paid_until);
                if (paidUntilDate >= today) {
                    const payment = paymentByStudent.get(studentId);
                    const paymentData = payment?.payments;
                    const reason: EligibilityStatus['reason'] =
                        paymentData?.type === 'yearly_group' ? 'Paid - Yearly' : 'Paid - Monthly';

                    results.set(studentId, {
                        eligible: true,
                        reason,
                        lastPaymentDate: paymentData?.payment_date || undefined,
                        type: paymentData?.type as Database['public']['Enums']['payment_type_enum'] | undefined,
                        paidUntil: enrollment.paid_until || undefined
                    });
                    return;
                }
            }
        }

        // Expired
        const payment = paymentByStudent.get(studentId);
        const paymentData = payment?.payments;
        results.set(studentId, {
            eligible: false,
            reason: 'Expired',
            lastPaymentDate: paymentData?.payment_date || undefined,
            type: paymentData?.type as Database['public']['Enums']['payment_type_enum'] | undefined,
            paidUntil: activeEnrollments[0]?.paid_until || undefined
        });
    });

    return results;
}
import {
    AlertCircle,
    Award,
    BookOpen,
    Calendar,
    CheckCircle,
    Clock,
    Eye,
    Plus,
    Settings,
    Shield,
    UserCheck,
    Users
} from 'lucide-react'; // Import icons
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert"; // Import Alert components
import {Button} from "~/components/ui/button";
import {Badge} from "~/components/ui/badge"; // Import Badge
import {formatDate, getTodayLocalDateString} from "~/utils/misc"; // For formatting dates
import {beltColorMap} from "~/utils/constants"; // Import belt color mapping
import {useClientEffect} from "~/hooks/use-client-effect";
import {OfflineErrorBoundary} from "~/components/OfflineErrorBoundary";
import {cacheAttendanceData, cacheFamilyData, cacheUpcomingClasses} from "~/utils/offline-cache";
import {useClientReady} from "~/hooks/use-client-ready";
import {FamilyLoadingScreen} from "~/components/LoadingScreen";
import {IncompleteRegistrationBanner} from "~/components/IncompleteRegistrationBanner";

// Define Guardian type
type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];

// Extend student type within FamilyData to include eligibility, belt info, and enrollments
type StudentWithEligibility = Database["public"]["Tables"]["students"]["Row"] & {
    eligibility: EligibilityStatus;
    currentBeltRank?: Database["public"]["Enums"]["belt_rank_enum"] | null;
    activeEnrollments?: {
        class_name: string;
        program_name: string;
        status: Database["public"]["Enums"]["enrollment_status"];
    }[];
};

// Define FamilyData using the extended student type
export type FamilyData = Database["public"]["Tables"]["families"]["Row"] & {
    students?: StudentWithEligibility[]; // Use the extended student type
    payments?: (
        Database["public"]["Tables"]["payments"]["Row"] & {
        payment_students: {
            student_id: string;
        }[];
    }
        )[];
    guardians?: GuardianRow[]; // Add guardians array
};

// Define upcoming class session type
type UpcomingClassSession = {
    student_id: string;
    student_name: string;
    class_name: string;
    session_date: string;
    start_time: string;
    end_time: string;
    instructor_name?: string;
};

// Define student attendance type
interface StudentAttendance {
    student_id: string;
    student_name: string;
    last_session_date?: string;
    attendance_status?: 'Present' | 'Absent' | 'Excused' | 'Late';
}

// Define type for pending waivers
type PendingWaiver = {
    waiver_id: string;
    waiver_name: string;
    program_name?: string;
    student_name?: string;
    enrollment_id?: string;
};

interface LoaderData {
    profile?: { familyId: string };
    family?: FamilyData;
    error?: string;
    allWaiversSigned?: boolean;
    registrationWaiversComplete?: boolean;
    missingRegistrationWaivers?: string[];
    pendingWaivers?: PendingWaiver[];
    upcomingClasses?: UpcomingClassSession[];
    studentAttendanceData?: StudentAttendance[];
    profileComplete?: boolean;
    missingProfileFields?: string[];
    incompleteRegistrations?: IncompleteRegistrationWithEvent[];
}

// Action handler for dismissing incomplete registrations
export async function action({request}: ActionFunctionArgs) {
    const {supabaseServer} = getSupabaseServerClient(request);
    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'dismiss') {
        const incompleteRegistrationId = formData.get('incompleteRegistrationId') as string;

        if (!incompleteRegistrationId) {
            return json({error: 'Missing incomplete registration ID'}, {status: 400});
        }

        const {error} = await dismissIncompleteRegistration(supabaseServer, incompleteRegistrationId);

        if (error) {
            console.error('[family-portal] Error dismissing incomplete registration:', error);
            return json({error: 'Failed to dismiss incomplete registration'}, {status: 500});
        }

        return json({success: true});
    }

    return json({error: 'Invalid intent'}, {status: 400});
}

// Placeholder loader - will need to fetch actual family data later
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const timings: Record<string, number> = {};
    const overallStart = performance.now();

    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);

    // Conditional auth check based on cookie presence (like homepage optimization)
    const cookies = parse(request.headers.get('cookie') ?? '');
    const cookieKeys = Object.keys(cookies);
    const hasSessionCookie = cookieKeys.some((key) =>
        key.startsWith('sb-') ||
        key.startsWith('sb:') ||
        key.endsWith('-token')
    );
    const hasAuthHeader = Boolean(request.headers.get('authorization'));
    const shouldFetchAuth = hasSessionCookie || hasAuthHeader;

    const authStart = performance.now();
    const {data: {user}} = shouldFetchAuth
        ? await supabaseServer.auth.getUser()
        : { data: { user: null } };
    timings.auth = performance.now() - authStart;

    if (!user) {
        // This shouldn't happen if the route is protected by the layout,
        // but good practice to handle it.
        // Consider redirecting to login if needed, depending on layout setup.
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // 1. Get the user's profile to find their family_id
    // Use maybeSingle() to handle potential duplicate profiles gracefully
    const profileStart = performance.now();
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id') // Only fetch family_id, as names are not on this table
        .eq('id', user.id)
        .maybeSingle();
    timings.profile = performance.now() - profileStart;

    if (profileError) {
        console.error("Error fetching profile:", profileError?.message);
        timings.total = performance.now() - overallStart;
        // If there's an actual database error (not just duplicate rows)
        return json({
            error: "Failed to load user profile. Please contact support if this persists.",
        }, {status: 500, headers});
    }

    if (!profileData) {
        console.warn("No profile found for user:", user.id);
        timings.total = performance.now() - overallStart;
        // Profile doesn't exist - redirect to setup page
        return json({
            error: "User profile not found. Please complete your registration.",
        }, {status: 404, headers});
    }

    if (!profileData.family_id) {
        // User is logged in but not associated with a family yet. Redirect to setup.
        // This might happen after registration but before family creation/linking
        console.warn("User authenticated but no family_id found. Redirecting to /family/setup");
        timings.total = performance.now() - overallStart;
        // Note: Ensure the /family/setup route exists or adjust the target URL.
        return redirect("/family/setup", {headers});
    }

    // 2-5. Fetch family data, students, guardians, payment, and waivers in parallel
    // Split the nested query to improve performance
    const now = Date.now();
    const cachedWaivers = requiredWaiversCache && requiredWaiversCache.expiresAt > now
        ? requiredWaiversCache.data
        : null;

    const parallelStart = performance.now();
    const parallelResults = await Promise.all([
        supabaseServer
            .from('families')
            .select('*')
            .eq('id', profileData.family_id)
            .single(),
        supabaseServer
            .from('students')
            .select('*')
            .eq('family_id', profileData.family_id),
        supabaseServer
            .from('guardians')
            .select('*')
            .eq('family_id', profileData.family_id),
        supabaseServer
            .from('payments')
            .select(`
                *,
                payment_students(student_id)
            `)
            .eq('family_id', profileData.family_id)
            .eq('status', 'succeeded')
            .order('payment_date', {ascending: false, nullsFirst: false})
            .order('created_at', {ascending: false})
            .limit(1)
            .maybeSingle(),
        cachedWaivers
            ? Promise.resolve({ data: cachedWaivers, error: null })
            : (async () => {
                const result = await supabaseServer
                    .from('waivers')
                    .select('id, title')
                    .eq('required', true);

                // Cache the result
                if (!result.error && result.data) {
                    requiredWaiversCache = {
                        data: result.data,
                        expiresAt: Date.now() + REQUIRED_WAIVERS_CACHE_TTL
                    };
                }

                return result;
            })(),
        supabaseServer
            .from('waiver_signatures')
            .select('waiver_id')
            .eq('user_id', user.id)
    ]);
    timings.parallelQueries = performance.now() - parallelStart;

    const {data: familyData, error: familyError} = parallelResults[0];
    const {data: studentsData, error: studentsError} = parallelResults[1];
    const {data: guardiansData, error: guardiansError} = parallelResults[2];
    const {data: recentPaymentData, error: paymentError} = parallelResults[3];
    const {data: requiredWaivers, error: requiredWaiversError} = parallelResults[4];
    const {data: signedWaivers, error: signedWaiversError} = parallelResults[5];

    if (familyError || !familyData) {
        console.error("Error fetching family data:", familyError?.message ?? "Family not found");
        timings.total = performance.now() - overallStart;
        return json({
            profile: {familyId: String(profileData.family_id)},
            error: "Failed to load family data.",
            allWaiversSigned: false
        }, {status: 500, headers});
    }

    // Combine family with students and guardians
    const familyBaseData = {
        ...familyData,
        students: studentsData || [],
        guardians: guardiansData || []
    };

    if (paymentError) {
        console.error("Error fetching recent payment data:", paymentError.message);
        // Don't fail the whole page, just proceed without payment info
    }

    // console.log("Most Recent Successful Payment Data:", recentPaymentData);

    // 5. Fetch only eligibility for students (belt awards and enrollments not shown on main page)
    const studentDataStart = performance.now();
    const studentsWithEligibility: StudentWithEligibility[] = !familyBaseData.students || familyBaseData.students.length === 0
        ? []
        : await (async () => {
            const studentIds = familyBaseData.students.map(s => s.id);

            // Only fetch eligibility - belt awards and enrollments not displayed on main page
            const eligibilityMap = await batchCheckStudentEligibility(studentIds, supabaseServer);

            // Combine eligibility with student data
            return familyBaseData.students.map(student => {
                const eligibility = eligibilityMap.get(student.id) || {eligible: false, reason: 'Expired' as const};

                return {
                    ...student,
                    eligibility,
                    currentBeltRank: null, // Not displayed on main page
                    activeEnrollments: [], // Not displayed on main page
                };
            });
        })();
    timings.studentData = performance.now() - studentDataStart;

    // Combine base family data, students with eligibility, and the single payment (if found)
    const finalFamilyData: FamilyData = {
        ...familyBaseData,
        students: studentsWithEligibility,
        payments: recentPaymentData ? [recentPaymentData] : [], // Add payment as an array (or empty array)
    };


    // 6. Process waivers (already fetched in parallel earlier)
    let allWaiversSigned = false;
    const pendingWaivers: PendingWaiver[] = [];

    try {
        if (requiredWaiversError) throw requiredWaiversError;
        if (signedWaiversError) throw signedWaiversError;

        const signedWaiverIds = new Set(signedWaivers?.map((s: {waiver_id: string}) => s.waiver_id) || []);

        // Check general required waivers
        if (!requiredWaivers || requiredWaivers.length === 0) {
            allWaiversSigned = true;
        } else {
            const requiredWaiverIds = new Set(requiredWaivers.map(w => w.id));
            allWaiversSigned = [...requiredWaiverIds].every(id => signedWaiverIds.has(id));

            // Add missing general waivers to pending list
            requiredWaivers.forEach(waiver => {
                if (!signedWaiverIds.has(waiver.id)) {
                    pendingWaivers.push({
                        waiver_id: waiver.id,
                        waiver_name: waiver.title
                    });
                }
            });
        }

        // Check program-specific waivers for all students' enrollments with batch query
        if (studentsWithEligibility.length > 0) {
            const enrollmentWaiversStart = performance.now();
            const studentIds = studentsWithEligibility.map(s => s.id);

            // Batch query for all students' enrollment waivers
            const {data: allEnrollmentWaivers, error: enrollmentError} = await supabaseServer
                .from('enrollments')
                .select(`
                    id,
                    student_id,
                    programs!inner(
                        name,
                        required_waiver:waivers(
                            id,
                            title
                        )
                    )
                `)
                .in('student_id', studentIds)
                .in('status', ['active', 'trial'])
                .not('programs.required_waiver_id', 'is', null);

            timings.enrollmentWaivers = performance.now() - enrollmentWaiversStart;

            if (enrollmentError) {
                console.error('Error fetching enrollment waivers:', enrollmentError);
            } else if (allEnrollmentWaivers) {
                // Create student name lookup
                const studentNameMap = new Map<string, string>();
                studentsWithEligibility.forEach(student => {
                    studentNameMap.set(student.id, `${student.first_name} ${student.last_name}`);
                });

                // Process all enrollment waivers
                allEnrollmentWaivers.forEach(enrollment => {
                    const waiverArray = enrollment.programs?.required_waiver;
                    const waiver = Array.isArray(waiverArray) && waiverArray.length > 0 ? waiverArray[0] : null;

                    if (waiver && !signedWaiverIds.has(waiver.id)) {
                        const exists = pendingWaivers.some(pw => pw.waiver_id === waiver.id && pw.enrollment_id === enrollment.id);
                        if (!exists) {
                            pendingWaivers.push({
                                waiver_id: waiver.id,
                                waiver_name: waiver.title,
                                program_name: enrollment.programs?.name,
                                student_name: studentNameMap.get(enrollment.student_id),
                                enrollment_id: enrollment.id
                            });
                            allWaiversSigned = false;
                        }
                    }
                });
            }
        }

    } catch (error: unknown) { // Outer catch handles errors from waiver or balance fetching
        if (error instanceof Error) {
            console.error("Error checking waiver status or balance:", error.message);
        } else {
            console.error("Error checking waiver status or balance:", error);
        }
        // Default waiver status if there's an error
        allWaiversSigned = false;
    }

    // 7-8. Fetch upcoming classes, attendance, and incomplete registrations with batch optimization
    const additionalDataStart = performance.now();
    const [upcomingClasses, studentAttendanceData, {data: incompleteRegistrations}] = await Promise.all([
        (async (): Promise<UpcomingClassSession[]> => {
            if (studentsWithEligibility.length === 0) return [];

            try {
                const studentIds = studentsWithEligibility.map(s => s.id);

                // Batch query for all students' upcoming sessions
                const {data: allSessions} = await supabaseServer
                    .from('class_sessions')
                    .select(`
                        session_date,
                        start_time,
                        end_time,
                        classes!inner(
                            name,
                            enrollments!inner(
                                student_id,
                                students(
                                    first_name,
                                    last_name
                                )
                            )
                        ),
                        instructor:profiles(
                            first_name,
                            last_name
                        )
                    `)
                    .in('classes.enrollments.student_id', studentIds)
                    .in('classes.enrollments.status', ['active', 'trial'])
                    .gte('session_date', getTodayLocalDateString())
                    .order('session_date', {ascending: true})
                    .order('start_time', {ascending: true});

                // Group by student and get first session for each
                type SessionRecord = NonNullable<typeof allSessions>[number];
                const sessionsByStudent = new Map<string, SessionRecord>();
                allSessions?.forEach(session => {
                    const enrollment = session.classes.enrollments[0];
                    if (enrollment) {
                        const studentId = enrollment.student_id;
                        if (!sessionsByStudent.has(studentId)) {
                            sessionsByStudent.set(studentId, session);
                        }
                    }
                });

                return Array.from(sessionsByStudent.values())
                    .filter(session => session.classes.enrollments[0])
                    .map(session => {
                        const enrollment = session.classes.enrollments[0]!;
                        return {
                            student_id: enrollment.student_id,
                            student_name: `${enrollment.students.first_name} ${enrollment.students.last_name}`,
                            class_name: session.classes.name,
                            session_date: session.session_date,
                            start_time: session.start_time,
                            end_time: session.end_time,
                            instructor_name: session.instructor ? `${session.instructor.first_name} ${session.instructor.last_name}` : undefined
                        };
                    });
            } catch (error) {
                console.error('Error processing upcoming class sessions:', error);
                return [];
            }
        })(),
        (async (): Promise<StudentAttendance[]> => {
            if (studentsWithEligibility.length === 0) return [];

            try {
                const studentIds = studentsWithEligibility.map(s => s.id);

                // Batch query for all students' attendance
                const {data: allAttendance} = await supabaseServer
                    .from('attendance')
                    .select(`
                        student_id,
                        status,
                        class_sessions!inner(
                            session_date
                        )
                    `)
                    .in('student_id', studentIds)
                    .not('class_session_id', 'is', null)
                    .order('class_sessions(session_date)', {ascending: false});

                // Group by student and get latest attendance for each
                type AttendanceRecord = NonNullable<typeof allAttendance>[number];
                const attendanceByStudent = new Map<string, AttendanceRecord>();
                allAttendance?.forEach(attendance => {
                    if (!attendanceByStudent.has(attendance.student_id)) {
                        attendanceByStudent.set(attendance.student_id, attendance);
                    }
                });

                return studentsWithEligibility.map(student => {
                    const attendance = attendanceByStudent.get(student.id);
                    return {
                        student_id: student.id,
                        student_name: `${student.first_name} ${student.last_name}`,
                        last_session_date: attendance?.class_sessions?.session_date || undefined,
                        attendance_status: attendance?.status === 'present' ? 'Present' as const :
                            attendance?.status === 'absent' ? 'Absent' as const :
                                attendance?.status === 'excused' ? 'Excused' as const :
                                    attendance?.status === 'late' ? 'Late' as const : undefined
                    };
                });
            } catch (error) {
                console.error('Error fetching attendance data:', error);
                return [];
            }
        })(),
        getIncompleteRegistrations(supabaseServer, profileData.family_id)
    ]);
    timings.additionalData = performance.now() - additionalDataStart;

    // Check if profile is complete (has address information)
    const missingProfileFields: string[] = [];
    if (!finalFamilyData.address) missingProfileFields.push('address');
    if (!finalFamilyData.city) missingProfileFields.push('city');
    if (!finalFamilyData.province) missingProfileFields.push('province');
    const profileComplete = missingProfileFields.length === 0;

    // Calculate total timing
    timings.total = performance.now() - overallStart;

    // Generate Server-Timing header
    const serverTimingHeader = Object.entries(timings)
        .map(([key, value]) => `${key};dur=${value.toFixed(2)}`)
        .join(', ');

    console.log('[family.metrics]', {
        familyId: profileData.family_id,
        studentCount: studentsWithEligibility.length,
        timings
    });

    // Return profile, combined family data, waiver status, upcoming classes, attendance data, and profile completeness
    return json({
        profile: {familyId: String(profileData.family_id)},
        family: finalFamilyData, // Use the combined data
        allWaiversSigned,
        pendingWaivers,
        upcomingClasses,
        studentAttendanceData,
        profileComplete,
        missingProfileFields,
        incompleteRegistrations: incompleteRegistrations || []
    }, {
        headers: {
            ...headers,
            'Server-Timing': serverTimingHeader
        }
    });
}


// Helper function for eligibility badge variants
const getEligibilityBadgeVariant = (status: EligibilityStatus['reason']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        // Adjusted cases based on the actual reasons in EligibilityStatus
        case 'Paid - Monthly':
        case 'Paid - Yearly':
            return 'default'; // Greenish
        case 'Trial':
            return 'secondary'; // Bluish/Grayish
        case 'Expired':
            return 'destructive'; // Reddish
        default:
            return 'outline';
    }
};

export default function FamilyDashboard() {
    // Always call hooks at the top level
    const loaderData = useLoaderData<typeof loader>();
    const {family, error, allWaiversSigned, pendingWaivers, upcomingClasses, studentAttendanceData, profileComplete, missingProfileFields, incompleteRegistrations} = loaderData;
    const isClientReady = useClientReady();

    // Cache data for offline access when component mounts
    useClientEffect(() => {
        if (family) {
            cacheFamilyData({
                family: {
                    id: family.id,
                    name: family.name,
                    address: family.address ?? undefined,
                    city: family.city ?? undefined,
                    province: family.province ?? undefined,
                    postal_code: family.postal_code ?? undefined,
                    primary_phone: family.primary_phone ?? undefined,
                    email: family.email,
                    students: family.students,
                },
                allWaiversSigned: allWaiversSigned ?? false
            });
        }
        if (upcomingClasses) {
            cacheUpcomingClasses(upcomingClasses);
        }
        if (studentAttendanceData) {
            cacheAttendanceData(studentAttendanceData);
        }
    }, [family, allWaiversSigned, upcomingClasses, studentAttendanceData]);

    // Show loading state during hydration
    if (!isClientReady) {
        return <FamilyLoadingScreen/>;
    }

    // Handle specific error messages from the loader
    if (error) {
        // Special handling if no family is associated yet
        if (error === "No family associated with this account.") {
            return (
                <div className="container mx-auto px-4 py-8 text-center">
                    <h1 className="text-2xl font-semibold mb-4">Welcome!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Your account isn&apos;t linked to a family yet. Please complete your registration or contact
                        support.
                    </p>
                    {/* Optional: Add a link to registration or contact */}
                    {/* <Button asChild><Link to="/register/family-details">Complete Registration</Link></Button> */}
                </div>
            );
        }
        // Generic error display
        return <div className="text-red-500 p-4">Error loading family portal: {error}</div>;
    }

    // If family data is still loading or wasn't fetched (should be handled by error above now)
    if (!family) {
        return <div className="p-4">Loading family data...</div>; // Or a loading spinner
    }

    // Use the fetched family name or a generic fallback
    // We don't have profile.first_name here anymore
    const familyDisplayName = family.name || `Your Family Portal`;

    return (
        <OfflineErrorBoundary>
            <div className="min-h-screen page-background-styles text-foreground">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Incomplete Event Registrations Banner - Show incomplete event registrations */}
                    {incompleteRegistrations && incompleteRegistrations.length > 0 && (
                        <IncompleteRegistrationBanner incompleteRegistrations={incompleteRegistrations} />
                    )}

                    {/* Incomplete Profile Banner - Show when profile is missing address information */}
                    {!profileComplete && missingProfileFields && missingProfileFields.length > 0 && (
                        <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-500">
                            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400"/>
                            <AlertTitle className="text-blue-900 dark:text-blue-100 font-semibold">
                                Complete Your Profile
                            </AlertTitle>
                            <AlertDescription className="text-blue-700 dark:text-blue-300 mt-2">
                                <p className="mb-3">
                                    Your profile is missing some information ({missingProfileFields.join(', ')}).
                                    Complete your profile to enable class enrollment.
                                </p>
                                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                                    <Link to="/family/complete-profile" className="inline-flex items-center gap-2">
                                        <UserCheck className="h-4 w-4"/>
                                        Complete Profile Now
                                    </Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* No Students Banner - Show when family has no students */}
                    {family.students && family.students.length === 0 && (
                        <Alert className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-500">
                            <Users className="h-5 w-5 text-green-600 dark:text-green-400"/>
                            <AlertTitle className="text-green-900 dark:text-green-100 font-semibold">
                                Almost there! Add your first student
                            </AlertTitle>
                            <AlertDescription className="text-green-700 dark:text-green-300 mt-2">
                                <p className="mb-3">
                                    To enroll in classes and access the full family portal, you&apos;ll need to add at least one student to your family account.
                                </p>
                                <Button asChild className="bg-green-600 hover:bg-green-700 text-white">
                                    <Link to="/family/add-student" className="inline-flex items-center gap-2">
                                        <Plus className="h-4 w-4"/>
                                        Add Student Now
                                    </Link>
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Header Section */}
                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                            {familyDisplayName}
                        </h1>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                            Welcome to your family portal. Manage students, view schedules, and track progress.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {/* My Students Section */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <Users className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">My Students</h2>
                            </div>
                            {/* Display students as cards or a message if none */}
                            {family.students && family.students.length > 0 ? (
                                <div className="space-y-4 mb-6">
                                    {family.students.map((student) => (
                                        <Link
                                            key={student.id}
                                            to={`/family/student/${student.id}`}
                                            className="block p-4 form-card-styles rounded-lg border-l-4 border-green-500 hover:shadow-md transition-shadow duration-300 group"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Users className="h-4 w-4 text-green-600"/>
                                                        <h3 className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                                            {student.first_name} {student.last_name}
                                                        </h3>
                                                    </div>
                                                    {/* Belt Rank Indicator */}
                                                    {student.currentBeltRank && (
                                                        <div
                                                            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                                                            <Award className="h-3 w-3"/>
                                                            <div className="flex items-center gap-1">
                                                                <div
                                                                    className={`w-3 h-3 rounded-full ${beltColorMap[student.currentBeltRank]} ${student.currentBeltRank === 'white' ? 'border border-gray-400' : ''}`}
                                                                    title={`${student.currentBeltRank.charAt(0).toUpperCase() + student.currentBeltRank.slice(1)} Belt`}
                                                                ></div>
                                                                <span className="capitalize font-medium">
                                                            {student.currentBeltRank} Belt
                                                        </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Eligibility Badge */}
                                                <div className="text-right px-3 py-2 rounded-lg shadow-sm">
                                                    <Badge
                                                        variant={getEligibilityBadgeVariant(student.eligibility.reason)}
                                                        className="text-sm font-medium px-2 py-1">
                                                        {student.eligibility.reason.startsWith('Paid') ? 'Active' : student.eligibility.reason}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Additional Info */}
                                            <div className="space-y-2">
                                                {/* Paid Until Date */}
                                                {(student.eligibility.reason.startsWith('Paid') || student.eligibility.reason === 'Expired') && student.eligibility.lastPaymentDate && (
                                                    <div
                                                        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                        <Clock className="h-3 w-3"/>
                                                        <span>Paid until: </span>
                                                        <span className="font-medium text-blue-600 dark:text-blue-400">
                                                    {(() => {
                                                        const lastPayment = new Date(student.eligibility.lastPaymentDate);
                                                        const paidUntil = new Date(lastPayment);
                                                        if (student.eligibility.reason === 'Paid - Monthly') {
                                                            paidUntil.setMonth(paidUntil.getMonth() + 1);
                                                        } else if (student.eligibility.reason === 'Paid - Yearly') {
                                                            paidUntil.setFullYear(paidUntil.getFullYear() + 1);
                                                        }
                                                        return formatDate(student.eligibility.paidUntil, {formatString: 'MMM d, yyyy'});
                                                    })()} 
                                                </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Active Enrollments */}
                                            {student.activeEnrollments && student.activeEnrollments.length > 0 && (
                                                <div className="space-y-2 mt-3">
                                                    <div
                                                        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        <BookOpen className="h-4 w-4"/>
                                                        <span>Enrolled Classes:</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {student.activeEnrollments.map((enrollment, index) => (
                                                            <Badge key={index} variant="outline"
                                                                   className="text-sm px-3 py-1 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300">
                                                                {enrollment.class_name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3"/>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">No students registered yet.</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-500">Add your first student to
                                        get started!</p>
                                </div>
                            )}
                            {/* Link to the new dedicated page for adding a student to the current family */}
                            <Button asChild
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                <Link to="/family/add-student" className="flex items-center justify-center gap-2">
                                    <Plus className="h-5 w-5"/>
                                    Add Student
                                </Link>
                            </Button>
                        </div>

                        {/* Next Classes Section */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <Calendar className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Next Classes</h2>
                            </div>
                            {upcomingClasses && upcomingClasses.length > 0 ? (
                                <div className="space-y-4">
                                    {upcomingClasses.map((session, index) => (
                                        <div key={index}
                                             className="p-4 form-card-styles rounded-lg border-l-4 border-green-500 hover:shadow-md transition-shadow duration-300">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Award className="h-4 w-4 text-blue-600"/>
                                                        <p className="font-bold text-gray-900 dark:text-gray-100">
                                                            {session.student_name}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">
                                                        {session.class_name}
                                                    </p>
                                                    {session.instructor_name && (
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                            <Users className="h-3 w-3"/>
                                                            Instructor: {session.instructor_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <div
                                                    className="text-right bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                                        {formatDate(session.session_date, {formatString: 'MMM d'})}
                                                    </p>
                                                    <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                        <Clock className="h-3 w-3"/>
                                                        {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button asChild
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                        <Link to="/family/calendar" className="flex items-center justify-center gap-2">
                                            <Eye className="h-5 w-5"/>
                                            View Full Calendar
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3"/>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">No upcoming classes
                                        scheduled.</p>
                                    {family?.students && family.students.length > 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-500">
                                            Contact us to schedule classes for your students.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-500">
                                            Add students to see their upcoming classes.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Attendance Panel */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <CheckCircle className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Student
                                    Attendance</h2>
                            </div>
                            {studentAttendanceData && studentAttendanceData.length > 0 ? (
                                <div className="space-y-4">
                                    {studentAttendanceData.map((attendance, index) => (
                                        <div key={index}
                                             className="p-4 form-card-styles rounded-lg border-l-4 border-green-500 hover:shadow-md transition-shadow duration-300">
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <UserCheck className="h-4 w-4 text-green-600"/>
                                                        <p className="font-bold text-gray-900 dark:text-gray-100">
                                                            {attendance.student_name}
                                                        </p>
                                                    </div>
                                                    {attendance.last_session_date ? (
                                                        <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                            <Clock className="h-3 w-3"/>
                                                            Last
                                                            session: {formatDate(attendance.last_session_date, {formatString: 'MMM d, yyyy'})}
                                                        </p>
                                                    ) : (
                                                        <p className="text-sm text-gray-500 dark:text-gray-500">
                                                            No attendance recorded yet
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    {attendance.attendance_status ? (
                                                        <Badge
                                                            variant={
                                                                attendance.attendance_status === 'Present' ? 'default' :
                                                                    attendance.attendance_status === 'Absent' ? 'destructive' :
                                                                        attendance.attendance_status === 'Excused' ? 'secondary' :
                                                                            attendance.attendance_status === 'Late' ? 'outline' : 'outline'
                                                            }
                                                            className="text-sm px-3 py-1 font-medium"
                                                        >
                                                            {attendance.attendance_status}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-sm px-3 py-1">
                                                            No record
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button asChild
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                        <Link to="/family/attendance"
                                              className="flex items-center justify-center gap-2">
                                            <Eye className="h-5 w-5"/>
                                            View Full Attendance History
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3"/>
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">No attendance records
                                        found.</p>
                                    {family?.students && family.students.length > 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-500">
                                            Attendance will appear here once students start attending classes.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-gray-500 dark:text-gray-500">
                                            Add students to track their attendance.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Guardians Section */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <Users className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Guardians</h2>
                            </div>
                            {(!family.guardians || family.guardians.length < 1) && (
                                <Alert variant="destructive" className="mb-4">
                                    <AlertCircle className="h-4 w-4"/>
                                    <AlertTitle>No Guardians Found</AlertTitle>
                                    <AlertDescription>
                                        Please add at least one guardian to manage the family account.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {family.guardians && family.guardians.length > 0 ? (
                                <div className="space-y-3 mb-6">
                                    {family.guardians.map((guardian) => (
                                        <Link
                                            key={guardian.id}
                                            to={`/family/guardian/${guardian.id}`}
                                            className="block p-4 form-card-styles rounded-lg border-l-4 border-green-500 hover:shadow-md transition-shadow duration-300 group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                                                    <Users className="h-4 w-4 text-green-600"/>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 dark:text-gray-100 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                                                        {guardian.first_name} {guardian.last_name}
                                                    </p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                                        {guardian.relationship}
                                                    </p>
                                                </div>
                                                <div
                                                    className="text-green-600 group-hover:text-green-700 transition-colors">
                                                    <Eye className="h-5 w-5"/>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 mb-6">
                                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3"/>
                                    <p className="text-gray-600 dark:text-gray-400 mb-2">No guardians added yet.</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-500">Add a guardian to manage the
                                        family account.</p>
                                </div>
                            )}
                            {/* Link to a future page for adding a guardian */}
                            <Button asChild
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                <Link to="/family/add-guardian" className="flex items-center justify-center gap-2">
                                    <Plus className="h-5 w-5"/>
                                    Add Guardian
                                </Link>
                            </Button>
                            {family.guardians && family.guardians.length === 1 && (
                                <p className="text-sm text-muted-foreground mt-3">
                                    Consider adding a second guardian for backup contact purposes.
                                </p>
                            )}
                        </div>

                        {/* Waivers Section */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-green-600 rounded-lg">
                                    <Shield className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Waivers</h2>
                            </div>
                            {/* Display waiver status */}
                            {allWaiversSigned ? (
                                <div className="p-4 form-card-styles rounded-lg border-l-4 border-green-500 mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                                            <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400"/>
                                        </div>
                                        <p className="text-green-600 dark:text-green-400 font-medium">All required
                                            waivers signed.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Alert variant="destructive" className="mb-4 form-card-styles">
                                        <AlertCircle className="h-4 w-4"/>
                                        <AlertTitle>Action Required</AlertTitle>
                                        <AlertDescription>
                                            {pendingWaivers && pendingWaivers.length > 0 ? (
                                                <>You have {pendingWaivers.length} pending waiver{pendingWaivers.length > 1 ? 's' : ''} that need to be signed.</>
                                            ) : (
                                                <>Please sign all required waivers to complete your registration.</>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                    {/* Show list of pending waivers */}
                                    {pendingWaivers && pendingWaivers.length > 0 && (
                                        <div className="space-y-3 mb-6">
                                            {pendingWaivers.map((waiver, index) => (
                                                <div key={index}
                                                     className="p-3 form-card-styles rounded-lg border-l-4 border-orange-500">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded">
                                                            <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400"/>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                                                {waiver.waiver_name}
                                                            </p>
                                                            {waiver.program_name && waiver.student_name && (
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                                    Required for <span className="font-medium">{waiver.student_name}</span> - {waiver.program_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {/* Use asChild prop for correct Button/Link integration */}
                            <Button asChild
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                <Link to="/family/waivers" className="flex items-center justify-center gap-2">
                                    <Shield className="h-5 w-5"/>
                                    {allWaiversSigned ? 'View Waivers' : 'Sign Required Waivers'}
                                </Link>
                            </Button>
                        </div>

                        {/* Account Settings Section */}
                        <div
                            className="form-container-styles p-6 backdrop-blur-lg hover:shadow-lg transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-gray-500 rounded-lg">
                                    <Settings className="h-5 w-5 text-white"/>
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Account
                                    Settings</h2>
                            </div>
                            <div
                                className="p-4 form-card-styles rounded-lg border border-gray-100 dark:border-gray-700 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                                        <Settings className="h-4 w-4 text-gray-600"/>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-gray-100">Family
                                            Information</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                            Update your family information and account preferences.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <Button asChild
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                <Link to="/family/account" className="flex items-center justify-center gap-2">
                                    <Settings className="h-5 w-5"/>
                                    Manage Account
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </OfflineErrorBoundary>
    );
}
