import React, {useRef, useState} from 'react';
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useSubmit} from "@remix-run/react";
import {getSupabaseServerClient, getSupabaseAdminClient} from "~/utils/supabase.server";
import type {SupabaseClient} from "@supabase/supabase-js";
import {Button} from "~/components/ui/button";
import {Checkbox} from "~/components/ui/checkbox";
import {Label} from "~/components/ui/label";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { Users } from 'lucide-react';
import { generateWaiverPDF, generateWaiverFilename } from '~/utils/waiver-pdf-generator.server';
import { uploadWaiverPDF } from '~/utils/waiver-storage.server';

/**
 * Determine which students need to sign this waiver
 *
 * For registration waivers: all family students
 * For program waivers: students enrolled in programs requiring this waiver
 */
async function determineStudentsForWaiver(
    familyId: string,
    waiverId: string,
    supabase: SupabaseClient
) {
    // Check if it's a registration waiver or trial waiver
    const {data: waiver} = await supabase
        .from('waivers')
        .select('required_for_registration, required_for_trial')
        .eq('id', waiverId)
        .single();

    if (waiver?.required_for_registration || waiver?.required_for_trial) {
        // Registration/trial waiver applies to all students in the family
        const {data: students} = await supabase
            .from('students')
            .select('id, first_name, last_name')
            .eq('family_id', familyId)
            .order('first_name');
        return students || [];
    }

    // Program-specific waiver: find students enrolled in programs requiring it
    const {data: enrollments} = await supabase
        .from('enrollments')
        .select(`
            student:students!inner(
                id,
                first_name,
                last_name
            ),
            program:programs!inner(
                id,
                name,
                program_waivers!inner(
                    waiver_id
                )
            )
        `)
        .eq('program.program_waivers.waiver_id', waiverId)
        .eq('student.family_id', familyId)
        .in('status', ['active', 'trial', 'pending_waivers']);

    // Deduplicate students (a student might be enrolled in multiple programs)
    const uniqueStudents = new Map();
    enrollments?.forEach(e => {
        const student = Array.isArray(e.student) ? e.student[0] : e.student;
        if (student && !uniqueStudents.has(student.id)) {
            uniqueStudents.set(student.id, student);
        }
    });

    return Array.from(uniqueStudents.values());
}

export async function loader({request, params}: LoaderFunctionArgs) {
    const waiverId = params.id!;
    const {supabaseServer} = getSupabaseServerClient(request);

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect('/login?redirectTo=/family/waivers');
    }

    // Fetch user profile to get family_id
    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || !profile.family_id) {
        console.error('Error fetching profile or family_id for user:', user.id, profileError);
        // Handle appropriately - maybe redirect to a profile setup page or show an error
        // For now, throw an error indicating profile issue
        throw new Response("User profile or family association not found.", {status: 404});
    }

    // Fetch the first guardian associated with the family to get the name
    // Assumption: The logged-in user is one of the guardians. We take the first one found.
    const {data: guardian, error: guardianError} = await supabaseServer
        .from('guardians')
        .select('first_name, last_name')
        .eq('family_id', profile.family_id)
        .limit(1) // Get the first guardian listed for the family
        .single();

    if (guardianError || !guardian) {
        console.error('Error fetching guardian for family_id:', profile.family_id, guardianError);
        // Handle appropriately - maybe show an error
        throw new Response("Guardian information not found for this family.", {status: 404});
    }

    // Check if waiver exists
    const {data: waiver, error} = await supabaseServer
        .from('waivers')
        .select('*')
        .eq('id', waiverId)
        .single();

    if (error || !waiver) {
        return redirect('/family/waivers');
    }

    // Check if already signed
    const {data: existingSignature} = await supabaseServer
        .from('waiver_signatures')
        .select('*')
        .eq('waiver_id', waiverId)
        .eq('user_id', user.id)
        .single();

    if (existingSignature) {
        return redirect('/family/waivers');
    }

    // Determine which students need this waiver
    const studentsNeedingWaiver = await determineStudentsForWaiver(
        profile.family_id,
        waiverId,
        supabaseServer
    );

    if (!studentsNeedingWaiver || studentsNeedingWaiver.length === 0) {
        console.warn(`No students found for waiver ${waiverId} and family ${profile.family_id}`);
        // Still allow signing, but log the warning
    }

    // Get redirectTo parameter from URL
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');

    return json({
        waiver,
        userId: user.id,
        firstName: guardian.first_name,
        lastName: guardian.last_name,
        studentsNeedingWaiver,
        redirectTo
    });
}

