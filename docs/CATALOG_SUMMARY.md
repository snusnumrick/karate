# Feature Catalog Summary

*Auto-generated on 2026-03-03T17:15:55.956Z*

## Overview

A comprehensive web application designed to manage karate schools efficiently, offering family-oriented registration, class and program management, attendance tracking, payment processing, communication tools, marketing features, and robust administrative controls.

## Statistics

- **Total Features**: 29
- **Total Routes**: 194
  - Admin: 98
  - Family: 28
  - Instructor: 8
  - API: 25
  - Public: 38
- **Tech Stack**: 20 technologies

## Features


### Admin Tools & Utilities

Administrative utilities for calendar management, diagnostics, and system monitoring

**Files**: 4




---

### AI Database Chat

Natural language database querying using Google Gemini API for bulk operations and administrative insights

**Files**: 1

- Routes: 0
- Services: 0
- Components: 0
- Utils: 1

**Key Capabilities**:
- Parses PostgreSQL string-formatted arrays (e.g., '{value1,value2}').
- Handles native PostgreSQL array types returned by database drivers.
- Converts various PostgreSQL array representations into standard JavaScript string arrays.
- Facilitates the AI's understanding and processing of PostgreSQL array data.

---

### Attendance System

Attendance tracking, recording, and reporting for students and sessions

**Files**: 7

- Routes: 6
- Services: 1
- Components: 0
- Utils: 0

**Key Capabilities**:
- Enables family members to view general and specific student attendance history.
- Empowers administrators to record, filter, and manage all student attendance entries.
- Presents attendance data in structured tables with status badges and formatted dates.
- Implements role-based access for family users and administrative staff.

---

### Authentication & User Management

User authentication system with role-based access control (admin, instructor, family)

**Files**: 6

- Routes: 3
- Services: 0
- Components: 0
- Utils: 3

**Key Capabilities**:
- Manages user login and session creation using Supabase.
- Handles user logout and session termination securely.
- Processes Supabase authentication callbacks for email verification or password resets.
- Utilizes CSRF protection for authentication forms.

---

### Calendar & Scheduling

Event calendar with filtering, different views (grid/list), session scheduling, and admin calendar management

**Files**: 24

- Routes: 10
- Services: 0
- Components: 14
- Utils: 0

**Key Capabilities**:
- Displays various event types (e.g., sessions, birthdays) with visual status indicators.
- Provides interactive calendar navigation and access to detailed event information.
- Supports customizable grid and list views for events, with user preference persistence.
- Enables filtering of events, including by student, for personalized views.

---

### Discount System

Discount templates, automatic discounts, and discount code management

**Files**: 22

- Routes: 18
- Services: 3
- Components: 0
- Utils: 1

**Key Capabilities**:
- Create, edit, and delete automatic discount rules.
- Define and utilize reusable discount templates.
- Assign and manage the application of automatic discounts to members.
- Securely manage all discount operations via an admin-only interface.

---

### Enrollment Management

Student enrollment in programs and classes with payment tracking

**Files**: 5

- Routes: 3
- Services: 2
- Components: 0
- Utils: 0

**Key Capabilities**:
- View and list all existing student enrollments
- Create new enrollments by linking students to specific classes
- Search and filter enrollment records based on various criteria
- Display detailed information about each enrollment, including status
- Perform administrative actions on enrollments, such as status updates or deletion

---

### Event Management

Manages event creation, student registration, and payment processing for karate school events.

**Files**: 17

- Routes: 13
- Services: 2
- Components: 2
- Utils: 0

**Key Capabilities**:
- Facilitates student and family registration for events.
- Handles secure payment processing for event fees, including tax calculation.
- Collects and manages participant details during event registration.
- Ensures robust error handling for event-related user interfaces.

---

### Event Management & Registration

Event creation, management, and registration system with waiver integration

**Files**: 10




---

### Family Management

Family profile management including guardians, students, and account settings

**Files**: 40

- Routes: 38
- Services: 1
- Components: 1
- Utils: 0

**Key Capabilities**:
- Access personalized family dashboards and student profiles.
- Manage and process student enrollment and recurring payments.
- View school calendars and event schedules.
- Monitor and complete incomplete student registrations.
- Secure navigation and user-specific content delivery.

---

### Guardian Management

Guardian profile creation, editing, and management within families

**Files**: 6

- Routes: 5
- Services: 1
- Components: 0
- Utils: 0

