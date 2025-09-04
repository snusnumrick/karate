import { getSupabaseAdminClient } from '~/utils/supabase.server';
import type { Database, Json } from '~/types/database.types';
import { DiscountService } from './discount.server';
import type { DiscountType, UsageType, DiscountScope, CreateDiscountCodeData, ApplicableTo } from '~/types/discount';


let supabase: ReturnType<typeof getSupabaseAdminClient> | null = null;

function getSupabase() {
  if (!supabase) {
    supabase = getSupabaseAdminClient();
  }
  return supabase;
}

type DiscountEventType = Database['public']['Enums']['discount_event_type'];
type DiscountEvent = Database['public']['Tables']['discount_events']['Row'];
type DiscountAutomationRule = Database['public']['Tables']['discount_automation_rules']['Row'];
type DiscountAssignment = Database['public']['Tables']['discount_assignments']['Row'];

export interface CreateEventData {
  event_type: DiscountEventType;
  student_id?: string;
  family_id?: string;
  event_data?: Json;
}

export interface CreateAutomationRuleData {
  name: string;
  event_type: DiscountEventType;
  discount_template_id?: string; // For backward compatibility
  discount_template_ids?: string[]; // For multiple templates
  conditions?: Json;
  valid_from?: string;
  valid_until?: string;
  applicable_programs?: string[]; // Program IDs that this rule applies to
  is_active?: boolean;
  uses_multiple_templates?: boolean;
}

