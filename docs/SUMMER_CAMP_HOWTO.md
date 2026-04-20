# Summer Camp Setup & Registration Guide

Summer camps are modelled as **Seminar Series** in the system. A seminar has two layers:

- **Seminar Template** — defines the camp's name, audience, pricing, duration, and age range. Think of it as the "product" definition. Reusable across years.
- **Seminar Series** — a specific run of that camp with concrete dates, sessions, capacity, and registration status. Think of it as the "scheduled instance".

---

## 1. Admin: Setting Up a Summer Camp

### Step 1 — Create the Seminar Template

1. Go to **Admin → Curriculum → Seminar Templates**
2. Click **New Seminar Template**
3. Fill in:
   - **Seminar Name** — e.g. "Summer Camp 2025"
   - **Audience Scope** — `Youth`, `Adults`, or `Mixed` (summer camps open to all ages → select `Mixed`)
   - **Age Range** — e.g. min 5, max 17
   - **Session Duration** — length of each session in minutes (e.g. 120)
   - **Single Purchase Price** — the default per-registration fee (e.g. $150.00)
   - **Description** — shown to families on the public curriculum page
   - **Active Seminar Template** — leave checked
4. Click **Create Seminar Template**. This template can be reused for future camp years.

### Step 2 — Create a Seminar Series (the actual camp dates)

1. Go to **Admin → Curriculum → Seminar Series**
2. Click **Create Seminar Series**
3. Select the **Seminar Template** created in Step 1 from the dropdown
4. Fill in:
   - **Series Label** — e.g. "Week 1: July 7–11"
   - **Topic** — optional theme, e.g. "Beginner Fundamentals"
   - **Start Date / End Date** — camp start and end dates
   - **Number of Sessions** — total sessions in the series
   - **Min / Max Capacity** — e.g. 8 minimum, 20 maximum participants
   - **Price Override** — leave blank to use the template price, or enter a different price for this run
   - **Series Status** — start with `Tentative`, change to `Confirmed` once dates are locked
   - **Registration Status** — set to `Open` to allow sign-ups
   - **Allow Self-Enrollment** — enable so families can register themselves online
5. Click **Create Seminar Series**

### Step 3 — Add Sessions (optional but recommended)

After creating the series, click **Sessions** on the series card to generate or manually add individual session dates (e.g. each day of the camp week).

### Step 4 — Verify Public Visibility

- Visit `/curriculum` on the site — the camp should appear in the **Seminars** section
- Click the camp name to open the detail page
- Confirm the correct series appears with dates, price, and a **Register Now** button
  - **Register Now** only appears when `Allow Self-Enrollment` is enabled and `Registration Status` is `Open`

### Admin Registration (bypassing self-enrollment)

For families without online access, or to manually place a child:

1. Go to **Admin → Enrollments → New Enrollment**
2. Select the student, then select the seminar series
3. Set status to `Active`
4. Handle payment separately via **Admin → Billing → Invoices**

---

## 2. Parent of an Enrolled Family (existing account)

> Your family already has an account on the system.

1. Log in at the dojo website
2. Go to **Curriculum** in the top navigation
3. Scroll to the **Seminars** section — summer camps appear here regardless of your child's age
4. Click the camp name to see details (dates, sessions, price, age range)
5. Click **Register Now** on the specific series (week) you want
6. On the registration page:
   - Your existing students are listed — select who is attending
   - If no students appear, contact the dojo to add your children to the family account
   - Review the price and confirm registration
7. Complete payment if required
8. You will receive a confirmation email and the camp appears in your family dashboard

**Note:** If **Register Now** is not visible, registration is closed or contact-only — contact the dojo directly.

---

## 3. Parent of an Unenrolled Family (no account)

> Your child does not currently attend the dojo. Summer camps are open to everyone.

### Option A — Self-Register Online

1. Go to the dojo website and click **Curriculum** in the navigation
2. Find the summer camp in the **Seminars** section and click it
3. Click **Register Now** on the series/week you want
4. You will be redirected to **Sign In** — create a new account with your email address
5. Once signed in, you are returned to the registration page:
   - Enter your child's details (first name, last name, date of birth)
   - Review the camp price
   - Complete registration and payment
6. You will receive a confirmation email

### Option B — Contact the Dojo

If online registration is not available (the page shows "Contact us to register"):

- Email or call the dojo with:
  - Parent name and contact details
  - Child's name and date of birth
  - Which camp week(s) you want
- The admin will create your account and enrollment manually

---

## Key Concepts

| Concept | What it means |
|---|---|
| **Seminar Template** | The camp "product" — reusable definition shared across all runs |
| **Seminar Series** | A specific camp run with actual dates and capacity |
| **Series Status: Confirmed** | Dates are locked and the camp is running |
| **Registration Status: Open** | Families can sign up online |
| **Allow Self-Enrollment** | Families can register without contacting admin |
| **Price Override** | Charge a different price for this specific run vs. the template default |
| **Audience Scope: Mixed** | Open to youth and adults — no age group restriction |

## Checklist Before Opening Registration

- [ ] Seminar template created with correct age range, duration, and default price
- [ ] Seminar series created and linked to the template
- [ ] Series has start date, end date, and session count set
- [ ] Min and max capacity configured
- [ ] Series Status = `Confirmed`
- [ ] Registration Status = `Open`
- [ ] Allow Self-Enrollment = enabled
- [ ] Tested the registration flow from a family account (or a test account)