**Key Capabilities**:
- Add new guardian profiles with personal details.
- View and update individual guardian records.
- Associate guardians with specific student families.
- Delete guardian profiles with confirmation.
- Provide an administrative interface for managing family-guardian relationships.

---

### Instructor Portal

Instructor-specific features including messaging and session management

**Files**: 6




---

### Invoice Management

Invoice creation, templates, line items, payment tracking, and PDF generation

**Files**: 28

- Routes: 18
- Services: 4
- Components: 6
- Utils: 0

**Key Capabilities**:
- Create, edit, and process invoices with detailed forms.
- Select and link invoices to specific entities (students/customers).
- Dynamically manage invoice line items, including adding, duplicating, and removing.
- Apply and calculate taxes for individual line items based on type.
- Utilize invoice templates for efficient invoice generation.

---

### Messaging System

Two-way messaging between families and admin/instructors with conversation threads

**Files**: 12

- Routes: 8
- Services: 0
- Components: 4
- Utils: 0

**Key Capabilities**:
- Display distinct conversation lists for administrators and general users.
- Summarize conversations with subjects, participant names, and last message timestamps.
- Indicate unread message counts for ongoing conversations.
- Provide a text input for composing and sending new messages.
- Ensure secure message submission using CSRF protection.

---

### Monetary System

Type-safe money handling with dinero.js for precision calculations

**Files**: 3




---

### Onboarding & Introduction Pages

Program introduction pages and new user onboarding flow

**Files**: 6




---

### Payment Processing

Multi-provider payment processing with Stripe and Square integration, eligibility checking, and paid-until calculation

**Files**: 37

- Routes: 18
- Services: 10
- Components: 9
- Utils: 0

**Key Capabilities**:
- Process payments for event registrations, accounting for fees and student counts.
- Manage invoice payments, display comprehensive payment history, and track outstanding balances.
- Support a variety of payment methods including cash, check, credit card, bank transfer, and mobile pay.
- Perform financial calculations, apply taxes, and format monetary values consistently.
- Record and display details of who processed each payment for auditing and reporting.

---

### Program & Class Management

Martial arts program and class management with session tracking

**Files**: 14

- Routes: 12
- Services: 2
- Components: 0
- Utils: 0

**Key Capabilities**:
- View and browse available karate programs and classes with schedule details.
- Administrators can create, edit, and update detailed class information.
- Manage the status (e.g., complete, cancel) of individual class sessions.
- Secure administration access with authentication and CSRF protection for management tasks.

---

### Push Notifications

Web push notification system with subscription management and message replies

**Files**: 11

- Routes: 6
- Services: 0
- Components: 1
- Utils: 4

**Key Capabilities**:
- Allows users to subscribe and unsubscribe from push notifications.
- Provides a user interface for managing notification settings.
- Supports storing and managing Web Push API subscription data.
- Processes quick replies sent by users from interactive push notifications.
- Integrates with Supabase for user authentication and database operations.

---

### PWA Support

Progressive Web App with service worker, offline support, and install prompts

**Files**: 5

- Routes: 1
- Services: 0
- Components: 4
- Utils: 0

**Key Capabilities**:
- Allows users to install the application to their device's home screen for an app-like experience.
- Provides offline access to cached data, such as family details and upcoming class schedules.
- Displays a user-friendly prompt for PWA installation and manages its state.
- Implements an offline error boundary to gracefully handle network disconnections and display cached content.
- Shows the current PWA status, including online/offline state and installation status.

---

### Security & CSP

Content Security Policy with nonce-based script execution and CSRF protection

**Files**: 3




---

### SEO & Marketing Infrastructure

SEO optimization with sitemap generation, structured data, and marketing landing pages

**Files**: 3




---

### Store & Products

E-commerce functionality for products, variants, inventory, and orders

**Files**: 9

- Routes: 9
- Services: 0
- Components: 0
- Utils: 0

**Key Capabilities**:
- Users can view their personal order history and individual order details.
- Administrators can view, filter, and navigate through a list of all store orders.
- Administrators can access detailed information for specific orders, including the ability to update order status and add internal notes.
- Leverages Supabase for authenticated and secure data retrieval, distinguishing between user and admin access.

---

### Student Management

Student profile management, enrollment, belt progression tracking, belt award management, and attendance tracking

**Files**: 21

- Routes: 18
- Services: 1
- Components: 2
- Utils: 0

**Key Capabilities**:
- Create and edit student profiles with personal details and attributes like T-shirt size.
- Manage student payment eligibility, setup, and financial details related to enrollment.
- Facilitate student registration and enrollment for specific school events.
- Provides different management interfaces for administrators and family members.

