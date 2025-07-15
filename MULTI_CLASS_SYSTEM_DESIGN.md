# Multi-Class System Design & Implementation Plan (Updated)

## Overview

This document outlines the design and implementation plan for a comprehensive multi-class system that supports **Programs** (templates with capacity constraints) and **Classes** (instances within capacity limits) with enrollment management, scheduling, and integrated messaging.

## Core Concepts

### Programs with Capacity Constraints
Programs are reusable templates that define:
- **Name & Description**: Clear identification and purpose
- **Pricing Structure**: Flexible pricing rules and payment options
- **Eligibility Rules**: Age ranges, skill levels, accessibility requirements
- **Max Capacity Constraint**: Upper limit for all classes in this program
- **Class Parameters**: Duration, frequency

### Classes within Capacity Limits
Classes are specific scheduled instances of programs:
- **Program Instance**: Based on a program template
- **Capacity Constraint**: Must not exceed program's max_capacity
- **Schedule**: Specific days, times, and duration
- **Enrollment**: Student registration and capacity management
- **Calendar Integration**: Session scheduling and attendance tracking
- **Instructor Assignment**: Staff management per class

## Enhanced Database Schema Design

### Programs Table (Updated with Belt Requirements)
```sql
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_capacity INTEGER NULL, -- Upper bound for all classes in this program
  sessions_per_week INTEGER NOT NULL DEFAULT 1, -- Required frequency
  min_sessions_per_week INTEGER NULL, -- Optional minimum (for flexible programs)
  max_sessions_per_week INTEGER NULL, -- Optional maximum (for flexible programs)
  -- NEW: Belt requirements
  min_belt_rank INTEGER NULL, -- Minimum belt rank required (0=white belt, 1=yellow, etc.)
  max_belt_rank INTEGER NULL, -- Maximum belt rank (for beginner programs)
  belt_rank_required BOOLEAN DEFAULT false, -- Whether belt rank is enforced
  prerequisite_programs TEXT[], -- Array of program IDs that must be completed first
  -- Pricing
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  yearly_fee NUMERIC(10,2) DEFAULT 0,
  individual_session_fee NUMERIC(10,2) DEFAULT 0,
  registration_fee NUMERIC(10,2) DEFAULT 0,
  -- Demographics
  min_age INTEGER CHECK (min_age >= 0),
  max_age INTEGER CHECK (max_age >= min_age),
  gender_restriction TEXT DEFAULT 'none' CHECK (gender_restriction IN ('male', 'female', 'none')),
  special_needs_support BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Validation constraints
  CHECK (sessions_per_week >= 1),
  CHECK (min_sessions_per_week IS NULL OR min_sessions_per_week >= 1),
  CHECK (max_sessions_per_week IS NULL OR max_sessions_per_week >= sessions_per_week),
  CHECK (min_sessions_per_week IS NULL OR max_sessions_per_week IS NULL OR min_sessions_per_week <= max_sessions_per_week),
  CHECK (min_belt_rank IS NULL OR min_belt_rank >= 0),
  CHECK (max_belt_rank IS NULL OR max_belt_rank >= 0),
  CHECK (min_belt_rank IS NULL OR max_belt_rank IS NULL OR min_belt_rank <= max_belt_rank)
);

-- Belt ranking system reference table
CREATE TABLE belt_ranks (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  order_position INTEGER NOT NULL UNIQUE,
  description TEXT,
  typical_time_to_achieve_months INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Standard belt progression
INSERT INTO belt_ranks (id, name, color, order_position, description, typical_time_to_achieve_months) VALUES
(0, 'White Belt', '#FFFFFF', 0, 'Beginner level', 0),
(1, 'Yellow Belt', '#FFFF00', 1, 'Basic techniques learned', 3),
(2, 'Orange Belt', '#FFA500', 2, 'Fundamental skills developed', 6),
(3, 'Green Belt', '#008000', 3, 'Intermediate techniques', 12),
(4, 'Blue Belt', '#0000FF', 4, 'Advanced basics mastered', 18),
(5, 'Purple Belt', '#800080', 5, 'Advanced techniques', 24),
(6, 'Brown Belt', '#A52A2A', 6, 'Pre-black belt mastery', 36),
(7, 'Black Belt 1st Dan', '#000000', 7, 'Expert level achieved', 48),
(8, 'Black Belt 2nd Dan', '#000000', 8, 'Advanced expert', 60),
(9, 'Black Belt 3rd Dan', '#000000', 9, 'Master level', 84);
```

### Classes Table (Enhanced with Frequency Validation)
```sql
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  max_capacity INTEGER NULL, -- Must be <= program.max_capacity
  instructor_id UUID REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Capacity constraint
  CONSTRAINT class_capacity_within_program_limit 
  CHECK (
    max_capacity IS NULL OR 
    (SELECT max_capacity FROM programs WHERE id = program_id) IS NULL OR
    max_capacity <= (SELECT max_capacity FROM programs WHERE id = program_id)
  )
);

-- NEW: Class Schedule Validation Table
CREATE TABLE class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(class_id, day_of_week, start_time)
);

-- Function to validate class frequency matches program requirements
CREATE OR REPLACE FUNCTION validate_class_frequency()
RETURNS TRIGGER AS $
DECLARE
  program_record RECORD;
  actual_sessions INTEGER;
BEGIN
  -- Get program frequency requirements
  SELECT sessions_per_week, min_sessions_per_week, max_sessions_per_week, monthly_fee, individual_session_fee
  INTO program_record
  FROM programs 
  WHERE id = (SELECT program_id FROM classes WHERE id = NEW.class_id);
  
  -- Count actual sessions for this class
  SELECT COUNT(*) INTO actual_sessions
  FROM class_schedules 
  WHERE class_id = NEW.class_id;
  
  -- Skip validation for pay-per-session programs (no subscription commitment)
  IF program_record.monthly_fee = 0 AND program_record.individual_session_fee > 0 THEN
    RETURN NEW;
  END IF;
  
  -- Validate against program requirements
  IF program_record.min_sessions_per_week IS NOT NULL THEN
    -- Flexible frequency program
    IF actual_sessions < program_record.min_sessions_per_week OR 
       actual_sessions > program_record.max_sessions_per_week THEN
      RAISE EXCEPTION 'Class must meet between % and % times per week (currently: %)', 
        program_record.min_sessions_per_week, program_record.max_sessions_per_week, actual_sessions;
    END IF;
  ELSE
    -- Fixed frequency program
    IF actual_sessions != program_record.sessions_per_week THEN
      RAISE EXCEPTION 'Class must meet exactly % times per week (currently: %)', 
        program_record.sessions_per_week, actual_sessions;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to validate frequency on schedule changes
CREATE TRIGGER validate_class_frequency_trigger
  AFTER INSERT OR UPDATE OR DELETE ON class_schedules
  FOR EACH ROW EXECUTE FUNCTION validate_class_frequency();
```

## Program Belt Requirements Examples (Using Existing Belt System)

### 1. Beginner Programs (White to Orange Belt)
```sql
-- Example: Programs for new students using existing belt_rank_enum
INSERT INTO programs (
  name, 
  min_belt_rank, 
  max_belt_rank, 
  belt_rank_required,
  sessions_per_week, 
  max_capacity, 
  monthly_fee
) VALUES ('Little Dragons Beginners', 'white', 'orange', true, 2, 8, 120);

-- Only students with White to Orange belt can enroll
-- Perfect for new students who need foundational skills
```

### 2. Intermediate Programs (Green to Purple Belt)
```sql
-- Example: Programs requiring intermediate skills
INSERT INTO programs (
  name, 
  min_belt_rank, 
  max_belt_rank, 
  belt_rank_required,
  sessions_per_week, 
  max_capacity, 
  monthly_fee
) VALUES ('Teen Intermediate Karate', 'green', 'purple', true, 2, 12, 140);

-- Students must have at least Green Belt but not higher than Purple Belt
-- Ensures appropriate skill level grouping
```

### 3. Advanced Programs (Brown Belt and Above)
```sql
-- Example: Advanced training programs
INSERT INTO programs (
  name, 
  min_belt_rank, 
  belt_rank_required,
  sessions_per_week, 
  min_sessions_per_week,
  max_sessions_per_week,
  max_capacity, 
  monthly_fee
) VALUES ('Competition Team', 'brown', true, 4, 3, 5, 6, 280);

-- Students must have at least Brown Belt with no upper limit
-- Intensive training for advanced students
```

