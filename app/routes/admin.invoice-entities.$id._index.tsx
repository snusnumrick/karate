import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { ArrowLeftIcon, PencilIcon, ArchiveBoxIcon, ArchiveBoxXMarkIcon } from "@heroicons/react/24/outline";
import { FileText, Eye, Edit } from "lucide-react";
import { getInvoiceEntityById, deactivateInvoiceEntity, reactivateInvoiceEntity } from "~/services/invoice-entity.server";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";

export async function loader({ params }: LoaderFunctionArgs) {
  const { id } = params;
  
  if (!id) {
    throw new Response("Entity ID is required", { status: 400 });
  }

  try {
    const entity = await getInvoiceEntityById(id);
    
    if (!entity) {
      throw new Response("Invoice entity not found", { status: 404 });
    }

    return json({ entity });
  } catch (error) {
    console.error("Error loading invoice entity:", error);
    throw new Response("Failed to load invoice entity", { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;
  const formData = await request.formData();
  const action = formData.get("action");

  if (!id) {
    return json({ error: "Entity ID is required" }, { status: 400 });
  }

  try {
    if (action === "deactivate") {
      await deactivateInvoiceEntity(id);
      return json({ success: true, message: "Entity deactivated successfully" });
    } else if (action === "reactivate") {
      await reactivateInvoiceEntity(id);
      return json({ success: true, message: "Entity reactivated successfully" });
    }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating entity status:", error);
    return json({ error: "Failed to update entity status" }, { status: 500 });
  }
}

export default function InvoiceEntityDetail() {
  const { entity } = useLoaderData<typeof loader>();

  const breadcrumbs = [
    { label: "Admin Dashboard", href: "/admin" },
    { label: "Invoice Entities", href: "/admin/invoice-entities" },
    { label: entity.name, current: true },
  ];

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <AppBreadcrumb items={breadcrumbs}  className="mb-6" />
      
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Link
                to="/admin/invoice-entities"
                className="mr-4 flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <ArrowLeftIcon className="mr-1 h-4 w-4" />
                Back to Entities
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <Link
                to={`/admin/invoice-entities/${entity.id}/edit`}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                <PencilIcon className="mr-1.5 h-4 w-4" />
                Edit
              </Link>
              <form method="post" className="inline">
                <input
                  type="hidden"
                  name="action"
                  value={entity.is_active ? "deactivate" : "reactivate"}
                />
                <button
                  type="submit"
                  className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    entity.is_active
                      ? "bg-red-600 text-white hover:bg-red-500 focus-visible:outline-red-600 dark:bg-red-500 dark:hover:bg-red-400"
                      : "bg-green-600 text-white hover:bg-green-500 focus-visible:outline-green-600 dark:bg-green-500 dark:hover:bg-green-400"
                  }`}
                  onClick={(e) => {
                    if (entity.is_active) {
                      if (!confirm("Are you sure you want to deactivate this entity?")) {
                        e.preventDefault();
                      }
                    }
                  }}
                >
                  {entity.is_active ? (
                    <>
                      <ArchiveBoxIcon className="mr-1.5 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <ArchiveBoxXMarkIcon className="mr-1.5 h-4 w-4" />
                      Reactivate
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
                {entity.name}
              </h1>
              <span
                className={`ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  entity.is_active
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                }`}
              >
                {entity.is_active ? "Active" : "Inactive"}
              </span>
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {entity.entity_type}
              </span>
            </div>
          </div>
        </div>

        {/* Entity Details */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Information */}
          <div className="lg:col-span-2">
            {/* Quick Actions */}
            <div className="mb-6 overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                  Quick Actions
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Common actions for this entity.
                </p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/admin/invoices/new?entity_id=${entity.id}`}
                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Create New Invoice
                  </Link>
                  <Link
                    to={`/admin/invoices?entity_id=${entity.id}`}
                    className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View All Invoices
                  </Link>
                  <Link
                    to={`/admin/invoice-entities/${entity.id}/edit`}
                    className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Entity
                  </Link>
                </div>
              </div>
            </div>

            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                  Entity Information
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Basic details and contact information.
                </p>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{entity.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">{entity.entity_type}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {entity.email ? (
                        <a
                          href={`mailto:${entity.email}`}
                          className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {entity.email}
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">No email provided</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {entity.phone ? (
                        <a
                          href={`tel:${entity.phone}`}
                          className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {entity.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">No phone provided</span>
                      )}
                    </dd>
                  </div>
                  {(entity.address_line1 || entity.address_line2 || entity.city || entity.state || entity.postal_code) && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <div className="whitespace-pre-line">
                          {[
                            entity.address_line1,
                            entity.address_line2,
                            [entity.city, entity.state, entity.postal_code].filter(Boolean).join(', ')
                          ].filter(Boolean).join('\n')}
                        </div>
                      </dd>
                    </div>
                  )}
                  {entity.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                      <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                        <div className="whitespace-pre-line">{entity.notes}</div>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          {/* Payment Terms & Metadata */}
          <div className="space-y-6">
            {/* Payment Terms */}
            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                  Payment Terms
                </h3>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Terms</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {entity.payment_terms || "Not specified"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Metadata */}
            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-5 sm:px-6">
                <h3 className="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                  Metadata
                </h3>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(entity.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                      {new Date(entity.updated_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  );
}

export function ErrorBoundary() {
  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-900">
      <AppBreadcrumb items={breadcrumbPatterns.adminInvoiceEntities()} />
      
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="text-sm text-red-700 dark:text-red-300">
            <h3 className="font-medium">Error Loading Invoice Entity</h3>
            <p className="mt-1">
              There was an error loading the invoice entity. Please try again or contact support if the problem persists.
            </p>
            <div className="mt-4">
              <Link
                to="/admin/invoice-entities"
                className="font-medium text-red-700 dark:text-red-300 underline hover:text-red-600 dark:hover:text-red-200"
              >
                Return to Invoice Entities
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}