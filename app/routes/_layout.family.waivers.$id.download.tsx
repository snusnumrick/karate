import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { downloadWaiverPDF } from "~/utils/waiver-storage.server";

/**
 * Download signed waiver PDF
 *
 * This route allows families to download their signed waiver PDFs.
 * Access control: Users can only download waivers they or their family signed.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    const signatureId = params.id!;
    const { supabaseServer } = getSupabaseServerClient(request);

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
        return redirect('/login?redirectTo=/family/waivers');
    }

    // Get user's family_id
    const { data: profile } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (!profile?.family_id) {
        throw new Response('Family not found', { status: 404 });
    }

    // Fetch the signature and verify access
    // User can download if:
    // 1. They signed it (user_id matches)
    // 2. OR it's for their family (any family member signed it)
    const { data: signature, error: signatureError } = await supabaseServer
        .from('waiver_signatures')
        .select(`
            id,
            pdf_storage_path,
            user_id,
            waiver:waivers(
                id,
                title
            )
        `)
        .eq('id', signatureId)
        .single();

    if (signatureError || !signature) {
        console.error('Signature not found:', signatureError);
        throw new Response('Waiver signature not found', { status: 404 });
    }

    // Verify the user who signed this waiver is in the same family
    const { data: signerProfile } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', signature.user_id)
        .single();

    if (signerProfile?.family_id !== profile.family_id) {
        console.warn(`User ${user.id} attempted to download waiver ${signatureId} from different family`);
        throw new Response('Unauthorized', { status: 403 });
    }

    // Check if PDF exists
    if (!signature.pdf_storage_path) {
        console.error(`Signature ${signatureId} has no PDF path`);
        throw new Response('PDF not available for this waiver', { status: 404 });
    }

    try {
        // Download PDF from storage
        const pdfBlob = await downloadWaiverPDF(signature.pdf_storage_path);
        const buffer = await pdfBlob.arrayBuffer();

        // Generate filename from waiver title
        const waiver = Array.isArray(signature.waiver) ? signature.waiver[0] : signature.waiver;
        const waiverTitle = waiver?.title || 'Waiver';
        const sanitizedTitle = waiverTitle.replace(/[^a-z0-9]/gi, '_');
        const filename = `${sanitizedTitle}_Signed.pdf`;

        // Return PDF as download
        return new Response(buffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': buffer.byteLength.toString(),
            },
        });
    } catch (error) {
        console.error('Error downloading waiver PDF:', error);
        throw new Response(
            'Failed to download PDF. Please try again or contact support.',
            { status: 500 }
        );
    }
}