### 4. Open Programs (No Belt Requirements)
```sql
-- Example: Programs open to all skill levels
INSERT INTO programs (
  name, 
  belt_rank_required,
  sessions_per_week, 
  max_capacity, 
  individual_session_fee
) VALUES ('Open Mat Sessions', false, 1, NULL, 25);

-- No belt requirements - open to all skill levels
-- Good for general practice and conditioning
```

### 5. Prerequisite Programs
```sql
-- Example: Programs with specific prerequisites
INSERT INTO programs (
  name, 
  min_belt_rank, 
  belt_rank_required,
  prerequisite_programs,
  sessions_per_week, 
  max_capacity, 
  monthly_fee
) VALUES ('Weapons Training', 'blue', true, ARRAY['teen-intermediate-karate'], 2, 8, 180);

-- Must have Blue Belt AND completed Teen Intermediate Karate program
-- Creates structured progression pathways
```

## Data Integrity and Program Management

### Soft Delete Design for Programs

Programs use a soft delete approach rather than hard deletion for data integrity purposes. When a program is "deleted" through the admin interface, it is marked as inactive (`is_active = false`) rather than being permanently removed from the database.

**This is intentional design for data integrity** - programs with historical data (classes, enrollments, payments) should not be permanently deleted. Programs that have been used in the past contain valuable historical information that must be preserved for:

- **Financial Records**: Payment history and billing records
- **Student Progress**: Enrollment history and academic progression
- **Reporting**: Historical analytics and performance metrics
- **Compliance**: Audit trails and regulatory requirements

If you want programs to disappear from the admin interface after "deletion", you need to modify the programs list page to filter out inactive programs by calling `getPrograms({ is_active: true })` instead of `getPrograms()`.

The current behavior is actually correct - the program is being "deleted" (deactivated) successfully, but it remains in the database for historical purposes. The "Active Program" checkbox on the edit page provides the same functionality as the delete button, allowing administrators to activate or deactivate programs as needed.

## Business Logic Enhancements

### Program Category Detection (Updated)
```typescript
export function getProgramCategory(program: Program): 
  'private_flexible' | 'semi_private_structured' | 'group_structured' | 'group_flexible' | 'open_sessions' {
  
  const isPayPerSession = program.monthlyFee === 0 && program.individualSessionFee > 0;
  const hasFlexibleFrequency = program.minSessionsPerWeek !== null && program.maxSessionsPerWeek !== null;
  
  if (isPayPerSession) return 'open_sessions';
  if (program.maxCapacity === 1) return 'private_flexible';
  if (program.maxCapacity && program.maxCapacity <= 6) {
    return hasFlexibleFrequency ? 'semi_private_flexible' : 'semi_private_structured';
  }
  return hasFlexibleFrequency ? 'group_flexible' : 'group_structured';
}

export function getProgramFrequencyType(program: Program): 'fixed' | 'flexible' | 'open' {
  if (program.monthlyFee === 0 && program.individualSessionFee > 0) return 'open';
  if (program.minSessionsPerWeek && program.maxSessionsPerWeek) return 'flexible';
  return 'fixed';
}
```

## Enhanced Student Data Model (Revised to Use Existing Belt System)

### Integration with Existing Belt Awards System
Instead of creating new belt tracking tables, we'll integrate with the existing `belt_awards` table:

```sql
-- Add belt requirements to programs (integrate with existing belt system)
ALTER TABLE programs 
  ADD COLUMN min_belt_rank INTEGER NULL, -- References existing belt ranking system
  ADD COLUMN max_belt_rank INTEGER NULL, -- References existing belt ranking system  
  ADD COLUMN belt_rank_required BOOLEAN DEFAULT false, -- Whether belt rank is enforced
  ADD COLUMN prerequisite_programs TEXT[]; -- Array of program IDs that must be completed first

-- Function to get student's current belt rank from existing belt_awards
CREATE OR REPLACE FUNCTION get_student_current_belt(student_id_param UUID)
RETURNS INTEGER AS $
DECLARE
  current_belt_rank INTEGER;
BEGIN
  -- Get the highest belt rank from existing belt_awards table
  SELECT COALESCE(MAX(belt_rank), 0) INTO current_belt_rank
  FROM belt_awards 
  WHERE student_id = student_id_param;
  
  RETURN current_belt_rank;
END;
$ LANGUAGE plpgsql;

-- Function to check if student has completed prerequisite programs
CREATE OR REPLACE FUNCTION has_completed_prerequisite_programs(
  student_id_param UUID, 
  required_programs TEXT[]
) RETURNS BOOLEAN AS $
DECLARE
  completed_count INTEGER;
BEGIN
  -- Count how many required programs the student has completed
  SELECT COUNT(*) INTO completed_count
  FROM enrollments e
  JOIN programs p ON e.program_id = p.id
  WHERE e.student_id = student_id_param 
    AND p.id = ANY(required_programs)
    AND e.status = 'completed';
  
  RETURN completed_count >= array_length(required_programs, 1);
END;
$ LANGUAGE plpgsql;
```

## Enhanced Enrollment Validation (Using Existing Belt System)

