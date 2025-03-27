import { useState, useRef } from 'react';
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSubmit } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const waiverId = params.id!;
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get the current user
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    return redirect('/login?redirectTo=/waivers');
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
  
  return json({ waiver, userId: user.id });
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
  const { waiver, userId } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  
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
  
  function clearSignature() {
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Sign: {waiver.title}</h1>
      
      <div className="mb-8 p-6 border rounded bg-gray-50">
        <div dangerouslySetInnerHTML={{ __html: waiver.content }} />
      </div>
      
      <Form method="post" onSubmit={handleSubmit}>
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Your Signature</h2>
          <p className="text-sm text-gray-600 mb-4">
            Please sign below using your mouse or finger on touch devices.
          </p>
          
          <div className="border rounded p-1 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full border border-gray-300 touch-none"
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
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Clear Signature
          </button>
        </div>
        
        <div className="mb-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="agreement"
              checked={isAgreed}
              onChange={(e) => setIsAgreed(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <span className="ml-2">
              I, {userId}, have read and agree to the terms outlined in this document.
            </span>
          </label>
        </div>
        
        {(error || actionData?.error) && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
            {error || actionData?.error}
          </div>
        )}
        
        <div className="flex justify-end space-x-4">
          <a
            href="/waivers"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Submit Signature
          </button>
        </div>
      </Form>
    </div>
  );
}
