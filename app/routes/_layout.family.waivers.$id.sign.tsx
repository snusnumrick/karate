import React, {useRef, useState} from 'react';
import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Form, useActionData, useLoaderData, useSubmit} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";
import {Button} from "~/components/ui/button";
import {Checkbox} from "~/components/ui/checkbox";
import {Label} from "~/components/ui/label";
import {Alert, AlertDescription} from "~/components/ui/alert";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { csrf } from "~/utils/csrf.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

export async function loader({request, params}: LoaderFunctionArgs) {
    const waiverId = params.id!;
    const {supabaseServer} = getSupabaseServerClient(request);

    // Get the current user
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect('/login?redirectTo=/family/waivers');
    }

    const {data: profile, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id, first_name, last_name')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        console.error('Error fetching profile for user:', user.id, profileError);
        throw new Response("User profile not found.", {status: 404});
    }

    let signerFirstName = profile.first_name || user.user_metadata?.first_name || '';
    let signerLastName = profile.last_name || user.user_metadata?.last_name || '';

    if (profile.family_id) {
        const {data: guardian} = await supabaseServer
            .from('guardians')
            .select('first_name, last_name')
            .eq('family_id', profile.family_id)
            .limit(1)
            .maybeSingle();

        if (guardian) {
            signerFirstName = guardian.first_name || signerFirstName;
            signerLastName = guardian.last_name || signerLastName;
        }
    }

    if (!signerFirstName && !signerLastName) {
        const fallback = user.email?.split('@')[0] ?? 'Participant';
        signerFirstName = fallback;
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

    // Get redirectTo parameter from URL
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');

    return json({
        waiver,
        userId: user.id,
        firstName: signerFirstName,
        lastName: signerLastName,
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
    const redirectTo = formData.get('redirectTo') as string;

    if (!signature || !agreement) {
        return json({
            success: false,
            error: !signature
                ? 'Signature is required'
                : 'You must agree to the terms'
        });
    }

    // Save the signature
    const {error} = await supabaseServer
        .from('waiver_signatures')
        .insert({
            waiver_id: waiverId,
            user_id: user.id,
            signature_data: signature,
            signed_at: new Date().toISOString(),
            agreement_version: waiverId, // Use waiverId as the version identifier
        });

    if (error) {
        console.error('Error saving signature:', error);
        return json({success: false, error: 'Failed to save signature'});
    }

    // Check for redirectTo parameter from form data
    if (redirectTo) {
        return redirect(redirectTo);
    }

    return redirect('/family/waivers');
}

export default function SignWaiver() {
    const {waiver, firstName, lastName, redirectTo} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const submit = useSubmit();

    const fullName = `${firstName} ${lastName}`;

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
                                >
                                    <span className="dark:text-gray-300">I, {fullName}, have read and agree to the terms outlined in this document.</span>
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
