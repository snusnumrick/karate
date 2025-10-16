import { z } from 'zod';

/**
 * Schema for creating a seminar (program with engagement_type='seminar')
 */
export const createSeminarSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  slug: z
    .string()
    .optional()
    .refine((val) => !val || /^[a-z0-9-]+$/.test(val), {
      message: 'Slug must contain only lowercase letters, numbers, and hyphens',
    }),

  // Engagement and marketing fields
  engagement_type: z.literal('seminar'),
  ability_category: z.enum(['able', 'adaptive']).optional(),
  seminar_type: z.enum(['introductory', 'intermediate', 'advanced']).optional(),
  audience_scope: z.enum(['youth', 'adults', 'mixed']).default('youth'),

  // Duration and capacity
  duration_minutes: z.number().int().min(1).default(60),
  min_capacity: z.number().int().min(1).optional(),
  max_capacity: z.number().int().min(1).optional(),

  // Session frequency
  sessions_per_week: z.number().int().min(1).default(1),
  min_sessions_per_week: z.number().int().min(1).optional(),
  max_sessions_per_week: z.number().int().min(1).optional(),

  // Belt requirements
  min_belt_rank: z
    .enum(['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'red', 'brown', 'black'])
    .optional(),
  max_belt_rank: z
    .enum(['white', 'yellow', 'orange', 'green', 'blue', 'purple', 'red', 'brown', 'black'])
    .optional(),
  belt_rank_required: z.boolean().default(false),

  // Age constraints
  min_age: z.number().int().min(0).optional(),
  max_age: z.number().int().min(0).optional(),
  gender_restriction: z.enum(['male', 'female', 'none']).default('none'),
  special_needs_support: z.boolean().default(false),

  // Pricing (in cents)
  single_purchase_price_cents: z.number().int().min(0).optional(),
  subscription_monthly_price_cents: z.number().int().min(0).optional(),
  subscription_yearly_price_cents: z.number().int().min(0).optional(),
  registration_fee_cents: z.number().int().min(0).default(0),

  // System fields
  is_active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.min_age !== undefined && data.max_age !== undefined) {
      return data.max_age >= data.min_age;
    }
    return true;
  },
  {
    message: 'Maximum age must be greater than or equal to minimum age',
    path: ['max_age'],
  }
);

/**
 * Schema for updating a seminar
 * Note: We need to rebuild the schema for updates since .partial() doesn't work on ZodEffects
 */
export const updateSeminarSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().optional(),
  slug: z.string().optional().refine(
    (val) => !val || /^[a-z0-9-]+$/.test(val),
    {
      message: 'Slug must be lowercase letters, numbers, and hyphens only',
    }
  ).optional(),
  ability_category: z.enum(['able', 'adaptive']).optional(),
  seminar_type: z.enum(['introductory', 'intermediate', 'advanced']).optional(),
  audience_scope: z.enum(['youth', 'adults', 'mixed']).optional(),
  min_age: z.number().int().min(0).optional(),
  max_age: z.number().int().min(0).optional(),
  duration_minutes: z.number().int().min(1).optional(),
  sessions_per_week: z.number().int().min(1).optional(),
  single_purchase_price_cents: z.number().int().min(0).optional(),
  monthly_fee_cents: z.number().int().min(0).optional(),
  yearly_fee_cents: z.number().int().min(0).optional(),
  belt_rank_id: z.string().uuid().optional(),
  instructor_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for creating a seminar series (class)
 */
