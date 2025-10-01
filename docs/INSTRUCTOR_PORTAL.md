# Instructor Portal

The instructor portal provides teaching staff with a focused workspace for daily class operations. It complements the family and admin portals by surfacing only the context instructors need during and around class time.

## Access & Roles

- Available to users whose profile `role` is `instructor` or `admin`.
- Admins always retain access and can switch into the instructor view to cover classes or audit workflows.
- Assign instructor access by updating the `profiles.role` column to `instructor`.

## Navigation

| Section | Purpose |
| --- | --- |
| **Dashboard** | Today’s schedule, upcoming sessions, eligibility warnings, and quick actions. |
| **Sessions** | Calendar-style list of sessions (2-week window) with attendance summaries. |
| **Attendance** | Tablet-friendly roster for recording status (Present, Late, Absent, Excused). |
| **Students** | Filterable roster with eligibility status, upcoming sessions, and last attendance. |
| **Resources** | Program materials, curriculum notes, and quick links to admin program editors. |

## Dashboard Highlights

- **Next Session Card** – Shows time, roster size, and outstanding eligibility flags with a jump link to the attendance screen.
- **Eligibility Flags** – Students whose tuition or registration is out of date surface on both the dashboard and session cards.
- **Attendance Metrics** – Counts of present/late/absent/unmarked help instructors confirm rosters at a glance.

## Attendance Tool (iPad Friendly)

- Designed for landscape tablets with large tap targets.
- Single tap cycles a student between states; explicit buttons can set a state directly.
- Marks recorded 15+ minutes after session start automatically switch from *Present* to *Late* (manual override allowed).
- “Mark all present” shortcut respects the late threshold.
- Attendance mutations store the instructor’s `id` in the `attendance.marked_by` column for auditing.

## Data Dependencies

- Session loader relies on class schedules, enrollments, and existing attendance records.
- Eligibility checks re-use payment status logic from the family portal.
- Policies and RLS have been updated to allow instructors to read/write only the data relevant to their assigned sessions.

## Tips for Deployment

1. Ensure the migrations creating the `profile_role` enum and `attendance.marked_by` column have been applied.
2. Promote instructor accounts via the database or an admin script (e.g., `UPDATE profiles SET role = 'instructor'::profile_role WHERE email = 'sensei@example.com';`).
3. Test the attendance screen on the target hardware (iPad or kiosk) to confirm screen scaling and network reliability.
4. Encourage instructors to pin the portal URL (`/instructor`) and optionally add it to the home screen for kiosk-style usage.

For deeper implementation details see the development plan in `docs/INSTRUCTOR_PORTAL_DEV_PLAN.md`.