### Eligibility Checking with Existing Belt Awards
```typescript
export interface EnrollmentEligibility {
  eligible: boolean;
  reasons: Array<{
    type: 'age' | 'belt_rank' | 'prerequisites' | 'gender' | 'special_needs' | 'capacity';
    requirement: string;
    studentValue: string;
    satisfied: boolean;
  }>;
  warnings: string[];
  recommendations: string[];
}

export async function checkProgramEligibility(
  studentId: string,
  programId: string
): Promise<EnrollmentEligibility> {
  
  const student = await getStudentById(studentId);
  const program = await getProgramById(programId);
  
  if (!student || !program) {
    return {
      eligible: false,
      reasons: [{ type: 'age', requirement: 'Student or program not found', studentValue: '', satisfied: false }],
      warnings: [],
      recommendations: []
    };
  }
  
  const reasons = [];
  const warnings = [];
  const recommendations = [];
  
  // Get student's current belt rank from existing belt_awards system
  const studentCurrentBelt = await getStudentCurrentBeltRank(studentId);
  
  // Age requirements
  if (program.minAge || program.maxAge) {
    const studentAge = calculateAge(student.birthDate);
    const ageRequirement = `Age: ${program.minAge || 'any'} - ${program.maxAge || 'any'}`;
    const ageSatisfied = 
      (!program.minAge || studentAge >= program.minAge) &&
      (!program.maxAge || studentAge <= program.maxAge);
    
    reasons.push({
      type: 'age',
      requirement: ageRequirement,
      studentValue: `${studentAge} years old`,
      satisfied: ageSatisfied
    });
  }
  
  // Belt rank requirements (using existing belt_awards system)
  if (program.beltRankRequired && (program.minBeltRank || program.maxBeltRank)) {
    const beltName = getBeltDisplayName(studentCurrentBelt);
    
    let beltRequirement = 'Belt rank: ';
    if (program.minBeltRank && program.maxBeltRank) {
      const minBeltName = getBeltDisplayName(program.minBeltRank);
      const maxBeltName = getBeltDisplayName(program.maxBeltRank);
      beltRequirement += `${minBeltName} to ${maxBeltName}`;
    } else if (program.minBeltRank) {
      const minBeltName = getBeltDisplayName(program.minBeltRank);
      beltRequirement += `${minBeltName} or higher`;
    } else if (program.maxBeltRank) {
      const maxBeltName = getBeltDisplayName(program.maxBeltRank);
      beltRequirement += `${maxBeltName} or lower`;
    }
    
    const beltSatisfied = await checkBeltRankEligibility(studentCurrentBelt, program.minBeltRank, program.maxBeltRank);
    
    reasons.push({
      type: 'belt_rank',
      requirement: beltRequirement,
      studentValue: beltName,
      satisfied: beltSatisfied
    });
    
    // Add progression recommendations
    if (!beltSatisfied) {
      if (program.minBeltRank && getBeltOrdinal(studentCurrentBelt) < getBeltOrdinal(program.minBeltRank)) {
        const targetBeltName = getBeltDisplayName(program.minBeltRank);
        recommendations.push(
          `Work toward ${targetBeltName} to be eligible for this program. ` +
          `Consider these preparatory programs: ${await getSuggestedProgramsForBeltRank(studentCurrentBelt)}`
        );
      }
      
      if (program.maxBeltRank && getBeltOrdinal(studentCurrentBelt) > getBeltOrdinal(program.maxBeltRank)) {
        recommendations.push(
          `This program may be too basic for your current skill level. ` +
          `Consider these advanced programs: ${await getSuggestedProgramsForBeltRank(studentCurrentBelt)}`
        );
      }
    }
  }
  
  // Prerequisite programs check
  if (program.prerequisitePrograms && program.prerequisitePrograms.length > 0) {
    const hasCompletedPrereqs = await hasCompletedPrerequisitePrograms(
      studentId, 
      program.prerequisitePrograms
    );
    
    if (!hasCompletedPrereqs) {
      const missingProgramNames = await getProgramNames(program.prerequisitePrograms);
      const completedPrograms = await getCompletedProgramsForStudent(studentId);
      
      reasons.push({
        type: 'prerequisites',
        requirement: `Must complete: ${missingProgramNames.join(', ')}`,
        studentValue: `Completed: ${completedPrograms.map(p => p.name).join(', ') || 'None'}`,
        satisfied: false
      });
    } else {
      const completedPrograms = await getCompletedProgramsForStudent(studentId);
      reasons.push({
        type: 'prerequisites',
        requirement: `Prerequisites completed`,
        studentValue: `Completed: ${completedPrograms.map(p => p.name).join(', ')}`,
        satisfied: true
      });
    }
  }
  
  // Gender restrictions
  if (program.genderRestriction !== 'none') {
    const genderSatisfied = student.gender === program.genderRestriction;
    reasons.push({
      type: 'gender',
      requirement: `Gender: ${program.genderRestriction}`,
      studentValue: student.gender || 'Not specified',
      satisfied: genderSatisfied
    });
  }
  
  // Special needs support
  if (student.specialNeeds && !program.specialNeedsSupport) {
    warnings.push(
      'This student has special needs but this program does not specifically offer special needs support. ' +
      'Please contact the instructor to discuss accommodations.'
    );
  }
  
  const allReasonsSatisfied = reasons.every(r => r.satisfied);
  
  return {
    eligible: allReasonsSatisfied,
    reasons,
    warnings,
    recommendations
  };
}

// Helper functions that work with existing belt_awards system
async function getStudentCurrentBeltRank(studentId: string): Promise<BeltRankEnum> {
  // Query the existing belt_awards table to get student's current belt rank
  const result = await supabase
    .from('belt_awards')
    .select('type')
    .eq('student_id', studentId)
    .order('awarded_date', { ascending: false })
    .limit(1)
    .single();
  
  return result.data?.type || 'white'; // Default to white belt if no awards
}

function getBeltDisplayName(beltRank: BeltRankEnum): string {
  const beltNames = {
    'white': 'White Belt',
    'yellow': 'Yellow Belt', 
    'orange': 'Orange Belt',
    'green': 'Green Belt',
    'blue': 'Blue Belt',
    'purple': 'Purple Belt',
    'red': 'Red Belt',
    'brown': 'Brown Belt',
    'black': 'Black Belt'
  };
  
  return beltNames[beltRank] || 'Unknown Belt';
}

function getBeltOrdinal(beltRank: BeltRankEnum): number {
  const beltOrder = {
    'white': 0,
    'yellow': 1,
    'orange': 2,
    'green': 3,
    'blue': 4,
    'purple': 5,
    'red': 6,
    'brown': 7,
    'black': 8
  };
  
  return beltOrder[beltRank] || 0;
}

async function checkBeltRankEligibility(
  studentBelt: BeltRankEnum, 
  minBeltRank?: BeltRankEnum, 
  maxBeltRank?: BeltRankEnum
): Promise<boolean> {
  const studentOrdinal = getBeltOrdinal(studentBelt);
  
  if (minBeltRank && studentOrdinal < getBeltOrdinal(minBeltRank)) {
    return false;
  }
  
  if (maxBeltRank && studentOrdinal > getBeltOrdinal(maxBeltRank)) {
    return false;
  }
  
  return true;
}

async function hasCompletedPrerequisitePrograms(
  studentId: string, 
  requiredPrograms: string[]
): Promise<boolean> {
  const result = await supabase
    .from('enrollments')
    .select('program_id')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .in('program_id', requiredPrograms);
  
  return (result.data?.length || 0) >= requiredPrograms.length;
}

async function getSuggestedProgramsForBeltRank(beltRank: BeltRankEnum): Promise<string> {
  // Get programs that accept the student's current belt level
  const { data: programs } = await supabase
    .from('programs')
    .select('name')
    .eq('is_active', true)
    .eq('belt_rank_required', true);
  
  if (!programs) return 'None available';
  
  // Filter programs by belt eligibility (would need to implement belt comparison logic)
  const eligiblePrograms = programs.filter(program => {
    // This would need proper belt comparison logic
    return true; // Simplified for example
  });
  
  return eligiblePrograms.map(p => p.name).join(', ') || 'None available';
}

// Belt progression tracking using existing belt_awards
export async function getBeltProgressionForStudent(studentId: string): Promise<{
  currentBelt: BeltRankEnum;
  beltHistory: Array<{
    belt: BeltRankEnum;
    awardedDate: string;
    description?: string;
  }>;
  nextBelt: BeltRankEnum | null;
  timeAtCurrentBelt: number; // days
}> {
  // Get all belt awards for student
  const { data: beltAwards } = await supabase
    .from('belt_awards')
    .select('type, awarded_date, description')
    .eq('student_id', studentId)
    .order('awarded_date', { ascending: false });
  
  const currentBelt = beltAwards?.[0]?.type || 'white';
  const beltHistory = beltAwards?.map(award => ({
    belt: award.type,
    awardedDate: award.awarded_date,
    description: award.description
  })) || [];
  
  // Calculate next belt
  const currentOrdinal = getBeltOrdinal(currentBelt);
  const nextBelt = getNextBelt(currentBelt);
  
  // Calculate time at current belt
  const currentBeltDate = beltAwards?.[0]?.awarded_date;
  const timeAtCurrentBelt = currentBeltDate 
    ? Math.floor((Date.now() - new Date(currentBeltDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  return {
    currentBelt,
    beltHistory,
    nextBelt,
    timeAtCurrentBelt
  };
}

function getNextBelt(currentBelt: BeltRankEnum): BeltRankEnum | null {
  const beltProgression: BeltRankEnum[] = [
    'white', 'yellow', 'orange', 'green', 'blue', 'purple', 'red', 'brown', 'black'
  ];
  
  const currentIndex = beltProgression.indexOf(currentBelt);
  if (currentIndex >= 0 && currentIndex < beltProgression.length - 1) {
    return beltProgression[currentIndex + 1];
  }
  
  return null; // Already at highest belt
}
``` 0; // Default to white belt (0) if no awards
}

async function getBeltRankName(rankId: number): Promise<string> {
  // This would query your existing belt ranking system
  // The exact implementation depends on how belt ranks are stored
  const beltNames = {
    0: 'White Belt',
    1: 'Yellow Belt', 
    2: 'Orange Belt',
    3: 'Green Belt',
    4: 'Blue Belt',
    5: 'Purple Belt',
    6: 'Brown Belt',
    7: 'Black Belt'
  };
  
  return beltNames[rankId] || 'Unknown Belt';
}

async function hasCompletedPrerequisitePrograms(
  studentId: string, 
  requiredPrograms: string[]
): Promise<boolean> {
  const result = await supabase
    .from('enrollments')
    .select('program_id')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .in('program_id', requiredPrograms);
  
  return (result.data?.length || 0) >= requiredPrograms.length;
}

async function getSuggestedProgramsForBeltRank(beltRank: number): Promise<string> {
  const result = await supabase
    .from('programs')
    .select('name')
    .lte('min_belt_rank', beltRank)
    .gte('max_belt_rank', beltRank)
    .eq('is_active', true);
  
  return result.data?.map(p => p.name).join(', ') || 'None available';
}
```

### Customer Promise Integration
```typescript
export function generateProgramPromise(program: Program): string {
  const category = getProgramCategory(program);
  const frequencyType = getProgramFrequencyType(program);
  
  let promise = `${program.name} - `;
  
  // Duration promise
  promise += `${program.durationMinutes} minute sessions`;
  
  // Frequency promise
  switch (frequencyType) {
    case 'fixed':
      promise += `, ${program.sessionsPerWeek}x per week`;
      break;
    case 'flexible':
      promise += `, ${program.minSessionsPerWeek}-${program.maxSessionsPerWeek}x per week`;
      break;
    case 'open':
      promise += `, attend as often as you like`;
      break;
  }
  
  // Capacity promise
  if (program.maxCapacity === 1) {
    promise += `, private 1:1 instruction`;
  } else if (program.maxCapacity && program.maxCapacity <= 6) {
    promise += `, small groups (max ${program.maxCapacity} students)`;
  } else if (program.maxCapacity) {
    promise += `, group classes (max ${program.maxCapacity} students)`;
  } else {
    promise += `, open attendance`;
  }
  
  return promise;
}

