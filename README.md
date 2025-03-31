# Karate Class Website

## Project Overview

Develop a comprehensive and user-friendly karate class management website for 
Sensei Negin's classes (details managed in `app/config/site.ts`), 
incorporating efficient family-oriented registration, 
achievement tracking, attendance monitoring, payment integration, and waiver management.

## Website Functionality

### User-facing Features:

- Home Page:

    - Introduction to karate emphasizing personal growth and defense techniques.
    - Class schedule and location details (see `app/config/site.ts`).

- Instructor Profile:

  - Comprehensive bio for Sensei Negin detailing certifications and achievements.

- Registration and Family Management:

    - Family-centric registration allowing multiple children per family.
    - Secure login and family account management.
    - Detailed input fields for family information, guardian(s), and student details.

- Attendance and Achievement Tracking:

    - Automated attendance tracking system.
    - Real-time reporting to identify absentees.
    - Achievement logging for each student to track progress and milestones.

- Payment Integration:

  - Linking parent payments directly to individual children, accommodating multiple children per family.
  - Secure payment processing with transaction records for families.
  - Pricing Structure: Free Trial, $49/1st mo, $100/2nd mo, $121/monthly ongoing (details in `app/config/site.ts`).

- Online Waivers and Policies:

    - Digitally accessible and signable waivers including:
      - Liability Release
      - Code of Conduct
      - Photo/Video consent
      - Payment and Dress Code agreement

### Administrative Features:
- Secure and intuitive admin interface for managing families, students, attendance, payments, and waivers.
- Detailed reporting tools for attendance, financials, and student achievements.
- Notification system for attendance irregularities.

## Technology Stack

- **Frontend**: Remix framework for optimal user experience, server-side rendering, and modern web practices.
- **Backend**: Supabase for scalable database solutions, authentication, and real-time functionalities.
- **UI Library**: Shadcn for clean, modern, and consistent UI components ensuring high usability.
- **Payments**: Stripe or PayPal integration for robust payment processing.
- **Deployment**: Cloud-based deployment solutions (e.g., Vercel or Netlify).

## Development Timeline

- Week 1-2:

    - Project setup, database schema design, and initial configuration.
    - User authentication and basic registration functionalities.

- Week 3-4:
  - Homepage and instructor profile page development.
  - Development of detailed family and student registration forms.
  - Payment integration setup and testing.

- Week 5-6:
    - Attendance and achievement tracking systems implementation.
    - Admin dashboard creation.
    - Additional informational and policy pages setup.

- Week 7:

    - Waivers management system integration.
    - Initial internal testing.

- Week 8:
    - Comprehensive system testing, bug fixes, and user feedback incorporation.
    - Preparation for launch, final security checks, and deployment.

## Project Status

### Implemented Core Features
✅ **Completed Phase 1 & 2**
- Family management system with guardians/children relationships
- Secure authentication/authorization flow (Login, Registration, Email Confirmation, Role-based Redirects)
- **Family Portal** (`/family`) as main user dashboard after login
  - Displays associated family name
  - Lists registered students with links to detail pages
  - Shows status of required waiver signatures
  - Placeholders for Payments and Account Settings
- **Student Detail Page** (`/family/student/:studentId`) displaying student info
- Admin dashboard foundation
- Waiver signing system with digital signatures
- Production-ready security headers (CSP, HSTS)
- Error boundary handling & SSR/Hydration fixes
  - Supabase database integration (Auth, Families, Students, Waivers, Profiles, Attendance)
  - Mobile-optimized responsive layout

🛠 **Recent Additions**
- Dynamic data fetching for Family Portal (Family, Students, Waiver Status)
- Dynamic data fetching for Student Detail Page
- Login page enhancements (Resend confirmation email)
- Payment gateway CSP pre-configuration
- Font optimization with preconnect
- Security audit workflow
- **Admin Panel Enhancements:**
  - Admin Dashboard (`/admin`) with key statistics (Families, Students, Payments, Attendance)
  - Manage Families page (`/admin/families`) using service role client
  - Manage Students page (`/admin/students`) using service role client
  - Manage Waivers page (`/admin/waivers`) using service role client
  - View/Edit Waiver page (`/admin/waivers/:waiverId`)
  - View Today's Attendance page (`/admin/attendance`)
  - Record Attendance page (`/admin/attendance/record`) with upsert logic
  - Added unique constraint to `attendance` table for reliable upserts

### Next Priority Features
1. **Payment Integration Enhancements**:
  - Implement dynamic payment amount calculation based on enrollment duration (`_layout.family.payment.tsx`) (✅ Implemented - based on past payment count).
  - Display recent payment in Family Portal, full history on separate page (`_layout.family.payment-history.tsx`) (✅ Implemented).
  - Implement robust error handling for payment linking and Stripe webhooks (`utils/supabase.server.ts`) (✅ Implemented).
  - Display student eligibility status (Trial/Paid/Not Paid) in Admin panels (`/admin/students`, `/admin/attendance/record`) (✅ Implemented).
2. **Account Settings**: Implement account management section/link in Family Portal (`_layout.family._index.tsx`).
3. **Student Management**: Add Edit/Delete functionality on `/family/student/:studentId`.
4. **User Onboarding**: Improve handling for newly registered users without a linked family (`_layout.family._index.tsx`).
5. **Attendance Tracking**: Implement core attendance tracking system features.
6. **Achievement Badges**: Implement achievement badge functionality.
7. **Automated Notifications**: Set up basic automated notifications (e.g., for attendance).
8. **Instructor Profile**: Develop the instructor profile module/page.
9. **Technical Debt**: Address UI/SSR issues (e.g., Button/Link structure in Family Portal - `_layout.family._index.tsx`).

### Development Progress
```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Core
    Authentication          :done,    auth, 2024-03-01, 14d
    Family Management       :done,    family, 2024-03-15, 21d
    Family Portal           :done,    portal, 2024-03-29, 14d
    Student Detail Page     :done,    student, after portal, 7d
    Security Implementation :done,    sec, 2024-04-05, 14d     
    section Payments
    Gateway Integration     :active,  pay, 2024-04-20, 21d
    Transaction Tracking    :done,    pay_track, after pay, 14d
    Dynamic Pricing Logic   :done,    pay_dynamic, after pay_track, 7d
    section Reporting
    Attendance System       :active,  attend, 2024-05-25, 21d
    Achievement Tracking    :         achieve, 2024-06-15, 21d
```

### Technical Health
```json
{
  "Security": {
    "CSP": "active",
    "HSTS": "enabled",
    "Auth": "JWT@2.16.2"
  },
  "Monitoring": {
    "ErrorLogging": "partial",
    "PaymentTracking": "pending"
  }
}
```
