import { useState, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSubmit } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const waiverId = params.id!;
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get the current user
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    return redirect('/login?redirectTo=/waivers');
  }

  // Fetch user profile to get family_id
  const { data: profile, error: profileError } = await supabaseServer
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.family_id) {
    console.error('Error fetching profile or family_id for user:', user.id, profileError);
    // Handle appropriately - maybe redirect to a profile setup page or show an error
    // For now, throw an error indicating profile issue
    throw new Response("User profile or family association not found.", { status: 404 });
  }

  // Fetch the first guardian associated with the family to get the name
  // Assumption: The logged-in user is one of the guardians. We take the first one found.
  const { data: guardian, error: guardianError } = await supabaseServer
    .from('guardians')
    .select('first_name, last_name')
    .eq('family_id', profile.family_id)
    .limit(1) // Get the first guardian listed for the family
    .single();

  if (guardianError || !guardian) {
    console.error('Error fetching guardian for family_id:', profile.family_id, guardianError);
    // Handle appropriately - maybe show an error
    throw new Response("Guardian information not found for this family.", { status: 404 });
  }

  // Check if waiver exists
  const { data: waiver, error } = await supabaseServer
    .from('waivers')
    .select('*')
    .eq('id', waiverId)
    .single();
    
  if (error || !waiver) {
    return redirect('/waivers');
  }
  
  // Check if already signed
  const { data: existingSignature } = await supabaseServer
    .from('waiver_signatures')
    .select('*')
    .eq('waiver_id', waiverId)
    .eq('user_id', user.id)
    .single();
    
  if (existingSignature) {
    return redirect('/waivers');
  }
  
  return json({ 
    waiver, 
    userId: user.id, 
    firstName: guardian.first_name, 
    lastName: guardian.last_name 
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const waiverId = params.id!;
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get the current user
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    return json({ success: false, error: 'User not authenticated' });
  }
  
  const formData = await request.formData();
  const signature = formData.get('signature') as string;
  const agreement = formData.get('agreement') === 'on';
  
  if (!signature || !agreement) {
    return json({ 
      success: false, 
      error: !signature 
        ? 'Signature is required' 
        : 'You must agree to the terms'
    });
  }
  
  // Save the signature
  const { error } = await supabaseServer
    .from('waiver_signatures')
    .insert({
      waiver_id: waiverId,
      user_id: user.id,
      signature_data: signature,
      signed_at: new Date().toISOString(),
    });
    
  if (error) {
    return json({ success: false, error: 'Failed to save signature' });
  }
  
  return redirect('/waivers');
}

export default function SignWaiver() {
  const { waiver, firstName, lastName } = useLoaderData<typeof loader>();
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
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.moveTo(x, y);
  }
  
  function draw(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
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
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  
  function stopDrawing() {
    isDrawing.current = false;
    
    // Save the signature data
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
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
    submit(form, { method: 'post' });
  }
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-6">Sign: {waiver.title}</h1>
      
      <div className="mb-8 p-6 border rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
        <div className="prose dark:prose-invert" dangerouslySetInnerHTML={{ __html: waiver.content }} />
      </div>
      
      <Form method="post" onSubmit={handleSubmit}>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Your Signature</h2>
          <p className="text-sm text-gray-600 mb-4">
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
          
          <input type="hidden" name="signature" value={signatureData} />
          
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
              aria-describedby="agreement-description" // For accessibility
            />
            <Label 
              htmlFor="agreement" 
              id="agreement-description" // For accessibility
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
            <a href="/waivers">Cancel</a>
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
  );
}
