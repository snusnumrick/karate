import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { searchInvoiceEntities } from "~/services/invoice-entity.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");

  if (!query || query.length < 2) {
    return json({ entities: [] });
  }

  try {
    const entities = await searchInvoiceEntities(query);
    return json({ entities });
  } catch (error) {
    console.error("Error searching invoice entities:", error);
    return json({ entities: [], error: "Failed to search entities" }, { status: 500 });
  }
}