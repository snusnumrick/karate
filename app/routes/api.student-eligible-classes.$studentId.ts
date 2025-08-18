import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { requireAdminUser } from "~/utils/auth.server";
import { getClasses } from "~/services/class.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireAdminUser(request);
  
  const { studentId } = params;
  
  if (!studentId) {
    return json({ error: "Student ID is required" }, { status: 400 });
  }
  
  try {
    const supabase = getSupabaseAdminClient();
    
    // Get all active classes
    const classes = await getClasses();
    const activeClasses = classes.filter(c => c.is_active);
    
    // Check eligibility for each class using the new RPC function
    const eligibleClassIds: string[] = [];
    
    for (const classItem of activeClasses) {
      const { data: isEligible, error } = await supabase
        .rpc('check_class_eligibility', {
          student_id_param: studentId,
          class_id_param: classItem.id
        });
        
      if (error) {
        console.error(`Error checking eligibility for class ${classItem.id}:`, error);
        continue;
      }
      
      if (isEligible) {
        eligibleClassIds.push(classItem.id);
      }
    }
    
    return json(eligibleClassIds);
  } catch (error) {
    console.error("Error checking student class eligibility:", error);
    return json({ error: "Failed to check eligibility" }, { status: 500 });
  }
}