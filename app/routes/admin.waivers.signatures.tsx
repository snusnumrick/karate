import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Download, FileText } from "lucide-react";
import { formatDate } from "~/utils/misc";

interface WaiverSignature {
  id: string;
  signed_at: string;
  pdf_storage_path: string | null;
  waiver: {
    id: string;
    title: string;
  };
  user: {
    id: string;
    email: string | null;
  };
  family: {
    id: string;
    name: string;
  };
  students: Array<{
    id: string;
    first_name: string;
    last_name: string;
  }>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const supabaseAdmin = getSupabaseAdminClient();
  const url = new URL(request.url);
  const waiverId = url.searchParams.get('waiverId');

  try {
    // Build query
    let query = supabaseAdmin
      .from('waiver_signatures')
      .select(`
        id,
        signed_at,
        pdf_storage_path,
        student_ids,
        waiver_id,
        user_id
      `)
      .order('signed_at', { ascending: false });

    if (waiverId) {
      query = query.eq('waiver_id', waiverId);
    }

    const { data: signatures, error: signaturesError } = await query;

    if (signaturesError) {
      console.error('Error fetching waiver signatures:', signaturesError);
      throw new Response('Failed to load waiver signatures', { status: 500 });
    }

    // Fetch all unique waivers for filter dropdown
    const { data: waivers } = await supabaseAdmin
      .from('waivers')
      .select('id, title')
      .order('title');

    if (!signatures || signatures.length === 0) {
      return json({ signatures: [], waivers: waivers || [], selectedWaiverId: waiverId });
    }

    // Fetch waiver details
    const waiverIds = [...new Set(signatures.map(s => s.waiver_id))];
    const { data: waiversData } = await supabaseAdmin
      .from('waivers')
      .select('id, title')
      .in('id', waiverIds);

    const waiverMap = new Map(waiversData?.map(w => [w.id, w]) || []);

    // Fetch user details
    const userIds = [...new Set(signatures.map(s => s.user_id))];
    const { data: usersData } = await supabaseAdmin
      .from('profiles')
      .select('id, email, family_id')
      .in('id', userIds);

    const userMap = new Map(usersData?.map(u => [u.id, u]) || []);

    // Fetch family details
    const familyIds = [...new Set(usersData?.map(u => u.family_id).filter((id): id is string => id !== null) || [])];
    const { data: familiesData } = familyIds.length > 0
      ? await supabaseAdmin
          .from('families')
          .select('id, name')
          .in('id', familyIds)
      : { data: [] };

    const familyMap = new Map(familiesData?.map(f => [f.id, f]) || []);

    // Fetch all student IDs mentioned in signatures
    const allStudentIds = signatures
      .flatMap(s => s.student_ids || [])
      .filter(Boolean);

    const uniqueStudentIds = [...new Set(allStudentIds)];

    const { data: studentsData } = uniqueStudentIds.length > 0
      ? await supabaseAdmin
          .from('students')
          .select('id, first_name, last_name')
          .in('id', uniqueStudentIds)
      : { data: [] };

    const studentMap = new Map(studentsData?.map(s => [s.id, s]) || []);

    // Combine data
    const enrichedSignatures = signatures
      .map(sig => {
        const waiver = waiverMap.get(sig.waiver_id);
        const user = userMap.get(sig.user_id);
        const family = user?.family_id ? familyMap.get(user.family_id) : null;
        const students = (sig.student_ids || [])
          .map(studentId => studentMap.get(studentId))
          .filter(Boolean) as Array<{ id: string; first_name: string; last_name: string }>;

        if (!waiver || !user || !family) return null;

        return {
          id: sig.id,
          signed_at: sig.signed_at,
          pdf_storage_path: sig.pdf_storage_path,
          waiver: {
            id: waiver.id,
            title: waiver.title,
          },
          user: {
            id: user.id,
            email: user.email,
          },
          family: {
            id: family.id,
            name: family.name,
          },
          students,
        } as WaiverSignature;
      })
      .filter((sig): sig is WaiverSignature => sig !== null);

    return json({
      signatures: enrichedSignatures,
      waivers: waivers || [],
      selectedWaiverId: waiverId,
    });
  } catch (error) {
    console.error('Error in waiver signatures loader:', error);
    throw new Response('Failed to load data', { status: 500 });
  }
}

export default function AdminWaiverSignaturesPage() {
  const { signatures, waivers, selectedWaiverId } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  const handleWaiverFilter = (waiverId: string | null) => {
    if (waiverId) {
      setSearchParams({ waiverId });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <AppBreadcrumb items={breadcrumbPatterns.adminWaivers()} className="mb-6" />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Waiver Signatures</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/waivers">Back to Waivers</Link>
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <label htmlFor="waiver-filter" className="block text-sm font-medium mb-2">Filter by Waiver:</label>
        <select
          id="waiver-filter"
          className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          value={selectedWaiverId || ''}
          onChange={(e) => handleWaiverFilter(e.target.value || null)}
        >
          <option value="">All Waivers</option>
          {waivers.map((waiver) => (
            <option key={waiver.id} value={waiver.id}>
              {waiver.title}
            </option>
          ))}
        </select>
      </div>

      {/* Signatures Table */}
      {signatures.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            {selectedWaiverId ? 'No signatures found for this waiver.' : 'No waiver signatures found.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Signed</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Waiver</TableHead>
                <TableHead>Students Covered</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signatures.map((signature) => (
                <TableRow key={signature.id}>
                  <TableCell>
                    {formatDate(signature.signed_at, { formatString: 'PPp' })}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/families/${signature.family.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {signature.family.name}
                    </Link>
                    {signature.user.email && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {signature.user.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/admin/waivers/${signature.waiver.id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {signature.waiver.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {signature.students.length > 0 ? (
                      <div className="space-y-1">
                        {signature.students.map((student) => (
                          <Badge key={student.id} variant="outline" className="mr-1">
                            {student.first_name} {student.last_name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">No students recorded</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {signature.pdf_storage_path ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={`/family/waivers/${signature.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    ) : (
                      <span className="text-gray-400 italic text-sm">No PDF</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        Showing {signatures.length} signature{signatures.length !== 1 ? 's' : ''}
        {selectedWaiverId && ' for selected waiver'}
      </div>
    </div>
  );
}
