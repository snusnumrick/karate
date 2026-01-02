-- Add index to speed up get_main_page_schedule_summary RPC
-- This index covers the join on classes.is_active and class_schedules.class_id

-- Index for active classes lookup
CREATE INDEX IF NOT EXISTS idx_classes_is_active ON classes(is_active) WHERE is_active = true;

-- Composite index for class_schedules join
CREATE INDEX IF NOT EXISTS idx_class_schedules_class_id_day ON class_schedules(class_id, day_of_week);