export class AutoDiscountService {
  /**
   * Record a new discount event
   */
  static async recordEvent(eventData: CreateEventData): Promise<DiscountEvent> {
    const { data, error } = await getSupabase()
      .from('discount_events')
      .insert({
        event_type: eventData.event_type,
        student_id: eventData.student_id || null,
        family_id: eventData.family_id || null,
        event_data: eventData.event_data || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record discount event: ${error.message}`);
    }

    // Process automation rules for this event
    await this.processEventForAutomation(data);

    return data;
  }

  /**
   * Process an event against automation rules
   */
  static async processEventForAutomation(event: DiscountEvent): Promise<void> {
    // Get active automation rules for this event type
    const { data: rules, error: rulesError } = await getSupabase()
      .from('discount_automation_rules')
      .select(`
        *,
        discount_templates(*),
        automation_rule_discount_templates(
          discount_template_id,
          sequence_order,
          discount_templates(*)
        )
      `)
      .eq('event_type', event.event_type)
      .eq('is_active', true)
      .or('valid_from.is.null,valid_from.lte.' + new Date().toISOString())
      .or('valid_until.is.null,valid_until.gte.' + new Date().toISOString());

    if (rulesError) {
      console.error('Error fetching automation rules:', rulesError);
      return;
    }

    if (!rules || rules.length === 0) {
      return; // No rules to process
    }

    // Process each rule
    for (const rule of rules) {
      try {
        // Check if conditions are met
        const conditionsMet = await this.evaluateRuleConditions(rule, event);
        
        if (conditionsMet) {
          // Check if discount has already been assigned for this rule and event context
          const existingAssignment = await this.checkExistingAssignment(rule, event);
          
          if (!existingAssignment) {
            await this.assignDiscounts(rule, event);
          }
        }
      } catch (error) {
        console.error(`Error processing automation rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Evaluate rule conditions against an event
   */
  static async evaluateRuleConditions(
    rule: DiscountAutomationRule,
    event: DiscountEvent
  ): Promise<boolean> {
    // Check program filtering first
    if (rule.applicable_programs && rule.applicable_programs.length > 0 && event.student_id) {
      const studentPrograms = await this.getStudentPrograms(event.student_id);
      const hasMatchingProgram = rule.applicable_programs.some(programId => 
        studentPrograms.includes(programId)
      );
      if (!hasMatchingProgram) {
        return false;
      }
    }

    // If no conditions, rule applies to all events of this type (after program check)
    if (!rule.conditions) {
      return true;
    }

    const conditions = rule.conditions as Record<string, Json>;

    // Example condition evaluations
    // You can extend this based on your specific business logic
    


    // Check belt rank condition
    if (conditions.belt_rank && event.student_id) {
      const studentBeltRank = await this.getStudentBeltRank(event.student_id);
      if (studentBeltRank !== conditions.belt_rank) {
        return false;
      }
    }

    // Check family size condition
    if (conditions.min_family_size && event.family_id) {
      const familySize = await this.getFamilySize(event.family_id);
      if (familySize < (conditions.min_family_size as number)) {
        return false;
      }
    }

    // Check attendance milestone
    if (conditions.attendance_count && event.student_id) {
      const attendanceCount = await this.getStudentAttendanceCount(event.student_id);
      if (attendanceCount < (conditions.attendance_count as number)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if discount has already been assigned for this rule and context
   */
  static async checkExistingAssignment(
    rule: DiscountAutomationRule,
    event: DiscountEvent
  ): Promise<DiscountAssignment | null> {
    const { data, error } = await getSupabase()
      .from('discount_assignments')
      .select('*')
      .eq('automation_rule_id', rule.id)
      .eq('student_id', event.student_id || '')
      .eq('family_id', event.family_id || '')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking existing assignment:', error);
    }

    return data;
  }

  /**
   * Assign discounts based on automation rule (supports multiple templates)
   */
  static async assignDiscounts(
    rule: DiscountAutomationRule & {
      automation_rule_discount_templates?: Array<{
        discount_template_id: string;
        sequence_order: number;
        discount_templates: Database['public']['Tables']['discount_templates']['Row'];
      }>;
    },
    event: DiscountEvent
  ): Promise<void> {
    try {
      // Determine which templates to use
      let templatesToProcess: Array<{ template: Database['public']['Tables']['discount_templates']['Row']; sequence: number }> = [];
      
      if (rule.uses_multiple_templates && rule.automation_rule_discount_templates) {
        // Use multiple templates from junction table
        templatesToProcess = rule.automation_rule_discount_templates
          .sort((a, b) => a.sequence_order - b.sequence_order)
          .map(rt => ({
            template: rt.discount_templates,
            sequence: rt.sequence_order
          }));
      } else {
        // Use single template (backward compatibility)
        const { data: template, error: templateError } = await getSupabase()
          .from('discount_templates')
          .select('*')
          .eq('id', rule.discount_template_id)
          .single();

        if (templateError || !template) {
          throw new Error('Discount template not found');
        }
        
        templatesToProcess = [{ template, sequence: 1 }];
      }

      // Create discount codes for each template
      for (const { template } of templatesToProcess) {
        await this.createDiscountFromTemplate(rule, event, template);
      }
    } catch (error) {
      console.error('Error assigning discounts:', error);
      throw error;
    }
  }

  /**
   * Create a discount code from a template
   */
  static async createDiscountFromTemplate(
    rule: DiscountAutomationRule,
    event: DiscountEvent,
    template: Database['public']['Tables']['discount_templates']['Row']
  ): Promise<void> {
    try {
      // Create a discount code based on the template
      // Determine which ID to use based on template scope
      const discountData: CreateDiscountCodeData = {
        code: await DiscountService.generateUniqueCode('AUTO', 8),
        name: `${template.name} - Auto Assigned`,
        description: `Automatically assigned: ${template.description || template.name}`,
        discount_type: template.discount_type as DiscountType,
        discount_value: template.discount_value,
        usage_type: template.usage_type as UsageType,
        applicable_to: template.applicable_to as ApplicableTo,
        scope: template.scope as DiscountScope,
        max_uses: template.max_uses || undefined,
        valid_from: new Date().toISOString(),
        valid_until: this.calculateValidUntil(rule),
      };

      // Only set the appropriate ID based on scope
      if (template.scope === 'per_student' && event.student_id) {
        discountData.student_id = event.student_id;
      } else if (template.scope === 'per_family' && event.family_id) {
        discountData.family_id = event.family_id;
      } else if (event.family_id) {
        // Default to family scope if unclear
        discountData.family_id = event.family_id;
      }

      const discountCode = await DiscountService.createDiscountCode(discountData);

      // Record the assignment
      const { error: assignmentError } = await getSupabase()
        .from('discount_assignments')
        .insert({
          automation_rule_id: rule.id,
          discount_event_id: event.id,
          student_id: event.student_id || undefined,
          family_id: event.family_id || undefined,
          discount_code_id: discountCode.id,
        });

      if (assignmentError) {
        throw new Error(`Failed to record discount assignment: ${assignmentError.message}`);
      }

      console.log(`Discount automatically assigned: ${discountCode.code} for event ${event.id}`);
    } catch (error) {
      console.error('Error assigning discount:', error);
      throw error;
    }
  }

  /**
   * Calculate valid until date based on rule settings
   */
  static calculateValidUntil(rule: DiscountAutomationRule): string | undefined {
    if (rule.valid_until) {
      return rule.valid_until;
    }

    // Return undefined for indefinite validity when rule has no end date
    return undefined;
  }

  /**
   * Helper methods for condition evaluation
   */
  static async getStudentAge(studentId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('students')
      .select('birth_date')
      .eq('id', studentId)
      .single();

    if (error || !data?.birth_date) {
      return 0;
    }

    const birthDate = new Date(data.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1;
    }
    
    return age;
  }

  static async getStudentBeltRank(studentId: string): Promise<string | null> {
    // Since current_belt_rank doesn't exist in students table,
    // we'll get the latest belt award for this student
    const { data, error } = await getSupabase()
      .from('belt_awards')
      .select('type')
      .eq('student_id', studentId)
      .order('awarded_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data?.type || null;
  }

  static async getFamilySize(familyId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('students')
      .select('id')
      .eq('family_id', familyId);

    if (error) {
      return 0;
    }

    return data?.length || 0;
  }

  static async getStudentAttendanceCount(studentId: string): Promise<number> {
    const { data, error } = await getSupabase()
      .from('attendance')
      .select('id')
      .eq('student_id', studentId);

    if (error) {
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get programs that a student is enrolled in
   */
  static async getStudentPrograms(studentId: string): Promise<string[]> {
    const { data, error } = await getSupabase()
      .from('enrollments')
      .select(`
        classes!inner(
          program_id
        )
      `)
      .eq('student_id', studentId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching student programs:', error);
      return [];
    }

    // Extract unique program IDs
    const programIds = data
      ?.map(enrollment => {
        const classes = enrollment.classes;
        // Check if classes is a valid object with program_id
        if (classes && typeof classes === 'object' && 'program_id' in classes) {
          return (classes as { program_id: string }).program_id;
        }
        return null;
      })
      .filter((id): id is string => Boolean(id)) || [];
    
    return [...new Set(programIds)];
  }

  /**
   * CRUD operations for automation rules
   */
  static async createAutomationRule(ruleData: CreateAutomationRuleData): Promise<DiscountAutomationRule> {
    const usesMultipleTemplates = ruleData.uses_multiple_templates || (ruleData.discount_template_ids && ruleData.discount_template_ids.length > 1);
    
    // For backward compatibility, use single template if not using multiple
    const templateId = usesMultipleTemplates ? 
      (ruleData.discount_template_ids?.[0] || ruleData.discount_template_id) : 
      ruleData.discount_template_id;

    const { data, error } = await getSupabase()
      .from('discount_automation_rules')
      .insert({
        name: ruleData.name,
        event_type: ruleData.event_type,
        discount_template_id: templateId!,
        conditions: ruleData.conditions,
        valid_from: ruleData.valid_from,
        valid_until: ruleData.valid_until,
        uses_multiple_templates: usesMultipleTemplates,
        applicable_programs: ruleData.applicable_programs || null,
        is_active: ruleData.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create automation rule: ${error.message}`);
    }

    // If using multiple templates, insert into junction table
    if (usesMultipleTemplates && ruleData.discount_template_ids) {
      const templateInserts = ruleData.discount_template_ids.map((templateId, index) => ({
        automation_rule_id: data.id,
        discount_template_id: templateId,
        sequence_order: index + 1,
      }));

      const { error: junctionError } = await getSupabase()
        .from('automation_rule_discount_templates')
        .insert(templateInserts);

      if (junctionError) {
        // Rollback the rule creation if junction table insert fails
        await getSupabase().from('discount_automation_rules').delete().eq('id', data.id);
        throw new Error(`Failed to create automation rule templates: ${junctionError.message}`);
      }
    }

    return data;
  }

  static async getAutomationRules(): Promise<DiscountAutomationRule[]> {
    const { data, error } = await getSupabase()
      .from('discount_automation_rules')
      .select(`
        *,
        discount_templates(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch automation rules: ${error.message}`);
    }

    return data || [];
  }

  static async updateAutomationRule(
    id: string,
    updates: Partial<CreateAutomationRuleData>
  ): Promise<DiscountAutomationRule> {
    const { data, error } = await getSupabase()
      .from('discount_automation_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update automation rule: ${error.message}`);
    }

    return data;
  }

  static async deleteAutomationRule(id: string): Promise<void> {
    const { error } = await getSupabase()
      .from('discount_automation_rules')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete automation rule: ${error.message}`);
    }
  }

  /**
   * Get discount assignments
   */
  static async getDiscountAssignments(): Promise<DiscountAssignment[]> {
    const { data, error } = await getSupabase()
      .from('discount_assignments')
      .select(`
        *,
        discount_events(*),
        discount_automation_rules(*),
        discount_codes(*),
        families(name),
        students(first_name, last_name)
      `)
      .order('assigned_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch discount assignments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Convenience methods for common events
   */
  static async recordStudentEnrollment(studentId: string, familyId: string): Promise<void> {
    await this.recordEvent({
      event_type: 'student_enrollment',
      student_id: studentId,
      family_id: familyId,
      event_data: {
        enrollment_date: new Date().toISOString(),
      },
    });
  }

  static async recordFirstPayment(familyId: string, paymentAmount: number): Promise<void> {
    await this.recordEvent({
      event_type: 'first_payment',
      family_id: familyId,
      event_data: {
        payment_amount: paymentAmount,
        payment_date: new Date().toISOString(),
      },
    });
  }

  static async recordBeltPromotion(studentId: string, familyId: string, newBeltRank: string): Promise<void> {
    await this.recordEvent({
      event_type: 'belt_promotion',
      student_id: studentId,
      family_id: familyId,
      event_data: {
        new_belt_rank: newBeltRank,
        promotion_date: new Date().toISOString(),
      },
    });
  }

  static async recordAttendanceMilestone(studentId: string, familyId: string, attendanceCount: number): Promise<void> {
    await this.recordEvent({
      event_type: 'attendance_milestone',
      student_id: studentId,
      family_id: familyId,
      event_data: {
        attendance_count: attendanceCount,
        milestone_date: new Date().toISOString(),
      },
    });
  }
}