// Examples:
// "Little Dragons - 30 minute sessions, 2x per week, small groups (max 8 students)"
// "Private Lessons - 60 minute sessions, 1-3x per week, private 1:1 instruction"  
// "Competition Training - 90 minute sessions, 3-5x per week, group classes (max 12 students)"
// "Open Mat - 60 minute sessions, attend as often as you like, open attendance"
```

### Enrollment Types by Program Category
- **Private Programs**: Individual session payments only
- **Semi-Private Programs**: Monthly subscriptions or individual sessions
- **Group Programs**: Monthly subscriptions, yearly packages, or drop-ins
- **Open Programs**: Pay-per-session or monthly unlimited

### Enhanced Customer Experience with Belt Progression

With belt requirements, customers get clear progression pathways:

**"Little Dragons Beginners (Ages 4-6)"**
- 30-minute sessions, 2x per week
- White to Yellow Belt students
- Small groups (max 8 students)
- Monthly: $120
- *"Perfect for new students learning basic techniques"*

**"Teen Intermediate Karate (Ages 13-17)"**
- 45-minute sessions, 2x per week
- Green to Blue Belt students
- Regular groups (max 12 students)
- Monthly: $140
- *"Builds on fundamentals with advanced techniques"*

**"Competition Team Training"**
- 90-minute sessions, 3-5x per week (flexible)
- Purple Belt and above required
- Small groups (max 6 students)
- Monthly: $280
- *"Intensive training for advanced students preparing for tournaments"*

**"Open Mat Sessions"**
- 60-minute sessions, attend as often as you like
- All belt levels welcome
- Open attendance (unlimited)
- Per session: $25
- *"Practice and conditioning for all skill levels"*

### Family Program Discovery System
```typescript
export async function getRecommendedProgramsForStudent(
  studentId: string
): Promise<{
  currentlyEligible: Program[];
  progressionPathway: Array<{
    program: Program;
    prerequisiteSteps: string[];
    estimatedTimeToEligibility: string;
  }>;
  crossTrainingOptions: Program[];
}> {
  
  const student = await getStudentWithBeltHistory(studentId);
  if (!student) throw new Error('Student not found');
  
  const allPrograms = await getActivePrograms();
  const currentlyEligible = [];
  const progressionPathway = [];
  const crossTrainingOptions = [];
  
  for (const program of allPrograms) {
    const eligibility = await checkProgramEligibility(studentId, program.id);
    
    if (eligibility.eligible) {
      // Programs student can enroll in now
      if (program.beltRankRequired && program.minBeltRank !== null) {
        currentlyEligible.push(program);
      } else {
        crossTrainingOptions.push(program); // Open programs, conditioning, etc.
      }
    } else {
      // Programs student can work toward
      const beltRestriction = eligibility.reasons.find(r => r.type === 'belt_rank');
      if (beltRestriction && !beltRestriction.satisfied) {
        const prerequisiteSteps = await calculatePrerequisiteSteps(student, program);
        const estimatedTime = await estimateTimeToEligibility(student, program);
        
        progressionPathway.push({
          program,
          prerequisiteSteps,
          estimatedTimeToEligibility: estimatedTime
        });
      }
    }
  }
  
  return {
    currentlyEligible: currentlyEligible.sort((a, b) => (a.minBeltRank || 0) - (b.minBeltRank || 0)),
    progressionPathway: progressionPathway.sort((a, b) => 
      (a.program.minBeltRank || 0) - (b.program.minBeltRank || 0)
    ),
    crossTrainingOptions
  };
}

async function calculatePrerequisiteSteps(
  student: Student, 
  program: Program
): Promise<string[]> {
  const steps = [];
  const currentBeltRank = student.currentBeltRank || 0;
  
  if (program.minBeltRank && currentBeltRank < program.minBeltRank) {
    const requiredBelt = await getBeltRankName(program.minBeltRank);
    steps.push(`Advance to ${requiredBelt}`);
    
    // Add intermediate belt steps
    for (let rank = currentBeltRank + 1; rank < program.minBeltRank; rank++) {
      const beltName = await getBeltRankName(rank);
      steps.push(`Test for ${beltName}`);
    }
  }
  
  if (program.prerequisitePrograms && program.prerequisitePrograms.length > 0) {
    const completedPrograms = await getCompletedProgramsForStudent(student.id);
    const completedProgramIds = completedPrograms.map(p => p.id);
    
    const missingPrereqs = program.prerequisitePrograms.filter(
      prereqId => !completedProgramIds.includes(prereqId)
    );
    
    if (missingPrereqs.length > 0) {
      const missingProgramNames = await getProgramNames(missingPrereqs);
      steps.push(`Complete: ${missingProgramNames.join(', ')}`);
    }
  }
  
  return steps;
}

async function estimateTimeToEligibility(
  student: Student, 
  program: Program
): Promise<string> {
  const currentBeltRank = student.currentBeltRank || 0;
  
  if (!program.minBeltRank || currentBeltRank >= program.minBeltRank) {
    return 'Eligible now';
  }
  
  const beltsNeeded = program.minBeltRank - currentBeltRank;
  const monthsPerBelt = 6; // Average time between belt tests
  const totalMonths = beltsNeeded * monthsPerBelt;
  
  if (totalMonths <= 6) {
    return `${totalMonths} months`;
  } else if (totalMonths <= 12) {
    return `${Math.round(totalMonths / 3)} quarters`;
  } else {
    return `${Math.round(totalMonths / 12)} years`;
  }
}
```

### Admin Belt Management Interface
```typescript
export interface BeltProgressionReport {
  studentId: string;
  studentName: string;
  currentBelt: {
    rank: number;
    name: string;
    achievedDate: string;
    monthsAtCurrentBelt: number;
  };
  nextBelt: {
    rank: number;
    name: string;
    eligibleForTest: boolean;
    estimatedTestDate: string;
    requirementsToMeet: string[];
  };
  enrolledPrograms: Array<{
    programName: string;
    appropriateForBeltLevel: boolean;
    shouldConsiderAdvancement: boolean;
  }>;
  recommendedPrograms: Program[];
}