export async function action({request, params}: ActionFunctionArgs) {
    const waiverId = params.id!;
    const {supabaseServer} = getSupabaseServerClient(request);

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json({success: false, error: 'User not authenticated'});
    }

    await csrf.validate(request);
    const formData = await request.formData();
    const signature = formData.get('signature') as string;
    const agreement = formData.get('agreement') === 'on';
    const studentIdsJson = formData.get('studentIds') as string;
    const redirectTo = formData.get('redirectTo') as string;

    if (!signature || !agreement) {
        return json({
            success: false,
            error: !signature
                ? 'Signature is required'
                : 'You must agree to the terms'
        });
    }

    // Parse student IDs
    let studentIds: string[] = [];
    try {
        if (studentIdsJson) {
            studentIds = JSON.parse(studentIdsJson);
        }
    } catch (e) {
        console.error('Error parsing student IDs:', e);
        return json({success: false, error: 'Invalid student data'});
    }

    if (studentIds.length === 0) {
        console.warn('No student IDs provided - waiver will not be linked to specific students');
    }

    // Fetch data needed for PDF generation
    const supabaseAdmin = getSupabaseAdminClient();

    const {data: waiver} = await supabaseAdmin
        .from('waivers')
        .select('id, title, content')
        .eq('id', waiverId)
        .single();

    const {data: profile} = await supabaseAdmin
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (!profile?.family_id) {
        console.error('No family_id found for user:', user.id);
        return json({success: false, error: 'Family information not found'});
    }

    const {data: guardian} = await supabaseAdmin
        .from('guardians')
        .select('first_name, last_name')
        .eq('family_id', profile.family_id)
        .limit(1)
        .single();

    const {data: students} = await supabaseAdmin
        .from('students')
        .select('id, first_name, last_name')
        .in('id', studentIds);

    if (!waiver || !guardian || !students) {
        console.error('Missing data for PDF generation:', {waiver: !!waiver, guardian: !!guardian, students: !!students});
        return json({success: false, error: 'Failed to retrieve waiver data'});
    }

    try {
        // Generate unique signature ID
        const signatureId = crypto.randomUUID();
        const signedAt = new Date().toISOString();

        // Generate PDF
        const pdfBuffer = await generateWaiverPDF({
            waiver: {
                id: waiver.id,
                title: waiver.title,
                content: waiver.content,
            },
            signature: {
                id: signatureId,
                signedAt: signedAt,
                signatureImage: signature,
            },
            guardian: {
                firstName: guardian.first_name,
                lastName: guardian.last_name,
            },
            students: students.map(s => ({
                id: s.id,
                firstName: s.first_name,
                lastName: s.last_name,
            })),
        });

        // Upload PDF to storage
        const filename = generateWaiverFilename(
            waiverId,
            students.map(s => `${s.first_name}_${s.last_name}`)
        );
        const pdfPath = await uploadWaiverPDF(pdfBuffer, filename);

        // Save signature with student IDs and PDF path
        const {error} = await supabaseAdmin
            .from('waiver_signatures')
            .insert({
                id: signatureId,
                waiver_id: waiverId,
                user_id: user.id,
                student_ids: studentIds,
                signature_data: signature,
                signed_at: signedAt,
                agreement_version: waiverId,
                pdf_storage_path: pdfPath,
            });

        if (error) {
            console.error('Error saving signature:', error);
            return json({success: false, error: 'Failed to save signature'});
        }

        console.log(`[waiver-sign] Signature saved successfully: ${signatureId}, PDF: ${pdfPath}`);

    } catch (error) {
        console.error('Error generating/saving waiver PDF:', error);
        return json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate waiver PDF'
        });
    }

    // Check for redirectTo parameter from form data
    if (redirectTo) {
        return redirect(redirectTo);
    }

    return redirect('/family/waivers');
}

