import {json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node"; // Import redirect
import {Link, useLoaderData} from "@remix-run/react";
import {checkStudentEligibility, type EligibilityStatus, getSupabaseServerClient} from "~/utils/supabase.server"; // Import eligibility check
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
import {Database} from "~/types/database.types";
import {formatDate, getTodayLocalDateString} from "~/utils/misc"; // For formatting dates
import {beltColorMap} from "~/utils/constants"; // Import belt color mapping
import {useClientEffect} from "~/hooks/use-client-effect";
import {OfflineErrorBoundary} from "~/components/OfflineErrorBoundary";
import {cacheAttendanceData, cacheFamilyData, cacheUpcomingClasses} from "~/utils/offline-cache";
import {useClientReady} from "~/hooks/use-client-ready";
import {FamilyLoadingScreen} from "~/components/LoadingScreen";
import {SeminarEnrollmentsCard} from "~/components/SeminarEnrollmentsCard";

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
}

// Placeholder loader - will need to fetch actual family data later
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // This shouldn't happen if the route is protected by the layout,
        // but good practice to handle it.
        // Consider redirecting to login if needed, depending on layout setup.
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // 1. Get the user's profile to find their family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id, role') // Fetch family and role to decide onboarding path
        .eq('id', user.id)
        .single();

    if (profileError || !profileData) {
        console.error("Error fetching profile:", profileError?.message);
        // If profile doesn't exist, maybe redirect to a setup page or show an error
        return json({
            error: "Failed to load user profile.",
        }, {status: 500, headers});
    }

    if (profileData.role === 'admin') {
        return redirect('/admin', {headers});
    }

    if (profileData.role === 'instructor') {
        return redirect('/instructor', {headers});
    }

    if (!profileData.family_id) {
        console.warn("User authenticated but no family_id found. Redirecting to onboarding");
        return redirect("/onboarding", {headers});
    }

    // 2. Fetch the family data *and* its related students and guardians (without payments initially)
    const {data: familyBaseData, error: familyError} = await supabaseServer
        .from('families')
        .select(`
          *,
          students(*),
          guardians(*)
        `)
        .eq('id', profileData.family_id)
        .single(); // Fetch the single family record

    if (familyError || !familyBaseData) { // Check if familyBaseData itself is null/undefined
        console.error("Error fetching base family data:", familyError?.message ?? "Family not found");
        return json({
            profile: {familyId: String(profileData.family_id)},
            error: "Failed to load family data.",
            allWaiversSigned: false
        }, {status: 500, headers});
    }

    // 3. Fetch the single most recent *successful* payment separately
    const {data: recentPaymentData, error: paymentError} = await supabaseServer
        .from('payments')
        .select(`
            *,
            payment_students(student_id)
        `)
        .eq('family_id', profileData.family_id) // Filter by family_id
        .eq('status', 'succeeded')             // Filter by status
        .order('payment_date', {ascending: false, nullsFirst: false}) // Order by date
        .order('created_at', {ascending: false}) // Then by time
        .limit(1)                              // Limit to one
        .maybeSingle(); // Use maybeSingle as there might be no successful payments

    if (paymentError) {
        console.error("Error fetching recent payment data:", paymentError.message);
        // Don't fail the whole page, just proceed without payment info
    }

    // console.log("Most Recent Successful Payment Data:", recentPaymentData);

    // 4. Fetch eligibility, belt awards, and enrollments for each student
    const studentsWithEligibility: StudentWithEligibility[] = [];
    if (familyBaseData.students && familyBaseData.students.length > 0) {
        for (const student of familyBaseData.students) {
            const eligibility: EligibilityStatus =
                await checkStudentEligibility(student.id, supabaseServer);

            // Fetch current belt rank from belt awards
            const {data: beltAwards} = await supabaseServer
                .from('belt_awards')
                .select('type')
                .eq('student_id', student.id)
                .order('awarded_date', {ascending: false})
                .limit(1)
                .maybeSingle();

            // Fetch active enrollments with class and program info
            const {data: enrollments} = await supabaseServer
                .from('enrollments')
                .select(`
                    status,
                    classes (
                        name
                    ),
                    programs (
                        name
                    )
                `)
                .eq('student_id', student.id)
                .eq('status', 'active');

            const activeEnrollments = enrollments?.map(enrollment => ({
                class_name: enrollment.classes?.name || 'Unknown Class',
                program_name: enrollment.programs?.name || 'Unknown Program',
                status: enrollment.status
            })) || [];

            studentsWithEligibility.push({
                ...student,
                eligibility: eligibility,
                currentBeltRank: beltAwards?.type || null,
                activeEnrollments: activeEnrollments,
            });
        }
    }

    // Combine base family data, students with eligibility, and the single payment (if found)
    const finalFamilyData: FamilyData = {
        ...familyBaseData,
        students: studentsWithEligibility,
        payments: recentPaymentData ? [recentPaymentData] : [], // Add payment as an array (or empty array)
    };


    // 5. Fetch required waivers and user's signatures to determine status
    let allWaiversSigned = false;
    const pendingWaivers: PendingWaiver[] = [];

    try {
        // Check general required waivers
        const {data: requiredWaivers, error: requiredWaiversError} = await supabaseServer
            .from('waivers')
            .select('id, title')
            .eq('required', true);

        if (requiredWaiversError) throw requiredWaiversError;

        // Get user's signed waivers
        const {data: signedWaivers, error: signedWaiversError} = await supabaseServer
            .from('waiver_signatures')
            .select('waiver_id')
            .eq('user_id', user.id);

        if (signedWaiversError) throw signedWaiversError;

        const signedWaiverIds = new Set(signedWaivers?.map(s => s.waiver_id) || []);

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

        // Check program-specific waivers for each student's enrollments
        if (studentsWithEligibility.length > 0) {
            for (const student of studentsWithEligibility) {
                // Get active enrollments with program waiver requirements
                const {data: enrollmentWaivers, error: enrollmentError} = await supabaseServer
                    .from('enrollments')
                    .select(`
                        id,
                        programs!inner(
                            name,
                            required_waiver:waivers(
                                id,
                                title
                            )
                        )
                    `)
                    .eq('student_id', student.id)
                    .in('status', ['active', 'trial'])
                    .not('programs.required_waiver_id', 'is', null);

                if (enrollmentError) {
                    console.error('Error fetching enrollment waivers:', enrollmentError);
                    continue;
                }

                // Check each enrollment's required waiver
                enrollmentWaivers?.forEach(enrollment => {
                    // Supabase returns required_waiver as an array, so get the first element
                    const waiverArray = enrollment.programs?.required_waiver;
                    const waiver = Array.isArray(waiverArray) && waiverArray.length > 0 ? waiverArray[0] : null;

                    if (waiver && !signedWaiverIds.has(waiver.id)) {
                        // Add to pending list if not already there
                        const exists = pendingWaivers.some(pw => pw.waiver_id === waiver.id && pw.enrollment_id === enrollment.id);
                        if (!exists) {
                            pendingWaivers.push({
                                waiver_id: waiver.id,
                                waiver_name: waiver.title,
                                program_name: enrollment.programs?.name,
                                student_name: `${student.first_name} ${student.last_name}`,
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

    // 6. Fetch upcoming class sessions for enrolled students (one per student)
    let upcomingClasses: UpcomingClassSession[] = [];

    if (studentsWithEligibility.length > 0) {
        try {
            const upcomingClassesPromises = studentsWithEligibility.map(async (student) => {
                const {data} = await supabaseServer
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
                    .eq('classes.enrollments.student_id', student.id)
                    .in('classes.enrollments.status', ['active', 'trial'])
                    .gte('session_date', getTodayLocalDateString()) // Only future sessions
                    .order('session_date', {ascending: true})
                    .order('start_time', {ascending: true})
                    .limit(1); // Limit to next 1 session per student

                return data?.[0] ? {
                    student_id: data[0].classes.enrollments[0].student_id,
                    student_name: `${data[0].classes.enrollments[0].students.first_name} ${data[0].classes.enrollments[0].students.last_name}`,
                    class_name: data[0].classes.name,
                    session_date: data[0].session_date,
                    start_time: data[0].start_time,
                    end_time: data[0].end_time,
                    instructor_name: data[0].instructor ? `${data[0].instructor.first_name} ${data[0].instructor.last_name}` : undefined
                } : null;
            });

            const upcomingClassesResults = await Promise.all(upcomingClassesPromises);
            upcomingClasses = upcomingClassesResults.filter(Boolean) as UpcomingClassSession[];
        } catch (error) {
            console.error('Error processing upcoming class sessions:', error);
        }
    }

    // 7. Fetch attendance data for each student (last session date and status)
    let studentAttendanceData: StudentAttendance[] = [];

    if (studentsWithEligibility.length > 0) {
        try {
            const attendancePromises = studentsWithEligibility.map(async (student) => {
                const {data, error} = await supabaseServer
                    .from('attendance')
                    .select(`
                        status,
                        class_sessions!inner(
                            session_date
                        )
                    `)
                    .eq('student_id', student.id)
                    .not('class_session_id', 'is', null) // Only get records with valid class sessions
                    .order('class_sessions(session_date)', {ascending: false}) // Fixed ordering syntax
                    .limit(1);

                if (error) {
                    console.error(`Error fetching attendance for student ${student.id}:`, error);
                }

                return {
                    student_id: student.id,
                    student_name: `${student.first_name} ${student.last_name}`,
                    last_session_date: data?.[0]?.class_sessions?.session_date || undefined,
                    attendance_status: data?.[0]?.status === 'present' ? 'Present' as const :
                        data?.[0]?.status === 'absent' ? 'Absent' as const :
                            data?.[0]?.status === 'excused' ? 'Excused' as const :
                                data?.[0]?.status === 'late' ? 'Late' as const : undefined
                };
            });

            studentAttendanceData = await Promise.all(attendancePromises);
        } catch (error) {
            console.error('Error fetching attendance data:', error);
        }
    }

    // 7. Fetch seminar enrollments for the family
    const seminarEnrollments: Array<{
        id: string;
        status: string;
        class: {
            id: string;
            name: string;
            series_label?: string;
            series_start_on?: string;
            series_end_on?: string;
            series_session_quota?: number;
            program: {
                name: string;
                engagement_type: string;
            };
        };
        student: {
            id: string;
            first_name: string;
            last_name: string;
            is_adult: boolean;
        };
    }> = [];

    if (studentsWithEligibility.length > 0) {
        try {
            const studentIds = studentsWithEligibility.map(s => s.id);
            const { data: enrollmentsData } = await supabaseServer
                .from('enrollments')
                .select(`
                    id,
                    status,
                    class:classes!inner(
                        id,
                        name,
                        series_label,
                        series_start_on,
                        series_end_on,
                        series_session_quota,
                        program:programs!inner(
                            name,
                            engagement_type
                        )
                    ),
                    student:students!inner(
                        id,
                        first_name,
                        last_name,
                        is_adult
                    )
                `)
                .in('student_id', studentIds)
                .eq('classes.programs.engagement_type', 'seminar')
                .in('status', ['active', 'trial', 'waitlist']);

            seminarEnrollments.push(...(enrollmentsData || []) as typeof seminarEnrollments);
        } catch (error) {
            console.error('Error fetching seminar enrollments:', error);
        }
    }

    // Return profile, combined family data, waiver status, upcoming classes, attendance data, and seminar enrollments
    return json({
        profile: {familyId: String(profileData.family_id)},
        family: finalFamilyData, // Use the combined data
        allWaiversSigned,
        pendingWaivers,
        upcomingClasses,
        studentAttendanceData,
        seminarEnrollments
    }, {headers});
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
    const {family, error, allWaiversSigned, pendingWaivers, upcomingClasses, studentAttendanceData} = loaderData;
    const seminarEnrollments = ('seminarEnrollments' in loaderData ? loaderData.seminarEnrollments : []) as Array<{
        id: string;
        status: string;
        class: {
            id: string;
            name: string;
            series_label?: string;
            series_start_on?: string;
            series_end_on?: string;
            series_session_quota?: number;
            program: {
                name: string;
                engagement_type: string;
            };
        };
        student: {
            id: string;
            first_name: string;
            last_name: string;
            is_adult: boolean;
        };
    }>;
    const isClientReady = useClientReady();
    const isSelfFamily = family?.family_type === 'self';

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
    const familyDisplayName = family.name || (isSelfFamily ? 'Your Seminar Portal' : 'Your Family Portal');
    const portalTagline = isSelfFamily
        ? 'Welcome to your seminar portal. Manage your registrations, schedules, and waivers.'
        : 'Welcome to your family portal. Manage students, view schedules, and track progress.';

    return (
        <OfflineErrorBoundary>
            <div className="min-h-screen page-background-styles text-foreground">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Header Section */}
                    <div className="text-center mb-12">
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                            {familyDisplayName}
                        </h1>
                        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
                            {portalTagline}
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
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                    {isSelfFamily ? 'Your Profile' : 'My Students'}
                                </h2>
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
                                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                                        {isSelfFamily ? 'Your seminar profile is almost ready.' : 'No students registered yet.'}
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-500">
                                        {isSelfFamily ? 'Complete your intake form details to get started.' : 'Add your first student to get started!'}
                                    </p>
                                </div>
                            )}
                            {/* Link to the new dedicated page for adding a student to the current family */}
                            {!isSelfFamily && (
                                <Button asChild
                                        className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-300">
                                    <Link to="/family/add-student" className="flex items-center justify-center gap-2">
                                        <Plus className="h-5 w-5"/>
                                        Add Student
                                    </Link>
                                </Button>
                            )}
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

                        {/* Seminar Enrollments Section */}
                        {seminarEnrollments && seminarEnrollments.length > 0 && (
                            <div className="form-container-styles backdrop-blur-lg">
                                <SeminarEnrollmentsCard
                                    enrollments={seminarEnrollments}
                                    isAdult={isSelfFamily}
                                />
                            </div>
                        )}

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
                        {!isSelfFamily && (
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
                        )}

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
