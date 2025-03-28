-- Run this in your Supabase SQL Editor

-- Enable required extensions
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Create tables with proper relationships and security

-- Families table
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  province text not null,
  postal_code varchar(10) not null,
  primary_phone varchar(20) not null,
  email text not null,
  referral_source text,
  emergency_contact text,
  health_info text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table families enable row level security;

-- Guardians table
create table guardians (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  relationship text not null,
  home_phone varchar(20) not null,
  work_phone varchar(20),
  cell_phone varchar(20) not null,
  email text not null,
  employer text,
  employer_phone varchar(20),
  employer_notes text
);

create index idx_guardians_family_id on guardians (family_id);
alter table guardians enable row level security;

-- Students table
create table students (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  gender text not null,
  birth_date date not null,
  belt_rank text,
  t_shirt_size text not null,
  school text not null,
  grade_level text,
  cell_phone varchar(20),
  email text,
  immunizations_up_to_date text,
  immunization_notes text,
  allergies text,
  medications text,
  special_needs text
);

create index idx_students_family_id on students (family_id);
alter table students enable row level security;

-- Payments table
create type payment_status as enum ('pending', 'completed', 'failed');

create table payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  amount numeric(10,2) not null,
  payment_date date not null,
  payment_method text not null,
  status payment_status not null default 'pending'
);

create index idx_payments_family_id on payments (family_id);
alter table payments enable row level security;

-- Payment-Students junction table
create table payment_students (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references payments(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null
);

create index idx_payment_students_payment_id on payment_students (payment_id);
create index idx_payment_students_student_id on payment_students (student_id);
alter table payment_students enable row level security;

-- Achievements table
create table achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  type text not null,
  description text not null,
  awarded_date date not null
);

create index idx_achievements_student_id on achievements (student_id);
alter table achievements enable row level security;

-- Attendance table
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  class_date date not null,
  present boolean not null,
  notes text
);

create index idx_attendance_student_id on attendance (student_id);
alter table attendance enable row level security;

-- Waivers table
create table waivers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  content text not null,
  required boolean not null default false
);

alter table waivers enable row level security;

-- Waiver Signatures table
create table waiver_signatures (
  id uuid primary key default gen_random_uuid(),
  waiver_id uuid references waivers(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  signature_data text not null,
  signed_at timestamptz default now()
);

create index idx_waiver_signatures_user_id on waiver_signatures (user_id);
create index idx_waiver_signatures_waiver_id on waiver_signatures (waiver_id);
alter table waiver_signatures enable row level security;

-- Policy Agreements table
create table policy_agreements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id) on delete cascade not null,
  full_name text not null,
  photo_release boolean not null,
  liability_release boolean not null,
  code_of_conduct boolean not null,
  payment_policy boolean not null,
  attire_agreement boolean not null,
  signature_date timestamptz not null default now()
);

create index idx_policy_agreements_family_id on policy_agreements (family_id);
alter table policy_agreements enable row level security;

-- Profiles table
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin', 'instructor')),
  family_id uuid references families(id) on delete set null
);

create index idx_profiles_family_id on profiles (family_id);
alter table profiles enable row level security;

-- Create RLS policies
-- Example policies - adjust according to your security needs
create policy "Profiles are viewable by user" on profiles
  for select using (auth.uid() = id);

-- Now that profiles table exists, we can create policies that reference it
create policy "Families are viewable by members" on families
  for select using (
    exists (
      select 1 from profiles 
      where profiles.family_id = families.id
      and profiles.id = auth.uid()
    )
  );

-- Create trigger for profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Now add all the RLS policies after all tables are created
create policy "Guardians are viewable by family members" on guardians
  for select using (
    exists (
      select 1 from profiles 
      where profiles.family_id = guardians.family_id
      and profiles.id = auth.uid()
    )
  );

create policy "Students are viewable by family members" on students
  for select using (
    exists (
      select 1 from profiles 
      where profiles.family_id = students.family_id
      and profiles.id = auth.uid()
    )
  );

create policy "Payments are viewable by family members" on payments
  for select using (
    exists (
      select 1 from profiles 
      where profiles.family_id = payments.family_id
      and profiles.id = auth.uid()
    )
  );

create policy "Payment_students are viewable by related users" on payment_students
  for select using (
    exists (
      select 1 from payments
      join profiles on profiles.family_id = payments.family_id
      where payment_students.payment_id = payments.id
      and profiles.id = auth.uid()
    )
  );

create policy "Achievements are viewable by family members" on achievements
  for select using (
    exists (
      select 1 from students
      join profiles on profiles.family_id = students.family_id
      where achievements.student_id = students.id
      and profiles.id = auth.uid()
    )
  );

create policy "Attendance is viewable by family members" on attendance
  for select using (
    exists (
      select 1 from students
      join profiles on profiles.family_id = students.family_id
      where attendance.student_id = students.id
      and profiles.id = auth.uid()
    )
  );

create policy "Waivers are viewable by all authenticated users" on waivers
  for select using (auth.role() = 'authenticated');

create policy "Waiver signatures are viewable by the signer" on waiver_signatures
  for select using (auth.uid() = user_id);

create policy "Policy agreements are viewable by family members" on policy_agreements
  for select using (
    exists (
      select 1 from profiles 
      where profiles.family_id = policy_agreements.family_id
      and profiles.id = auth.uid()
    )
  );

-- Add validation constraints
alter table families
add constraint valid_province 
check (province in ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'));

alter table students
add constraint valid_t_shirt_size
check (t_shirt_size in ('YXS','YS','YM','YL','YXL','AS','AM','AL','AXL','A2XL'));

-- Add update timestamp triggers
create or replace function update_modified_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger families_updated before update on families for each row execute function update_modified_column();