export default function SignWaiver() {
    const {waiver, firstName, lastName, studentsNeedingWaiver, redirectTo} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const submit = useSubmit();

    const fullName = `${firstName} ${lastName}`;

    // Format student names for display
    const studentNames = studentsNeedingWaiver?.map(s => `${s.first_name} ${s.last_name}`) || [];
    const studentNamesText = studentNames.length === 1
        ? studentNames[0]
        : studentNames.length === 2
        ? `${studentNames[0]} and ${studentNames[1]}`
        : studentNames.length > 2
        ? `${studentNames.slice(0, -1).join(', ')}, and ${studentNames[studentNames.length - 1]}`
        : 'your students';

    const [signatureData, setSignatureData] = useState('');
    const [isAgreed, setIsAgreed] = useState(false);
    const [error, setError] = useState('');

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    function startDrawing(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
        isDrawing.current = true;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set stroke color based on theme
        const isDarkMode = document.documentElement.classList.contains('dark');
        ctx.strokeStyle = isDarkMode ? '#ffffff' : '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();

        // Get position based on event type
        let clientX, clientY;

        if ('touches' in e) {
            // Touch event
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.moveTo(x, y);
    }

    function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
        if (!isDrawing.current) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure stroke color is maintained
        const isDarkMode = document.documentElement.classList.contains('dark');
        ctx.strokeStyle = isDarkMode ? '#ffffff' : '#000000';

        // Get position based on event type
        let clientX, clientY;

        if ('touches' in e) {
            // Touch event
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;

            // Prevent scrolling when drawing
            e.preventDefault();
        } else {
            // Mouse event
            clientX = e.clientX;
            clientY = e.clientY;
        }

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        ctx.lineTo(x, y);
        ctx.stroke();
    }

    function stopDrawing() {
        isDrawing.current = false;

        // Save the signature data
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Create a new canvas for saving with proper colors
                const saveCanvas = document.createElement('canvas');
                saveCanvas.width = canvas.width;
                saveCanvas.height = canvas.height;
                const saveCtx = saveCanvas.getContext('2d');
                
                if (saveCtx) {
                    // Keep transparent background - don't fill with white
                    
                    // Check if we're in dark mode
                    const isDarkMode = document.documentElement.classList.contains('dark');
                    
                    if (isDarkMode) {
                        // In dark mode, we drew with white, but need to save as black
                        // First draw the original canvas
                        saveCtx.drawImage(canvas, 0, 0);
                        
                        // Get image data and convert white strokes to black
                        const imageData = saveCtx.getImageData(0, 0, saveCanvas.width, saveCanvas.height);
                        const data = imageData.data;
                        
                        for (let i = 0; i < data.length; i += 4) {
                            const r = data[i];
                            const g = data[i + 1];
                            const b = data[i + 2];
                            const a = data[i + 3];
                            
                            // If pixel is white or light (signature stroke), make it black
                            if (r > 200 && g > 200 && b > 200 && a > 0) {
                                data[i] = 0;     // R
                                data[i + 1] = 0; // G
                                data[i + 2] = 0; // B
                                // Keep alpha as-is for transparency
                            }
                        }
                        
                        saveCtx.putImageData(imageData, 0, 0);
                    } else {
                        // In light mode, just copy the canvas as-is (already black ink)
                        saveCtx.drawImage(canvas, 0, 0);
                    }
                    
                    setSignatureData(saveCanvas.toDataURL());
                }
            }
        }
    }

    function clearSignature(e: React.MouseEvent<HTMLButtonElement>) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData('');
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (!signatureData) {
            setError('Please sign the document');
            return;
        }

        if (!isAgreed) {
            setError('You must agree to the terms');
            return;
        }

        const form = e.target as HTMLFormElement;
        submit(form, {method: 'post'});
    }

    return (
        <div className="min-h-screen page-background-styles py-12 text-foreground">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <AppBreadcrumb items={breadcrumbPatterns.familyWaiverSign(waiver.title, waiver.id)} className="mb-6" />
                
                {/* Page Header */}
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-extrabold page-header-styles sm:text-4xl">
                        Sign Waiver
                    </h1>
                    <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400 sm:mt-4">
                        {waiver.title}
                    </p>
                </div>

                {/* Student Information Alert */}
                {studentsNeedingWaiver && studentsNeedingWaiver.length > 0 && (
                    <Alert className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                        <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <AlertTitle className="text-blue-900 dark:text-blue-100">
                            Students Covered by This Waiver
                        </AlertTitle>
                        <AlertDescription className="text-blue-800 dark:text-blue-200">
                            This waiver will be signed on behalf of:
                            <ul className="mt-2 list-disc list-inside space-y-1">
                                {studentsNeedingWaiver.map(student => (
                                    <li key={student.id} className="font-medium">
                                        {student.first_name} {student.last_name}
                                    </li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="form-container-styles p-8 backdrop-blur-lg">
                    <div className="mb-8 p-6 border rounded bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
                        <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                            {waiver.content}
                        </div>
                    </div>

                    <Form method="post" onSubmit={handleSubmit}>
                        <AuthenticityTokenInput />
                        <div className="mb-6">
                            <h2 className="text-xl font-semibold mb-2">Your Signature</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Please sign below using your mouse or finger on touch devices.
                            </p>

                            <div className="border rounded p-1 bg-white dark:bg-gray-800 dark:border-gray-700">
                                <canvas
                                    ref={canvasRef}
                                    width={600}
                                    height={150}
                                    className="w-full border border-gray-300 dark:border-gray-600 touch-none dark:bg-gray-700"
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                />
                            </div>

                            <input type="hidden" name="signature" value={signatureData}/>
                            <input
                                type="hidden"
                                name="studentIds"
                                value={JSON.stringify(studentsNeedingWaiver?.map(s => s.id) || [])}
                            />
                            {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo}/>}

                            <button
                                type="button"
                                onClick={clearSignature}
                                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                aria-label="Clear signature"
                            >
                                Clear Signature
                            </button>
                        </div>

                        <div className="mb-6">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="agreement"
                                    name="agreement"
                                    checked={isAgreed}
                                    onCheckedChange={(checked) => setIsAgreed(Boolean(checked))}
                                    aria-describedby="agreement-description"
                                />
                                <Label
                                    htmlFor="agreement"
                                    id="agreement-description"
                                    className="cursor-pointer"
                                >
                                    <span className="dark:text-gray-300">
                                        I, {fullName},
                                        {studentsNeedingWaiver && studentsNeedingWaiver.length > 0 && (
                                            <> on behalf of <span className="font-semibold">{studentNamesText}</span>,</>
                                        )} have read and agree to the terms outlined in this document.
                                    </span>
                                </Label>
                            </div>
                        </div>

                        {(error || actionData?.error) && (
                            <Alert variant="destructive" className="mb-4 dark:border-red-800 dark:bg-red-900/20">
                                <AlertDescription className="dark:text-red-300">{error || actionData?.error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-end space-x-4">
                            <Button asChild variant="outline">
                                <a href="/family/waivers">Cancel</a>
                            </Button>
                            <Button
                                type="submit"
                                disabled={!isAgreed || !signatureData}
                            >
                                Submit Signature
                            </Button>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    );
}