export async function generateBeltProgressionReport(
  studentId: string
): Promise<BeltProgressionReport> {
  const student = await getStudentWithBeltHistory(studentId);
  if (!student) throw new Error('Student not found');
  
  const currentBeltRank = student.currentBeltRank || 0;
  const currentBelt = await getBeltRankById(currentBeltRank);
  const nextBelt = await getBeltRankById(currentBeltRank + 1);
  
  const enrolledPrograms = await getActiveEnrollmentsForStudent(studentId);
  const recommendedPrograms = await getRecommendedProgramsForStudent(studentId);
  
  return {
    studentId,
    studentName: student.name,
    currentBelt: {
      rank: currentBeltRank,
      name: currentBelt.name,
      achievedDate: student.beltAchievedDate || 'Unknown',
      monthsAtCurrentBelt: calculateMonthsAtBelt(student.beltAchievedDate)
    },
    nextBelt: {
      rank: currentBeltRank + 1,
      name: nextBelt?.name || 'Max rank achieved',
      eligibleForTest: student.beltTestEligible || false,
      estimatedTestDate: student.nextBeltTestDate || 'TBD',
      requirementsToMeet: await getBeltTestRequirements(currentBeltRank + 1)
    },
    enrolledPrograms: enrolledPrograms.map(enrollment => ({
      programName: enrollment.program.name,
      appropriateForBeltLevel: isProgramAppropriateForBeltLevel(enrollment.program, currentBeltRank),
      shouldConsiderAdvancement: shouldConsiderAdvancement(enrollment.program, currentBeltRank)
    })),
    recommendedPrograms: recommendedPrograms.currentlyEligible
  };
}
```ict) {
      conflicts.push({
        existingClass: existingClass.name,
        conflictType: 'schedule',
        details: `Time conflict: ${scheduleConflict.details}`
      });
    }
  }
  
  // Check frequency overload for subscription programs
  const totalWeeklyHours = calculateTotalWeeklyHours(student.activeEnrollments, newClass);
  if (totalWeeklyHours > 10) { // Configurable threshold
    warnings.push(
      `This enrollment would result in ${totalWeeklyHours} hours per week of training. ` +
      `Consider student's age and energy levels.`
    );
  }
  
  return {
    canEnroll: conflicts.length === 0,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
```

## Family Portal Payment System Updates

### Enrollment-Based Payment Processing

The family portal payment system is updated to handle payments based on actual class enrollments rather than program categories. Students can have multiple enrollments with different payment preferences, and subscription options are mutually exclusive.

#### Enhanced Payment Calculation Function

**File: `app/services/payment.server.ts`**

```typescript
export interface PaymentCalculationParams {
  enrollmentId: string;
  paymentType: 'monthly_subscription' | 'yearly_subscription' | 'individual_session' | 'trial';
  sessionDate?: string; // Required for individual sessions
}

export async function calculatePaymentAmount(params: PaymentCalculationParams): Promise<{
  amount: number;
  description: string;
  paymentType: 'monthly_fee' | 'yearly_fee' | 'session_fee' | 'registration_fee' | 'trial';
  enrollmentId: string;
  dueDate?: string;
  sessionDate?: string;
}> {
  const enrollment = await getEnrollmentById(params.enrollmentId);
  const program = await getProgramById(enrollment.programId);
  const class_ = await getClassById(enrollment.classId);
  
  if (!enrollment || !program || !class_) {
    throw new Error('Enrollment, program, or class not found');
  }
  
  // Check if program supports the requested payment type
  const supportedPaymentTypes = getSupportedPaymentTypes(program);
  if (!supportedPaymentTypes.includes(params.paymentType)) {
    throw new Error(`${params.paymentType} not available for ${program.name}`);
  }
  
  switch (params.paymentType) {
    case 'monthly_subscription':
      return {
        amount: program.monthlyFee + (enrollment.hasRegistrationFee ? program.registrationFee || 0 : 0),
        description: `Monthly subscription: ${program.name} - ${class_.name}`,
        paymentType: 'monthly_fee',
        enrollmentId: enrollment.id,
        dueDate: getNextMonthlyDueDate()
      };

    case 'yearly_subscription':
      const yearlyDiscount = program.monthlyFee * 2; // 2 months free
      return {
        amount: (program.monthlyFee * 10) + (enrollment.hasRegistrationFee ? program.registrationFee || 0 : 0),
        description: `Annual subscription: ${program.name} - ${class_.name} (2 months free!)`,
        paymentType: 'yearly_fee',
        enrollmentId: enrollment.id,
        dueDate: getNextYearlyDueDate()
      };

    case 'individual_session':
      if (!params.sessionDate) {
        throw new Error('Session date required for individual session payment');
      }
      return {
        amount: program.individualSessionFee,
        description: `Single session: ${program.name} - ${class_.name} on ${formatDate(params.sessionDate)}`,
        paymentType: 'session_fee',
        enrollmentId: enrollment.id,
        sessionDate: params.sessionDate
      };

    case 'trial':
      return {
        amount: 0,
        description: `Trial session: ${program.name} - ${class_.name}`,
        paymentType: 'trial',
        enrollmentId: enrollment.id
      };
  }
}

// Helper function to determine supported payment types based on program
function getSupportedPaymentTypes(program: Program): string[] {
  const types = ['trial'];
  
  // All programs support individual sessions if they have a session fee
  if (program.individualSessionFee && program.individualSessionFee > 0) {
    types.push('individual_session');
  }
  
  // Only programs with monthly fees support subscriptions
  if (program.monthlyFee && program.monthlyFee > 0) {
    types.push('monthly_subscription', 'yearly_subscription');
  }
  
  return types;
}
```

#### Student-Specific Payment Integration

**File: `app/routes/_layout.family.student.$studentId.tsx`**

Payment options are integrated directly into each student's page, showing enrollment-specific payment choices:

```typescript
// Student payment options interface with mutually exclusive subscriptions
export interface StudentPaymentOptions {
  enrollmentId: string;
  programName: string;
  className: string;
  
  // Mutually exclusive subscription options (radio button selection)
  subscriptionOptions: {
    monthly: {
      available: boolean;
      amount: number;
      description: string;
      currentlyActive: boolean;
    };
    yearly: {
      available: boolean;
      amount: number;
      description: string;
      savings: number; // Amount saved compared to monthly
      currentlyActive: boolean;
    };
  };
  
  // Separate individual session option
  individualSession: {
    available: boolean;
    amount: number;
    description: string;
    nextAvailableDate?: string;
  };
  
  // Current payment status
  currentStatus: {
    hasActiveSubscription: boolean;
    subscriptionType?: 'monthly' | 'yearly';
    nextDueDate?: string;
    membershipExpired: boolean;
  };
}

// Enhanced student page payment section
export interface StudentPageData {
  student: Student;
  enrollments: Array<{
    id: string;
    program: Program;
    class: Class;
    paymentOptions: StudentPaymentOptions;
    enrollmentStatus: 'active' | 'pending_payment' | 'expired';
  }>;
}
```

#### Payment UI Behavior

**Active Membership:**
- Show current subscription type and next due date
- Allow switching between monthly/yearly (with prorated adjustment)
- Individual session option available for additional classes

**Expired/No Membership:**
- Radio buttons for monthly OR yearly subscription
- Individual session option as alternative
- Clear pricing comparison between options

#### Payment History Enhancements

**File: `app/routes/_layout.family.payment-history.tsx`**

Enhanced payment history to categorize by payment type:

```typescript
export interface EnhancedPaymentHistory {
  subscriptionPayments: Payment[]; // Monthly/yearly recurring payments
  sessionPayments: Payment[];      // Individual session payments  
  registrationFees: Payment[];     // One-time registration fees
  refunds: Payment[];              // Any refunds or credits
}
```

#### Enhanced Student Page Payment Integration

**Updated Routes:**

1. **`_layout.family.student.$studentId.tsx`** - Enhanced with payment section
  - Display all enrollments with payment options
  - Mutually exclusive subscription selection (radio buttons)
  - Individual session payment option
  - Current subscription status and management
  - Payment button next to each enrollment

2. **`_layout.family.payment.tsx`** - Simplified family payment overview
  - Summary of all active subscriptions across students
  - Upcoming payment due dates
  - Payment history access
  - Family-wide payment method management

3. **`_layout.family.payment.setup.tsx`** - Payment method management (unchanged)
  - Add/remove credit cards
  - Set up autopay for subscriptions
  - Configure payment preferences by student/program

#### Payment Method Configuration

```typescript
export interface FamilyPaymentPreferences {
  defaultPaymentMethod: 'stripe' | 'bank_transfer' | 'cash';
  autoPayEnabled: boolean;
  autoPayEnrollments: string[]; // Enrollment IDs to auto-pay (not program IDs)
  paymentNotifications: {
    email: boolean;
    sms: boolean;
    daysBeforeDue: number;
  };
  familyDiscountOptIn: boolean;
}
```

### Key Payment System Changes Summary

Based on the discussion and requirements clarification, the payment system has been updated with the following key principles:

#### 1. Enrollment-Based Payments
- Payments are calculated based on actual class enrollments, not program categories
- Each enrollment can have different payment preferences
- Students can have multiple enrollments with mixed payment types

#### 2. Mutually Exclusive Subscription Options
- Monthly and yearly subscriptions are mutually exclusive (radio button selection)
- Individual session payments are separate option
- Clear UI prevents confusion between subscription types

#### 3. Student-Specific Payment Integration
- Payment options integrated into existing student pages (`_layout.family.student.$studentId.tsx`)
- Payment button next to each enrollment's purchase option
- No complex new route structures needed

#### 4. Simplified Payment Logic
- `calculatePaymentAmount()` function takes `enrollmentId` instead of `programId`
- `getSupportedPaymentTypes()` helper determines available options per program
- Registration fees handled per enrollment, not globally

#### 5. Enhanced User Experience
- Clear pricing comparison between monthly/yearly options
- Current subscription status prominently displayed
- Prorated adjustments when switching subscription types
- Individual session option always available for additional classes

## Admin Interface Enhancements

### Program Creation with Capacity Guidance

**Enhanced Program Creation Form:**
- Max Capacity field with guidance:
  - "1" → "Private lesson program - all classes will be 1:1"
  - "2-6" → "Semi-private program - small group focused"
  - "7+" → "Group program - regular class sizes"
  - "Unlimited" → "Open program - no capacity restrictions"

### Class Creation with Capacity Validation

**Enhanced Class Creation:**
- Shows program capacity limit
- Suggests appropriate capacities based on program type
- Validates capacity doesn't exceed program limit
- Pricing preview based on program category

### Enhanced Analytics

**New Admin Reports:**
- Revenue by program category (private vs group vs open)
- Capacity utilization by program type
- Enrollment trends by payment type (subscription vs session)
- Family enrollment patterns across multiple programs

## Migration Strategy

### Phase 1: Schema Updates
```sql
-- Add max_capacity to programs
ALTER TABLE programs ADD COLUMN max_capacity INTEGER NULL;

-- Add capacity constraint to classes
ALTER TABLE classes ADD CONSTRAINT class_capacity_within_program_limit 
CHECK (
  max_capacity IS NULL OR 
  (SELECT max_capacity FROM programs WHERE id = program_id) IS NULL OR
  max_capacity <= (SELECT max_capacity FROM programs WHERE id = program_id)
);
```

### Phase 2: Data Migration
```sql
-- Set sensible defaults based on existing pricing patterns
UPDATE programs SET max_capacity = 1 
WHERE monthly_fee = 0 AND individual_session_fee > 50; -- Likely private lessons

UPDATE programs SET max_capacity = 20 
WHERE monthly_fee > 0 AND individual_session_fee < 50; -- Likely group programs

UPDATE programs SET max_capacity = NULL 
WHERE name ILIKE '%open%' OR name ILIKE '%drop%'; -- Likely open programs
```

### Phase 3: Business Logic Updates
- Update enrollment validation to check program capacity constraints
- Enhance payment calculation to handle multiple enrollment types
- Add program category detection and class suggestions

### Phase 4: UI Updates
- Update admin program/class creation forms
- Enhance family payment interfaces
- Add program browsing by category
- Update enrollment flows

## Implementation Progress Update

### ✅ COMPLETED (Latest Implementation)

#### Database Schema Enhancements
- **Programs Table**: Added new fields for capacity, frequency, and belt requirements:
  - `max_capacity` - Upper bound for all classes in program
  - `sessions_per_week` - Required frequency
  - `min_sessions_per_week` / `max_sessions_per_week` - Flexible frequency options
  - `min_belt_rank` / `max_belt_rank` - Belt rank requirements
  - `belt_rank_required` - Whether belt rank is enforced
  - `prerequisite_programs` - Array of required prerequisite programs

- **Database Functions**: Created comprehensive validation and helper functions:
  - `check_program_eligibility()` - Validates student eligibility based on age, belt rank, and prerequisites
  - `validate_class_frequency()` - Ensures class schedules align with program frequency requirements
  - Database triggers for automatic validation

#### TypeScript Type System Updates
- **Enhanced Interfaces**: Updated `Program` and `CreateProgramData` interfaces in:
  - `database.types.ts` - Core database type definitions
  - `models.ts` - Application model interfaces
  - `multi-class.ts` - Multi-class system specific types

#### Service Layer Enhancements
- **Program Services**: Updated `program.server.ts` with:
  - Enhanced `createProgram()` function supporting all new fields
  - Enhanced `updateProgram()` function for comprehensive program updates
  - Improved `checkProgramEligibility()` utilizing new database validation function

#### Admin Interface Updates
- **Program Creation Form** (`admin.programs.new.tsx`):
  - Added "Capacity & Frequency" section with max capacity and session frequency controls
  - Added "Belt Requirements" section with belt rank selection and enforcement toggle
  - Form validation and data processing for all new fields

- **Program Edit Form** (`admin.programs.$id.edit.tsx`):
  - Added same capacity, frequency, and belt requirement sections
  - Updated form data extraction and submission logic
  - Maintained proper tab indexing for form navigation

### 🔄 IN PROGRESS / NEXT STEPS

#### Backend Updates Still Needed
1. **Class Capacity Validation** - Implement runtime validation that class capacity doesn't exceed program max_capacity
2. **Enhanced Enrollment Logic** - Update enrollment services to use new eligibility checking
3. **Program Categorization** - Implement business logic for program category detection
4. **Enrollment-Based Payment Calculation** - Update payment logic to use enrollmentId and support mutually exclusive subscription options
5. **Student Payment Options API** - Create API endpoint to retrieve payment options for student enrollments

#### Admin Interface Updates Needed
1. **Class Creation Form** - Add capacity constraints and validation against program limits
2. **Program Analytics** - Add reporting by program category and capacity utilization
3. **Enrollment Management** - Enhanced enrollment interfaces using new eligibility system

#### Family Portal Updates Needed
1. **Program Browsing** - Group programs by category (private, group, open) based on capacity
2. **Enrollment Flow** - Integrate new eligibility checking into enrollment process
3. **Prerequisites Display** - Show prerequisite programs and completion status

#### ✅ COMPLETED - Enrollment-Based Payment System
- **Student Payment Options Service** (`app/services/enrollment-payment.server.ts`):
  - `getStudentPaymentOptions()` - Fetches payment options for specific student enrollments
  - `calculatePaymentAmount()` - Calculates payment amounts based on enrollment and payment type
  - `getSupportedPaymentTypes()` - Determines available payment types per program
  - Support for monthly, yearly, individual session, and trial payment types

- **Student Payment API** (`api.student-payment-options.$studentId.ts`):
  - RESTful endpoint for fetching student-specific payment options
  - Family authorization validation
  - Integration with enrollment-payment service

- **Student Payment UI Component** (`app/components/StudentPaymentSection.tsx`):
  - Enrollment-based payment selection interface
  - Mutually exclusive subscription options (radio buttons for monthly/yearly)
  - Individual session quantity selection
  - Real-time payment calculation and summary
  - Integration with existing student page layout

- **Enhanced Student Page** (`_layout.family.student.$studentId.tsx`):
  - Integrated StudentPaymentSection component after enrollments section
  - Maintains existing page structure and functionality
  - Seamless payment options display for each student's enrollments

#### ✅ COMPLETED - Discount System Integration

**Overview**: Integrated the existing discount system with the new student payment functionality, enabling families to apply available discounts during the student payment process.

- **Student-Family API Endpoint** (`api.student-family.$studentId.ts`):
  - New API endpoint to fetch `familyId` for a given `studentId`
  - Required for discount functionality since discounts are family-scoped
  - Includes proper authentication and authorization checks
  - Error handling for invalid student IDs or access permissions

- **Enhanced Student Payment Component** (`app/components/StudentPaymentSection.tsx`):
  - **Discount State Management**: Added state variables for discount functionality:
    - `applyDiscount` - Toggle for enabling/disabling discount application
    - `availableDiscounts` - List of applicable discounts for the family
    - `selectedDiscountId` - Currently selected discount
    - `appliedDiscount` - Details of the applied discount
    - `isLoadingDiscounts` - Loading state for discount fetching
  
  - **Automatic Discount Loading**: Implemented useEffect hooks to:
    - Fetch family ID when component mounts
    - Calculate current subtotal based on selected enrollment and payment type
    - Load available discounts when discount toggle is enabled
    - Auto-select the best available discount (highest value)
    - Validate selected discount codes in real-time
  
  - **Payment Calculation Updates**:
    - Modified `calculateAmount()` function to apply discount deductions
    - Added `getSubtotalAmount()` helper for pre-discount calculations
    - Added `getDiscountAmount()` helper for discount value calculations
    - Updated payment summary to show subtotal, discount, and final total
  
  - **Discount UI Components**:
    - Checkbox to enable/disable discount application
    - Dropdown selector for available discounts with loading states
    - Visual indicators for applied discounts (CheckCircledIcon)
    - Detailed payment breakdown showing discount savings
    - Integration with existing payment flow and navigation
  
  - **URL Parameter Integration**:
    - Added `discountId` to URL search parameters when navigating to payment
    - Ensures discount selection persists through the payment flow
    - Only includes discount parameter when actually applied

- **API Integration Points**:
  - **Available Discounts API** (`/api/available-discounts/${familyId}`):
    - Fetches family-specific discounts based on payment type and subtotal
    - Filters discounts by scope (per-student vs per-family)
    - Respects usage limits and one-time usage restrictions
  
  - **Discount Validation API** (`/api/discount-codes/validate`):
    - Real-time validation of selected discount codes
    - Ensures discount is still valid and applicable
    - Provides detailed error messages for invalid discounts

- **Payment Type Filtering Enhancement**:
  - Updated discount loading to use `applicable_to` parameter
  - Ensures only relevant discounts are shown for selected payment type
  - Supports monthly, yearly, individual session, and trial payment types

**Key Features Implemented**:
1. **Seamless Integration**: Discount functionality integrates naturally with existing payment flow
2. **Real-time Validation**: Discounts are validated as they're selected
3. **Smart Auto-selection**: Best available discount is automatically selected
4. **Payment Type Awareness**: Only shows discounts applicable to selected payment type
5. **Family-scoped Discounts**: Properly handles family-level discount permissions
6. **Visual Feedback**: Clear indication of applied discounts and savings
7. **Persistent Selection**: Discount choices persist through payment navigation

**Business Impact**:
- Families can easily discover and apply available discounts
- Reduced friction in the payment process
- Improved transparency in pricing with clear discount breakdowns
- Maintains existing discount business logic and validation rules

#### ✅ COMPLETED - Payment Form Refactoring & Code Consolidation

**Overview**: Extracted common payment functionality into a reusable component to eliminate code duplication between family payment page and student payment section.

- **PaymentForm Component** (`app/components/PaymentForm.tsx`):
  - **Unified Payment Logic**: Created centralized component handling both individual student and family payment scenarios
  - **Mode-based Rendering**: Supports "family" and "student" modes with appropriate UI adaptations
  - **Comprehensive State Management**: Manages payment options, student selection, discount application, and form submission
  - **Reusable Discount Integration**: Centralized discount loading, validation, and application logic
  - **Payment Type Support**: Handles monthly, yearly, and individual session payment types
  - **Dynamic Calculations**: Real-time subtotal, discount, and total calculations

- **Family Payment Page Refactoring** (`app/routes/_layout.family.payment.tsx`):
  - **Simplified Implementation**: Replaced 1000+ lines of complex payment logic with PaymentForm component usage
  - **Maintained Functionality**: Preserved all existing features including multi-student selection and discount application
  - **Cleaner Architecture**: Separated data loading (loader function) from UI rendering (PaymentForm component)
  - **Reduced Maintenance**: Payment logic updates now only need to be made in one place

- **Student Payment Section Refactoring** (`app/components/StudentPaymentSection.tsx`):
  - **Component Simplification**: Reduced from ~570 lines to ~150 lines while maintaining full functionality
  - **Data Transformation**: Added helper function to convert enrollment data to PaymentForm's expected format
  - **Consistent UI**: Student payments now use identical interface patterns as family payments
  - **Enrollment Integration**: Seamlessly integrates with existing enrollment display and selection

- **Type System Enhancements** (`app/types/payment.ts`):
  - **StudentPaymentDetail Interface**: Defined standardized data structure for payment form integration
  - **Mode-based Props**: Added type definitions for component mode switching
  - **Enrollment Data Mapping**: Type-safe transformation between enrollment and payment data structures

**Technical Benefits**:
1. **Code Reusability**: Single payment component serves both family and student payment flows
2. **Maintainability**: Bug fixes and feature additions only need to be implemented once
3. **Consistency**: Identical payment behavior and UI across different contexts
4. **Reduced Complexity**: Eliminated duplicate state management and business logic
5. **Type Safety**: Comprehensive TypeScript interfaces ensure data integrity
6. **Testing Efficiency**: Single component to test instead of multiple implementations

**Business Impact**:
- **Consistent User Experience**: Families see identical payment interfaces regardless of entry point
- **Reduced Development Time**: Future payment features can be implemented once and used everywhere
- **Lower Bug Risk**: Centralized logic reduces chances of inconsistent behavior
- **Easier Maintenance**: Payment-related changes require updates in only one location

**Code Quality Improvements**:
- **DRY Principle**: Eliminated significant code duplication between payment flows
- **Single Responsibility**: PaymentForm component has clear, focused responsibility
- **Separation of Concerns**: Data loading separated from UI rendering logic
- **Component Reusability**: PaymentForm can be easily extended for future payment scenarios

#### ✅ COMPLETED - Payment Eligibility Service Extraction

**Overview**: Extracted data fetching and eligibility filtering logic into a reusable service to eliminate code duplication and create a centralized payment eligibility system.

- **Payment Eligibility Service** (`app/services/payment-eligibility.server.ts`):
  - **Centralized Data Fetching**: Consolidated family, student, payment history, and discount data retrieval
  - **Reusable Eligibility Logic**: Extracted `checkStudentEligibility` integration for consistent eligibility determination
  - **Family-scoped Operations**: `getFamilyPaymentEligibilityData()` for multi-student family payment scenarios
  - **Student-scoped Operations**: `getStudentPaymentEligibilityData()` for individual student payment scenarios
  - **Helper Functions**: `getFamilyIdFromUser()` for user-to-family mapping with proper error handling
  - **Standardized Data Structure**: `PaymentEligibilityData` interface for consistent API responses

- **Family Payment Page Integration** (`app/routes/_layout.family.payment.tsx`):
  - **Service Integration**: Replaced inline data fetching with `getFamilyPaymentEligibilityData()` service call
  - **Simplified Loader**: Reduced loader complexity by delegating data operations to service layer
  - **Type Safety**: Updated `LoaderData` interface to extend `PaymentEligibilityData`
  - **Error Handling**: Centralized error handling through service layer

- **Student Payment Component Integration** (`app/components/StudentPaymentSection.tsx`):
  - **API Endpoint Usage**: Updated to fetch data from `/api/student-payment-eligibility/$studentId`
  - **Consistent Data Structure**: Uses same `PaymentEligibilityData` type as family payment page
  - **Simplified State Management**: Removed duplicate discount and family ID fetching logic
  - **Unified Error Handling**: Consistent error states across payment contexts

- **New API Endpoint** (`app/routes/api.student-payment-eligibility.$studentId.ts`):
  - **Student-specific Endpoint**: RESTful API for individual student payment eligibility data
  - **Authorization Validation**: Ensures users can only access students from their own family
  - **Service Integration**: Uses `getStudentPaymentEligibilityData()` for data retrieval
  - **Comprehensive Error Handling**: Proper HTTP status codes and error messages

**Technical Benefits**:
1. **Code Reusability**: Single service handles payment eligibility for both family and student contexts
2. **Maintainability**: Eligibility logic updates only need to be made in one location
3. **Consistency**: Identical data fetching and processing across different payment entry points
4. **Separation of Concerns**: Business logic separated from UI components and route handlers
5. **Type Safety**: Comprehensive TypeScript interfaces ensure data integrity
6. **Testability**: Isolated service functions are easier to unit test

**Business Impact**:
- **Consistent Eligibility Logic**: Same eligibility rules applied regardless of payment entry point
- **Improved Performance**: Centralized data fetching reduces redundant database queries
- **Better Error Handling**: Standardized error responses improve user experience
- **Easier Maintenance**: Payment eligibility changes require updates in only one service

**Code Quality Improvements**:
- **DRY Principle**: Eliminated duplicate data fetching and eligibility checking code
- **Single Responsibility**: Payment eligibility service has focused, clear responsibility
- **API Consistency**: Standardized response format across payment-related endpoints
- **Service Layer Pattern**: Proper separation between data access, business logic, and presentation layers

#### ✅ COMPLETED - Admin Dashboard Session Management Enhancements

**Overview**: Enhanced the admin dashboard with real-time session management capabilities, providing administrators with immediate visibility into today's class sessions and quick access to attendance recording and session status management.

- **Session Data Integration** (`app/routes/admin._index.tsx`):
  - **Today's Sessions Query**: Added comprehensive database query to fetch all sessions scheduled for the current date
  - **Session Status Calculation**: Real-time calculation of session statistics including:
    - Total sessions scheduled for today
    - Completed sessions count
    - In-progress sessions (currently happening based on start/end times)
    - Upcoming sessions (scheduled but not yet started)
  - **Relational Data Loading**: Fetches session data with related class and program information for context
  - **Error Handling**: Proper error handling for session data fetching with fallback values

- **Dashboard UI Enhancements**:
  - **Today's Sessions Card**: New stat card displaying session overview with:
    - Total sessions count as primary metric
    - Breakdown of completed, in-progress, and upcoming sessions
    - Direct link to session management interface
    - Blue color scheme to distinguish from other metrics
  
  - **System Status Session Section**: Enhanced system status area with:
    - **Live Session List**: Display of up to 3 current/upcoming sessions
    - **Session Details**: Class name, time range, and current status
    - **Quick Action Buttons**: Direct links to attendance recording and session completion
    - **Attendance Shortcut**: One-click access to record attendance for each session
    - **Complete Session Shortcut**: Quick action to mark sessions as completed
    - **Responsive Design**: Optimized layout for both light and dark themes

- **Session Management Features**:
  - **Real-time Status Detection**: Automatically determines if sessions are in progress based on current time
  - **Quick Navigation**: Direct links to session-specific management pages
  - **Contextual Actions**: Different action buttons based on session status (scheduled vs completed)
  - **Overflow Handling**: "View all sessions" link when more than 3 sessions exist
  - **Empty State**: Appropriate messaging when no sessions are scheduled

- **Data Structure Enhancements**:
  - **Loader Data Extension**: Added session-related fields to admin dashboard loader response:
    - `totalTodaysSessions` - Count of all sessions today
    - `completedSessions` - Count of completed sessions
    - `inProgressSessions` - Count of currently active sessions
    - `upcomingSessions` - Count of future sessions today
    - `todaysSessions` - Full array of session objects with class details

**Technical Implementation**:
1. **Database Query Optimization**: Efficient single query to fetch session data with joins
2. **Time-based Logic**: JavaScript date/time calculations for session status determination
3. **Component Integration**: Seamless integration with existing dashboard layout
4. **Type Safety**: Proper TypeScript typing for session data structures
5. **Performance**: Minimal impact on dashboard load time with optimized queries

**User Experience Improvements**:
- **Administrative Efficiency**: Immediate visibility into daily session schedule
- **Quick Actions**: Reduced clicks to access common session management tasks
- **Real-time Awareness**: Live status updates help administrators stay informed
- **Contextual Navigation**: Direct links to relevant session management interfaces
- **Visual Clarity**: Clear distinction between different session states

**Business Impact**:
- **Operational Oversight**: Enhanced visibility into daily class operations
- **Attendance Management**: Streamlined access to attendance recording
- **Session Tracking**: Better monitoring of class completion rates
- **Administrative Productivity**: Reduced time to access session management functions
- **Real-time Operations**: Support for dynamic session status management

**Future Enhancement Foundation**:
- **Session Analytics**: Framework for tracking session completion patterns
- **Attendance Insights**: Foundation for attendance rate monitoring
- **Instructor Dashboard**: Extensible design for instructor-specific session views
- **Mobile Optimization**: Responsive design ready for mobile admin access
- **Notification Integration**: Prepared for future session reminder/alert features

#### ✅ COMPLETED - Session-Based Attendance System

**Overview**: Completely redesigned the attendance system to work with class sessions instead of class dates, providing more accurate tracking, enhanced status options, and better integration with the multi-class system.

- **Database Migration** (`supabase/migrations/002_update_attendance_for_sessions.sql`):
  - **Schema Transformation**: Updated `attendance` table to use `class_session_id` instead of `class_date`
  - **Status Enhancement**: Replaced boolean `present` field with `attendance_status` enum ('present', 'absent', 'excused', 'late')
  - **Foreign Key Relationships**: Added proper relationship to `class_sessions` table with cascade delete
  - **Backward Compatibility**: Maintained old columns during transition for safe migration
  - **RLS Policies**: Updated Row Level Security policies for session-based access control
  - **Indexing**: Added optimized indexes for `class_session_id` and `student_id` lookups

- **Centralized Service Layer** (`app/services/attendance.server.ts`):
  - **Session-Based Functions**: Complete set of functions for session-based attendance operations
  - **Data Retrieval**: `getAttendanceBySession()`, `getAttendanceByStudent()`, `getAttendanceByDateRange()`
  - **Recording Operations**: `recordSessionAttendance()` with atomic delete/insert operations
  - **Analytics Functions**: `getStudentAttendanceStats()`, `getSessionAttendanceSummary()`
  - **Utility Functions**: `deleteAttendanceRecord()`, `hasAttendanceRecords()`
  - **Type Safety**: Comprehensive TypeScript interfaces for all attendance operations

- **Admin Interface Redesign** (`app/routes/admin.attendance.record.tsx`):
  - **Session Selection**: Dropdown interface for selecting specific class sessions
  - **Enhanced UI**: Improved form layout with session details and student roster
  - **Status Options**: Support for all attendance status types (present, absent, excused, late)
  - **Bulk Operations**: Efficient recording of attendance for entire class sessions
  - **Notification Integration**: Automated absence notifications for absent students
  - **Service Integration**: Complete migration from direct database queries to service layer

- **Calendar Integration Updates**:
  - **Calendar Components** (`app/routes/admin.calendar.tsx`, `admin.calendar.new.tsx`):
    - Updated to use `class_session_id` for attendance record checking
    - Modified event mapping to use session IDs instead of dates
    - Maintained visual indicators for sessions with recorded attendance
  - **Calendar Utils** (`app/components/calendar/utils.ts`):
    - Updated attendance-to-calendar event mapping for session-based structure
    - Preserved existing calendar functionality with new data model

- **Type System Updates**:
  - **Database Types** (`app/types/database.types.ts`):
    - Added `attendance_status` enum definition
    - Updated `attendance` table structure with session-based fields
    - Maintained type safety across all attendance operations
  - **Model Interfaces** (`app/types/models.ts`):
    - Updated `AttendanceRecord` interface for session-based structure
    - Replaced `classDate` with `classSessionId` and `present` with `status`

**Technical Benefits**:
1. **Session Accuracy**: Attendance tied to specific class sessions rather than arbitrary dates
2. **Multi-Class Support**: Proper handling of multiple classes on the same date
3. **Enhanced Tracking**: Four-state attendance status instead of binary present/absent
4. **Data Integrity**: Foreign key relationships ensure attendance records match actual sessions
5. **Service Architecture**: Centralized business logic for easier maintenance and testing
6. **Type Safety**: Comprehensive TypeScript coverage for all attendance operations

**Business Impact**:
- **Accurate Records**: Attendance tracking aligned with actual class sessions
- **Flexible Status**: Support for excused absences and late arrivals
- **Multi-Class Ready**: Foundation for students attending multiple classes per day
- **Automated Notifications**: Streamlined absence notification system
- **Administrative Efficiency**: Improved UI for faster attendance recording
- **Data Reliability**: Stronger data model prevents orphaned attendance records

**Migration Strategy**:
- **Safe Transition**: Backward compatibility maintained during migration period
- **Data Preservation**: Existing attendance data backed up before transformation
- **Gradual Rollout**: Old columns kept until all systems updated
- **Validation**: Comprehensive testing of migration scripts and new functionality

#### Testing & Validation Needed
1. **Database Migration Testing** - Ensure all new fields and functions work correctly
2. **Form Validation Testing** - Test all new admin form fields and validation
3. **Eligibility Logic Testing** - Comprehensive testing of belt rank and prerequisite validation
4. **Integration Testing** - End-to-end testing of program creation to enrollment flow
5. **Session Management Testing** - Validate session status calculations and dashboard integration
6. **Attendance System Testing** - Comprehensive testing of session-based attendance recording and reporting

### Success Metrics

#### Business Impact
- **Pricing Clarity**: Clear pricing structure by program category
- **Enrollment Flexibility**: Students can enroll in multiple program types
- **Revenue Optimization**: Appropriate pricing for different capacity levels
- **Operational Efficiency**: Simplified program and class management

#### User Experience
- **Family Understanding**: Clear categories (private, group, open sessions)
- **Admin Efficiency**: Guided program creation with capacity constraints
- **Payment Simplicity**: Appropriate payment types for each program category
- **Enrollment Logic**: Natural enrollment rules based on program type

## Conclusion

The Program Max Capacity system creates a clean hierarchy where:
- **Programs** define the business model (pricing + maximum possible capacity)
- **Classes** define the delivery format (actual capacity within program limits)
- **Enrollments** follow natural rules based on program category
- **Payments** are calculated appropriately for each enrollment type

This approach maintains pricing simplicity while enabling flexible capacity management and multiple enrollment types per student, creating a robust foundation for diverse martial arts program offerings.