---

### Tax Management

Tax rate configuration and application to invoices

**Files**: 1




---

### Theme & UI

Provides dynamic light/dark/system theme switching and a foundational set of reusable UI components.

**Files**: 26

- Routes: 0
- Services: 0
- Components: 26
- Utils: 0

**Key Capabilities**:
- Manages dynamic light, dark, and system theme modes for the application.
- Persists user theme preferences across sessions using local storage.
- Offers a foundational set of accessible and reusable UI components like buttons, dropdowns, and accordions.
- Utilizes React Context for centralized theme state management.

---

### Theme & UI Components

Dark/light theme support with Shadcn/UI component library

**Files**: 10




---

### Utilities & Helpers

Shared utilities for validation, formatting, and common operations

**Files**: 6




---

### Waiver System

Digital waiver signing, PDF generation, storage, and student coverage tracking

**Files**: 12

- Routes: 10
- Services: 1
- Components: 1
- Utils: 0

**Key Capabilities**:
- Facilitates waiver display and signing, often integrated with event registration flows.
- Captures and stores digital signatures along with associated guardian and student information.
- Generates high-quality PDF documents of signed waivers, incorporating signature images and content.
- Provides secure access for families to download their specific signed waiver PDFs.
- Utilizes server-side logic for authentication, data retrieval, and PDF storage/delivery.


## Tech Stack

- React 18.3.1
- Remix 2.16.7
- Vite 5.0.0
- TypeScript
- Supabase (PostgreSQL + Auth + Storage)
- Tailwind CSS 3.3.5
- Shadcn/UI (Component library)
- Stripe (Payment processing)
- Square Web SDK (Payment processing)
- Resend (Email service)
- Web Push (Push notifications)
- Google Gemini API (AI integration)
- Zod (Schema validation)
- React Hook Form
- @react-pdf/renderer (PDF generation)
- dinero.js (Money calculations)
- Vitest (Unit testing)
- Playwright (E2E testing)
- Express (Production server)
- Sentry (Error monitoring)


## Validation Criteria

1. Successful user authentication and role-based access control functioning as intended across user types (admin, instructor, family).
2. Login functionality works correctly with proper session management and token refresh handling.
3. End-to-end family management workflow from creation to enrollment and payment is seamless and error-free.
4. Guardian management allows adding, editing, and removing guardians with proper family associations.
5. Student profile management including belt progression tracking and belt award creation functions correctly.
6. Digital waiver signing and PDF generation are completed correctly with appropriate storage and retrieval.
7. Event registration flow (student selection → waiver signing → registration) works seamlessly with proper validation.
8. Payment processing works reliably with Stripe and Square, including webhook event handling and tax application.
9. Payment eligibility checking and paid-until date calculation function correctly based on business rules.
10. Pending payment tracking and management in admin portal displays accurate information.
11. Invoices are generated correctly with line items and payment histories tracked and displayed accurately.
12. Attendance tracking captures session attendance and late arrivals with correct reporting in instructor and admin portals.
13. Messaging system enables realtime two-way communications without loss or corruption of messages.
14. Event and calendar views accurately reflect scheduled programs, sessions, and registrations with correct filtering.
15. Admin calendar management allows creating and editing calendar events with proper date handling.
16. Discount codes and automatic discounts apply properly during enrollment and checkout processes.
17. Store functions support inventory tracking and order management including variant handling and ordering workflows.
18. Push notifications deliver timely updates respecting user subscriptions and preferences.
19. Push notification diagnostics tools provide accurate troubleshooting information for admins.
20. PWA features provide offline usage, service worker registration, and installation prompts as expected.
21. Security features including CSRF tokens, strict CSP policies with nonce, JWT authentication, and RLS policies are enforced.
22. AI database chat effectively processes natural language queries and returns accurate dataset manipulations and insights.
23. Database schema retrieval and caching for AI chat works efficiently without performance degradation.
24. SEO sitemap generation produces valid XML with accurate URLs and proper update frequencies.
25. Program introduction pages and onboarding flow guide new users through registration smoothly.
26. Belt award management allows admins to track and update student belt progression accurately.
27. User interface responds correctly to theme changes and displays modern accessible components consistently.
28. System logging and error monitoring with Sentry capture and alert on critical failures or unexpected behaviors.


---

*This document is auto-generated. To update:*
```bash
npm run docs:generate   # Generate base catalog
npm run docs:merge      # Merge with manual PRD
```
