import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, Outlet } from "@remix-run/react";

import { FileText, Eye, Edit } from "lucide-react";
import { getInvoiceEntityById, deactivateInvoiceEntity, reactivateInvoiceEntity } from "~/services/invoice-entity.server";

import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { formatDate } from "~/utils/misc";

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
          {/* Title and Status */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-indigo-100 dark:border-indigo-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold leading-tight text-gray-900 dark:text-white sm:text-4xl">
                  {entity.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
                      entity.is_active
                        ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-300 dark:ring-green-500/30"
                        : "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/30"
                    }`}
                  >
                    <div className={`mr-1.5 h-2 w-2 rounded-full ${entity.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                    {entity.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-500/30">
                    {entity.entity_type}
                  </span>
                </div>
              </div>
              

            </div>
          </div>
        </div>

        {/* Entity Details */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Information */}
          <div className="lg:col-span-2">
            {/* Quick Actions */}
            <div className="mb-6 overflow-hidden bg-white dark:bg-gray-800 shadow-xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  Quick Actions
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Common actions for this entity
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Link
                    to={`/admin/invoices/new?entity_id=${entity.id}`}
                    className="group relative inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-indigo-500 hover:to-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all duration-200 transform hover:scale-105"
                  >
                    <FileText className="mr-2 h-5 w-5" />
                    Create New Invoice
                  </Link>
                  <Link
                    to={`/admin/invoices?entity_id=${entity.id}`}
                    className="group relative inline-flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white shadow-lg ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 transition-all duration-200 transform hover:scale-105"
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    View All Invoices
                  </Link>
                  <Link
                    to={`/admin/invoice-entities/${entity.id}/edit`}
                    className="group relative inline-flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white shadow-lg ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 transition-all duration-200 transform hover:scale-105"
                  >
                    <Edit className="mr-2 h-5 w-5" />
                    Edit Entity
                  </Link>
                </div>
              </div>
            </div>

            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow-xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  Entity Information
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Basic details and contact information
                </p>
              </div>
              <div className="px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Name
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-semibold bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {entity.name}
                    </dd>
                  </div>
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Type
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white font-semibold bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg capitalize">
                      {entity.entity_type}
                    </dd>
                  </div>
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Email
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {entity.email ? (
                        <a
                          href={`mailto:${entity.email}`}
                          className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {entity.email}
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          No email provided
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Phone
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {entity.phone ? (
                        <a
                          href={`tel:${entity.phone}`}
                          className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {entity.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          No phone provided
                        </span>
                      )}
                    </dd>
                  </div>
                  {(entity.address_line1 || entity.address_line2 || entity.city || entity.state || entity.postal_code) && (
                    <div className="group sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Address
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
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
                    <div className="group sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Notes
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
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
            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow-xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  Payment Terms
                </h3>
              </div>
              <div className="px-6 py-5">
                <dl className="space-y-4">
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Payment Terms
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {entity.payment_terms || (
                        <span className="text-gray-400 dark:text-gray-500 italic">
                          Not specified
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Metadata */}
            <div className="overflow-hidden bg-white dark:bg-gray-800 shadow-xl sm:rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  Metadata
                </h3>
              </div>
              <div className="px-6 py-5">
                <dl className="space-y-4">
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Created
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {formatDate(entity.created_at, {
                        type: 'datetime'
                      })}
                    </dd>
                  </div>
                  <div className="group">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Last Updated
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {formatDate(entity.updated_at, {
                        type: 'datetime'
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