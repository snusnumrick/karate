import { type ActionFunctionArgs, json, redirect, TypedResponse } from "@remix-run/node";
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import type { Database, TablesInsert } from "~/types/database.types";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@supabase/supabase-js"; // Import Supabase client for storage

// Define constants at module scope
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type ProductInsert = TablesInsert<'products'>;

type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Action function to handle form submission
export async function action({ request }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    // Admin check happens in the parent _admin layout loader
    const { response } = getSupabaseServerClient(request); // Removed unused supabaseServer
    const headers = response.headers;

    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string | null;
    const isActive = formData.get('is_active') === 'on';
    const imageFile = formData.get('image') as File | null; // Get the image file

    // --- Validation ---
    const fieldErrors: { [key: string]: string } = {};
    if (!name) fieldErrors.name = "Product name is required.";

    // Image Validation
    let imageUrl: string | null = null; // Keep imageUrl definition here

    if (imageFile && imageFile.size > 0) {
        if (imageFile.size > MAX_FILE_SIZE) {
            fieldErrors.image = "Image file size must be less than 5MB.";
        }
        if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
            fieldErrors.image = "Invalid image file type. Allowed types: JPG, PNG, WEBP, GIF.";
        }
    }

    if (Object.keys(fieldErrors).length > 0) {
        return json({ error: "Please fix the errors below.", fieldErrors }, { status: 400, headers });
    }

    // --- Upload Image (if provided) ---
    // Use admin client for storage operations
    const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const storageBucket = 'product-images'; // Ensure this bucket exists and is public

    if (imageFile && imageFile.size > 0) {
        const fileExt = imageFile.name.split('.').pop();
        const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${uniqueFileName}`; // Store at root of bucket for simplicity

        const { error: uploadError } = await supabaseAdmin.storage
            .from(storageBucket)
            .upload(filePath, imageFile, {
                cacheControl: '3600', // Cache for 1 hour
                upsert: false, // Don't overwrite existing (shouldn't happen with UUID)
            });

        if (uploadError) {
            console.error("Error uploading product image:", uploadError.message);
            return json({ error: `Failed to upload image: ${uploadError.message}` }, { status: 500, headers });
        }

        // Get the public URL
        const { data: urlData } = supabaseAdmin.storage
            .from(storageBucket)
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
            console.error("Failed to get public URL for uploaded image:", filePath);
            // Attempt cleanup? For now, return error.
            return json({ error: "Image uploaded, but failed to get its public URL." }, { status: 500, headers });
        }
        imageUrl = urlData.publicUrl;
    }

    // --- Database Insert ---
    const insertData: ProductInsert = {
        name,
        description,
        is_active: isActive,
        image_url: imageUrl, // Add the image URL
    };

    const { data: newProduct, error: insertError } = await supabaseAdmin // Use admin client for consistency
        .from('products')
        .insert(insertData)
        .select('id')
        .single();

    if (insertError) {
        console.error("Error inserting product:", insertError.message);
        // Attempt to delete uploaded image if DB insert fails
        if (imageUrl) {
            const pathToDelete = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
            await supabaseAdmin.storage.from(storageBucket).remove([pathToDelete]);
        }
        if (insertError.code === '23505') {
             return json({ error: "A product with this name already exists.", fieldErrors: { name: "Name must be unique." } }, { status: 409, headers });
        }
        return json({ error: `Failed to add product: ${insertError.message}` }, { status: 500, headers });
    }

    if (!newProduct?.id) {
         console.error("Product insert succeeded but no ID returned.");
         // Attempt to delete uploaded image
         if (imageUrl) {
             const pathToDelete = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
             await supabaseAdmin.storage.from(storageBucket).remove([pathToDelete]);
         }
         return json({ error: "Failed to add product: Could not retrieve new product ID." }, { status: 500, headers });
    }

    // Redirect to the product list page
    return redirect("/admin/store/products", { headers });
}


// Component for the Add Product page
export default function AddProductPage() {
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <Link to="/admin/store/products" className="inline-flex items-center text-sm text-blue-600 hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Products
            </Link>
            <h1 className="text-2xl font-bold">Add New Product</h1>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Form method="post" encType="multipart/form-data" className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                {/* Product Name */}
                <div>
                    <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        aria-invalid={!!actionData?.fieldErrors?.name}
                        aria-describedby="name-error"
                        className="input-custom-styles"
                    />
                    {actionData?.fieldErrors?.name && (
                        <p id="name-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.name}</p>
                    )}
                </div>

                {/* Description */}
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        className="input-custom-styles"
                    />
                </div>

                {/* Image Upload (Placeholder) */}
                {/* <div>
                    <Label htmlFor="image">Product Image</Label>
                    <Input id="image" name="image" type="file" accept="image/*" />
                    <p className="text-sm text-muted-foreground mt-1">Upload an image for the product (optional).</p>
                </div>

                {/* Image Upload */}
                <div>
                    <Label htmlFor="image">Product Image</Label>
                    <Input
                        id="image"
                        name="image"
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(',')} // Use defined allowed types
                        aria-invalid={!!actionData?.fieldErrors?.image}
                        aria-describedby="image-error"
                        className="my-6 file:mr-4 file:px-2 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                    />
                    <p className="text-sm text-muted-foreground mt-1">Optional. Max 5MB. Allowed types: JPG, PNG, WEBP, GIF.</p>
                    {actionData?.fieldErrors?.image && (
                        <p id="image-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.image}</p>
                    )}
                </div>

                {/* Active Status */}
                <div className="flex items-center space-x-2 pt-2"> {/* Added padding top */}
                    <Switch id="is_active" name="is_active" defaultChecked={true} />
                    <Label htmlFor="is_active">Active (Visible in store)</Label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Adding Product..." : "Add Product"}
                    </Button>
                </div>
            </Form>
        </div>
    );
}
