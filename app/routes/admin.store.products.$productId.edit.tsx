import { Form, Link, useActionData, useLoaderData, useNavigation, useSubmit } from "@remix-run/react"; // Added useSubmit
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button, buttonVariants } from "~/components/ui/button"; // Import buttonVariants
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useState } from 'react'; // Import useState
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { type ActionFunctionArgs, type LoaderFunctionArgs, json, redirect, TypedResponse } from "@remix-run/node"; // Added redirect
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "~/components/ui/alert-dialog"; // Added AlertDialog components
import type { Database, Tables, TablesUpdate } from "~/types/database.types"; // Added Database
import { ArrowLeft, Trash2 } from "lucide-react"; // Added Trash2 icon
import { createClient } from "@supabase/supabase-js"; // Import Supabase client for storage

// Define constants at module scope
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type ProductRow = Tables<'products'>;
type ProductUpdate = TablesUpdate<'products'>;

type LoaderData = {
    product: ProductRow;
};

type ActionData = {
    success?: boolean;
    message?: string;
    error?: string;
    fieldErrors?: { [key: string]: string };
};

// Loader function to fetch product data
export async function loader({ request, params }: LoaderFunctionArgs) {
    const productId = params.productId;
    if (!productId) {
        throw new Response("Product ID is required", { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { supabaseServer, response } = getSupabaseServerClient(request);

    const { data: product, error } = await supabaseServer
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

    if (error || !product) {
        console.error(`Error fetching product ${productId}:`, error?.message);
        throw new Response("Product not found", { status: 404 });
    }

    return json({ product }, { headers: response.headers });
}

// Action function to handle form submission
export async function action({ request, params }: ActionFunctionArgs): Promise<TypedResponse<ActionData | never>> {
    const productId = params.productId;
    if (!productId) {
        return json({ error: "Product ID is missing." }, { status: 400 });
    }
    // Admin check happens in the parent _admin layout loader
    const { response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const formData = await request.formData();
    const intent = formData.get('intent') as string; // Get intent first

    // --- Handle Delete Intent ---
    if (intent === 'delete') {
        console.log(`[Action/DeleteProduct] Attempting delete for product ID: ${productId}`);
        const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); // Define admin client here
        const storageBucket = 'product-images';

        // 1. Fetch associated variant IDs
        const { data: variants, error: fetchVariantsError } = await supabaseAdmin
            .from('product_variants')
            .select('id')
            .eq('product_id', productId);

        if (fetchVariantsError) {
            console.error(`[Action/DeleteProduct] Error fetching variants for product ${productId}:`, fetchVariantsError.message);
            return json({ error: "Failed to fetch associated variants before deletion." }, { status: 500, headers });
        }

        const variantIds = variants?.map(v => v.id) || [];

        // 2. Check if any variants are linked to order items
        if (variantIds.length > 0) {
            const { count: orderItemCount, error: checkOrderItemsError } = await supabaseAdmin
                .from('order_items')
                .select('id', { count: 'exact', head: true })
                .in('variant_id', variantIds); // Check if any variant ID is in order_items

            if (checkOrderItemsError) {
                console.error(`[Action/DeleteProduct] Error checking order items for variants of product ${productId}:`, checkOrderItemsError.message);
                return json({ error: "Failed to check if variants are linked to orders." }, { status: 500, headers });
            }

            if (orderItemCount && orderItemCount > 0) {
                console.warn(`[Action/DeleteProduct] Cannot delete product ${productId}: Variants are linked to ${orderItemCount} order item(s).`);
                return json({ error: `Cannot delete product. Associated variants are part of existing orders and cannot be automatically deleted.` }, { status: 409, headers }); // 409 Conflict
            }

            // 3. Delete variants (since none are linked to orders)
            console.log(`[Action/DeleteProduct] Deleting ${variantIds.length} variants for product ${productId}...`);
            const { error: deleteVariantsError } = await supabaseAdmin
                .from('product_variants')
                .delete()
                .in('id', variantIds);

            if (deleteVariantsError) {
                console.error(`[Action/DeleteProduct] Error deleting variants for product ${productId}:`, deleteVariantsError.message);
                return json({ error: `Failed to delete associated variants: ${deleteVariantsError.message}` }, { status: 500, headers });
            }
            console.log(`[Action/DeleteProduct] Successfully deleted variants for product ${productId}.`);
        } else {
             console.log(`[Action/DeleteProduct] No variants found for product ${productId}.`);
        }


        // 4. Delete image from storage (if exists)
        const { data: productData, error: fetchError } = await supabaseAdmin
            .from('products')
            .select('image_url')
            .eq('id', productId)
            .single();

        if (fetchError) {
             console.error(`[Action/DeleteProduct] Error fetching product data for image deletion ${productId}:`, fetchError.message);
             // Proceed with DB deletion, but log the image issue
        } else if (productData?.image_url) {
            const imagePath = productData.image_url.substring(productData.image_url.lastIndexOf('/') + 1);
            console.log(`[Action/DeleteProduct] Deleting image ${imagePath} from storage for product ${productId}`);
            const { error: deleteImageError } = await supabaseAdmin.storage
                .from(storageBucket)
                .remove([imagePath]);
            if (deleteImageError) {
                // Log error but proceed with DB deletion
                console.error(`[Action/DeleteProduct] Failed to delete image ${imagePath} for product ${productId}:`, deleteImageError.message);
            }
        }

        // 5. Delete product from database
        const { error: deleteProductError } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', productId);

        if (deleteProductError) {
            console.error(`[Action/DeleteProduct] Error deleting product ${productId}:`, deleteProductError.message);
            return json({ error: `Failed to delete product: ${deleteProductError.message}` }, { status: 500, headers });
        }

        console.log(`[Action/DeleteProduct] Successfully deleted product ${productId}. Redirecting...`);
        return redirect("/admin/store/products", { headers }); // Redirect after successful deletion
    }
    // --- End Handle Delete Intent ---

    // --- Handle Edit Intent ---
    else if (intent === 'edit') { // Use else if and move all edit logic here
        const name = formData.get('name') as string;
        const description = formData.get('description') as string | null;
        const isActive = formData.get('is_active') === 'on';
        const imageFile = formData.get('image') as File | null;
        const removeImage = formData.get('remove_image') === 'true';

        // --- Validation ---
        const fieldErrors: { [key: string]: string } = {};
        if (!name) fieldErrors.name = "Product name is required.";

        // Image Validation
        let newImageUrl: string | null | undefined = undefined; // undefined means no change, null means remove

        if (removeImage) {
            newImageUrl = null; // Signal to remove the image URL
        } else if (imageFile && imageFile.size > 0) {
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

        // --- Fetch Current Product Data (for image deletion) ---
        const supabaseAdmin = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); // Define admin client here
        const { data: currentProduct, error: fetchError } = await supabaseAdmin
            .from('products')
            .select('image_url')
            .eq('id', productId)
            .single();

        if (fetchError) {
            console.error(`Error fetching current product data for ${productId}:`, fetchError.message);
            return json({ error: "Failed to retrieve current product data before update." }, { status: 500, headers });
        }
        const currentImageUrl = currentProduct?.image_url;

        // --- Upload New Image / Handle Removal ---
        const storageBucket = 'product-images';
        let oldImagePathToDelete: string | null = null;

        if (removeImage) {
            newImageUrl = null;
            if (currentImageUrl) {
                oldImagePathToDelete = currentImageUrl.substring(currentImageUrl.lastIndexOf('/') + 1);
            }
        } else if (imageFile && imageFile.size > 0) {
            // Upload new image
            const fileExt = imageFile.name.split('.').pop();
            const uniqueFileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `${uniqueFileName}`;

            const { error: uploadError } = await supabaseAdmin.storage
                .from(storageBucket)
                .upload(filePath, imageFile, { cacheControl: '3600', upsert: false });

            if (uploadError) {
                console.error("Error uploading new product image:", uploadError.message);
                return json({ error: `Failed to upload new image: ${uploadError.message}` }, { status: 500, headers });
            }

            const { data: urlData } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(filePath);
            if (!urlData?.publicUrl) {
                console.error("Failed to get public URL for new image:", filePath);
                return json({ error: "Image uploaded, but failed to get its public URL." }, { status: 500, headers });
            }
            newImageUrl = urlData.publicUrl;

            // Mark old image for deletion if it exists
            if (currentImageUrl) {
                oldImagePathToDelete = currentImageUrl.substring(currentImageUrl.lastIndexOf('/') + 1);
            }
        }
        // If newImageUrl remains undefined, the image_url field won't be updated.

        // --- Database Update ---
        const updateData: ProductUpdate = {
            name,
            description,
            is_active: isActive,
            updated_at: new Date().toISOString(),
        };
        // Only include image_url in update if it changed (new upload or removal)
        if (newImageUrl !== undefined) {
            updateData.image_url = newImageUrl;
        }

        const { error: updateError } = await supabaseAdmin // Use admin client
            .from('products')
            .update(updateData)
            .eq('id', productId);

        if (updateError) {
            console.error(`Error updating product ${productId}:`, updateError.message);
            // Attempt to delete newly uploaded image if DB update fails
            if (newImageUrl && newImageUrl !== currentImageUrl) { // Check if it's a new URL
                const pathToDelete = newImageUrl.substring(newImageUrl.lastIndexOf('/') + 1);
                await supabaseAdmin.storage.from(storageBucket).remove([pathToDelete]);
            }
            if (updateError.code === '23505') {
                 return json({ error: "A product with this name already exists.", fieldErrors: { name: "Name must be unique." } }, { status: 409, headers });
            }
            return json({ error: `Failed to update product: ${updateError.message}` }, { status: 500, headers });
        }

        // --- Delete Old Image from Storage (after successful DB update) ---
        if (oldImagePathToDelete) {
            // console.log(`Attempting to delete old image: ${oldImagePathToDelete}`);
            const { error: deleteError } = await supabaseAdmin.storage
                .from(storageBucket)
                .remove([oldImagePathToDelete]);
            if (deleteError) {
                // Log error but don't fail the request, DB update was successful
                console.error(`Failed to delete old product image ${oldImagePathToDelete}:`, deleteError.message);
            }
        }

        // Return success message
        return json({ success: true, message: "Product updated successfully." }, { headers });
    }
    // --- End Handle Edit Intent ---

    // If intent is missing or invalid
    else { // Handle invalid intent explicitly
        console.warn(`[Action] Invalid or missing intent received: ${intent}`);
        return json({ error: "Invalid form submission intent." }, { status: 400, headers });
    }
}


// Component for the Edit Product page
export default function EditProductPage() {
    const { product } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const submit = useSubmit(); // Get submit hook
    // const params = useParams(); // Removed unused params
    const isSubmitting = navigation.state === "submitting";
    const formIntent = navigation.formData?.get('intent'); // Get intent for loading state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog

    // Function to handle delete submission
    const handleDelete = () => {
        const formData = new FormData();
        formData.append('intent', 'delete');
        submit(formData, { method: 'post', replace: true }); // Use replace: true to prevent back button issues
        setIsDeleteDialogOpen(false); // Close dialog after initiating submit
    };

    // Use product data from loader as default values
    const defaultValues = {
        name: product.name,
        description: product.description || '',
        is_active: product.is_active,
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
             <Link to="/admin/store/products" className="inline-flex items-center text-sm text-blue-600 hover:underline">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Products
            </Link>
            <h1 className="text-2xl font-bold">Edit Product: {product.name}</h1>

            {actionData?.error && !actionData.fieldErrors && (
                <Alert variant="destructive" className="mb-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
             {actionData?.success && actionData.message && (
                <Alert variant="default" className="mb-4 bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{actionData.message}</AlertDescription>
                </Alert>
            )}

            <Form method="post" className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                {/* Hidden input for edit intent */}
                <input type="hidden" name="intent" value="edit" />
                {/* Product Name */}
                <div>
                    <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
                    <Input
                        id="name"
                        name="name"
                        required
                        defaultValue={defaultValues.name}
                        aria-invalid={!!actionData?.fieldErrors?.name}
                        aria-describedby="name-error"
                        className="input-custom-styles"
                        tabIndex={1}
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
                        defaultValue={defaultValues.description}
                        className="input-custom-styles"
                        tabIndex={2}
                    />
                </div>

                {/* Image Upload (Placeholder) */}
                {/* <div>
                    <Label htmlFor="image">Product Image</Label>
                    {product.image_url && <img src={product.image_url} alt={product.name} className="h-20 w-auto my-2 rounded" />}
                    <Input id="image" name="image" type="file" accept="image/*" />
                    <p className="text-sm text-muted-foreground mt-1">Upload a new image to replace the current one (optional).</p>
                </div>

                {/* Image Upload */}
                <div>
                    <Label htmlFor="image">Product Image</Label>
                    {product.image_url && (
                        <div className="my-2 relative group w-fit">
                            <img src={product.image_url} alt={product.name} className="h-24 w-auto rounded border" />
                            {/* Hidden input to signal removal */}
                            <input type="hidden" name="remove_image" id="remove_image_input" value="false" />
                            {/* Overlay button to remove image */}
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove current image"
                                onClick={() => {
                                    // Set hidden input value and potentially update UI state if needed
                                    const hiddenInput = document.getElementById('remove_image_input') as HTMLInputElement | null;
                                    if (hiddenInput) hiddenInput.value = 'true';
                                    // Optionally hide the image preview immediately
                                    const imgPreview = document.querySelector('#image-preview');
                                    if (imgPreview) imgPreview.remove(); // Or hide it
                                    // Disable file input?
                                    const fileInput = document.getElementById('image') as HTMLInputElement | null;
                                    if (fileInput) fileInput.value = ''; // Clear file input
                                    alert('Image marked for removal. Save changes to confirm.'); // Simple feedback
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Remove Image</span>
                            </Button>
                        </div>
                    )}
                    <Input
                        id="image"
                        name="image"
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(',')}
                        aria-invalid={!!actionData?.fieldErrors?.image}
                        aria-describedby="image-error"
                        className="input-custom-styles file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                        tabIndex={3}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                        {product.image_url ? 'Upload a new image to replace the current one.' : 'Upload an image.'} Max 5MB. JPG, PNG, WEBP, GIF.
                    </p>
                    {actionData?.fieldErrors?.image && (
                        <p id="image-error" className="text-sm text-destructive mt-1">{actionData.fieldErrors.image}</p>
                    )}
                </div>


                {/* Active Status */}
                <div className="flex items-center space-x-2 pt-2"> {/* Added padding top */}
                    <Switch
                        id="is_active"
                        name="is_active"
                        defaultChecked={defaultValues.is_active}
                        tabIndex={4}
                    />
                    <Label htmlFor="is_active">Active (Visible in store)</Label>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting} tabIndex={5}>
                        {isSubmitting ? "Saving Changes..." : "Save Changes"}
                    </Button>
                </div>
            </Form>

             {/* Link to Manage Variants (Add later) */}
             <div className="mt-8 pt-6 border-t">
                 <h2 className="text-xl font-semibold mb-4">Product Variants</h2>
                 <p className="text-gray-600 dark:text-gray-400 mb-4">Manage sizes, prices, and stock for this product.</p>
                 {/* Removed asChild as a test for React.Children.only error */}
                 <Link
                     to={`/admin/store/products/${product.id}/variants`} // Use absolute path
                     className={buttonVariants({ variant: "outline" })} // Use buttonVariants function
                 >
                     Manage Variants
                 </Link>
             </div>

             {/* Delete Section */}
             <div className="mt-8 pt-6 border-t border-destructive/50">
                 <h2 className="text-xl font-semibold text-destructive mb-2">Delete Product</h2>
                 <p className="text-gray-600 dark:text-gray-400 mb-4">
                     Permanently delete this product and its image. This action cannot be undone.
                     <strong className="block text-destructive">Associated variants NOT linked to any orders will also be deleted. Variants linked to orders will prevent deletion.</strong>
                 </p>
                 <Button
                     variant="destructive"
                     onClick={() => setIsDeleteDialogOpen(true)}
                     disabled={isSubmitting && formIntent === 'delete'}
                 >
                     <Trash2 className="mr-2 h-4 w-4" />
                     {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Delete Product'}
                 </Button>
             </div>

             {/* Delete Confirmation Dialog */}
             <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                 <AlertDialogContent>
                     <AlertDialogHeader>
                         <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                         <AlertDialogDescription>
                             This action cannot be undone. This will permanently delete the product
                             <span className="font-semibold"> {product.name}</span>, its image, and any associated variants <span className="font-semibold">that are not part of existing orders</span>.
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                         <AlertDialogCancel disabled={isSubmitting && formIntent === 'delete'}>Cancel</AlertDialogCancel>
                         {/* Action button now triggers the handleDelete function */}
                         <AlertDialogAction
                             onClick={handleDelete} // Call the submit handler
                             disabled={isSubmitting && formIntent === 'delete'}
                             className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                         >
                             {isSubmitting && formIntent === 'delete' ? 'Deleting...' : 'Confirm Delete'}
                         </AlertDialogAction>
                     </AlertDialogFooter>
                 </AlertDialogContent>
             </AlertDialog>

        </div>
    );
}