export const createSeminarSeriesSchema = z.object({
  program_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),

  // Series-specific fields
  topic: z.string().min(1, 'Topic is required').max(255).optional(),
  series_label: z.string().min(1, 'Series label is required').max(100),
  series_status: z.enum(['tentative', 'confirmed', 'cancelled', 'in_progress', 'completed']).default('tentative'),
  registration_status: z.enum(['open', 'closed', 'waitlisted']).default('closed'),
  series_start_on: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }),
  series_end_on: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }),

  // Session configuration
  sessions_per_week_override: z.number().int().min(1).optional(),
  session_duration_minutes: z.number().int().min(1).optional(),
  series_session_quota: z.number().int().min(1, 'Must have at least one session'),

  // Capacity
  min_capacity: z.number().int().min(1).optional(),
  max_capacity: z.number().int().min(1).optional(),

  // Pricing overrides (in cents)
  price_override_cents: z.number().int().min(0).optional(),
  registration_fee_override_cents: z.number().int().min(0).optional(),

  // Registration settings
  allow_self_enrollment: z.boolean().default(false),
  on_demand: z.boolean().default(false),

  // Instructor
  instructor_id: z.string().uuid().optional(),

  // System fields
  is_active: z.boolean().default(true),
}).refine(
  (data) => {
    const start = new Date(data.series_start_on);
    const end = new Date(data.series_end_on);
    return end >= start;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['series_end_on'],
  }
).refine(
  (data) => {
    if (data.min_capacity !== undefined && data.max_capacity !== undefined) {
      return data.max_capacity >= data.min_capacity;
    }
    return true;
  },
  {
    message: 'Maximum capacity must be greater than or equal to minimum capacity',
    path: ['max_capacity'],
  }
);

/**
 * Schema for updating a seminar series
 * Note: We need to rebuild the schema for updates since .partial() doesn't work on ZodEffects
 */
export const updateSeminarSeriesSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  description: z.string().optional(),
  topic: z.string().min(1, 'Topic is required').max(255).optional(),
  series_label: z.string().min(1, 'Series label is required').max(100).optional(),
  series_status: z.enum(['tentative', 'confirmed', 'cancelled', 'in_progress', 'completed']).optional(),
  registration_status: z.enum(['open', 'closed', 'waitlisted']).optional(),
  series_start_on: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid start date',
  }).optional(),
  series_end_on: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid end date',
  }).optional(),
  sessions_per_week_override: z.number().int().min(1).optional(),
  session_duration_minutes: z.number().int().min(1).optional(),
  series_session_quota: z.number().int().min(1, 'Must have at least one session').optional(),
  min_capacity: z.number().int().min(1).optional(),
  max_capacity: z.number().int().min(1).optional(),
  price_override_cents: z.number().int().min(0).optional(),
  registration_fee_override_cents: z.number().int().min(0).optional(),
  allow_self_enrollment: z.boolean().optional(),
  on_demand: z.boolean().optional(),
  instructor_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
});

/**
 * Schema for self-registrant intake
 */
export const selfRegistrantIntakeSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required').max(20),
  emergencyContact: z.string().max(255).optional(),
  waiverAcknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the waiver',
  }),
});

/**
 * Schema for seminar registration
 */
export const seminarRegistrationSchema = z.object({
  seriesId: z.string().uuid('Invalid series ID'),
  studentId: z.string().uuid('Invalid student ID').optional(),

  // For self-registration, if no studentId
  selfRegistrant: selfRegistrantIntakeSchema.optional(),

  // Payment information
  paymentMethodId: z.string().optional(),

  // Waiver acceptance
  waiverIds: z.array(z.string().uuid()).default([]),
}).refine(
  (data) => {
    // Either studentId or selfRegistrant must be provided
    return !!(data.studentId || data.selfRegistrant);
  },
  {
    message: 'Either student ID or self-registrant information must be provided',
    path: ['studentId'],
  }
);

export type CreateSeminarInput = z.infer<typeof createSeminarSchema>;
export type UpdateSeminarInput = z.infer<typeof updateSeminarSchema>;
export type CreateSeminarSeriesInput = z.infer<typeof createSeminarSeriesSchema>;
export type UpdateSeminarSeriesInput = z.infer<typeof updateSeminarSeriesSchema>;
export type SelfRegistrantIntakeInput = z.infer<typeof selfRegistrantIntakeSchema>;
export type SeminarRegistrationInput = z.infer<typeof seminarRegistrationSchema>;
