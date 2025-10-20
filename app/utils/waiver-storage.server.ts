import { getSupabaseAdminClient } from '~/utils/supabase.server';

/**
 * Upload a waiver PDF to Supabase Storage
 *
 * Stores PDFs in the 'waivers' bucket with RLS policies ensuring:
 * - Authenticated users can upload
 * - Users can only read their own family's waivers
 * - Admins can read all waivers
 *
 * @param pdfBuffer - PDF file as a Buffer
 * @param filename - Filename for the PDF (should be unique)
 * @returns Storage path (e.g., "waiver_abc123_JohnDoe_2025-01-19.pdf")
 * @throws Error if upload fails
 */
export async function uploadWaiverPDF(
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.storage
      .from('waivers')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw new Error(`Failed to upload waiver PDF: ${error.message}`);
    }

    if (!data?.path) {
      throw new Error('Upload succeeded but no path returned');
    }

    console.log(`[waiver-storage] PDF uploaded successfully: ${data.path}`);
    return data.path;
  } catch (error) {
    console.error('Error uploading waiver PDF:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to upload waiver PDF');
  }
}

/**
 * Download a waiver PDF from Supabase Storage
 *
 * @param path - Storage path returned from uploadWaiverPDF
 * @returns PDF as a Blob
 * @throws Error if download fails or file not found
 */
export async function downloadWaiverPDF(path: string): Promise<Blob> {
  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.storage
      .from('waivers')
      .download(path);

    if (error) {
      console.error('Supabase storage download error:', error);
      throw new Error(`Failed to download waiver PDF: ${error.message}`);
    }

    if (!data) {
      throw new Error('Download succeeded but no data returned');
    }

    return data;
  } catch (error) {
    console.error('Error downloading waiver PDF:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to download waiver PDF');
  }
}

/**
 * Get a signed URL for temporary access to a waiver PDF
 *
 * Useful for previewing PDFs without downloading
 *
 * @param path - Storage path
 * @param expiresIn - Seconds until URL expires (default: 1 hour)
 * @returns Signed URL that expires after the specified time
 * @throws Error if URL generation fails
 */
export async function getWaiverPDFSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.storage
      .from('waivers')
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Supabase storage signed URL error:', error);
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }

    if (!data?.signedUrl) {
      throw new Error('Signed URL generation succeeded but no URL returned');
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Error getting waiver PDF signed URL:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to get signed URL');
  }
}

/**
 * Delete a waiver PDF from Supabase Storage
 *
 * Use with caution - this permanently deletes the PDF
 *
 * @param path - Storage path
 * @throws Error if deletion fails
 */
export async function deleteWaiverPDF(path: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase.storage
      .from('waivers')
      .remove([path]);

    if (error) {
      console.error('Supabase storage delete error:', error);
      throw new Error(`Failed to delete waiver PDF: ${error.message}`);
    }

    console.log(`[waiver-storage] PDF deleted successfully: ${path}`);
  } catch (error) {
    console.error('Error deleting waiver PDF:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete waiver PDF');
  }
}

/**
 * Check if a waiver PDF exists in storage
 *
 * @param path - Storage path
 * @returns True if file exists, false otherwise
 */
export async function waiverPDFExists(path: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase.storage
      .from('waivers')
      .list('', {
        search: path,
      });

    if (error) {
      console.error('Supabase storage list error:', error);
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error('Error checking waiver PDF existence:', error);
    return false;
  }
}
