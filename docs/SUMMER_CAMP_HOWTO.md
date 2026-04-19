# Summer Camp Setup & Registration Guide

Summer camps are modelled as **Seminar Series** in the system. A seminar has two layers:

- **Seminar Template** (`Programs → Seminar Templates`) — defines the camp's name, audience, pricing, duration, and age range. Think of it as the "product" definition.
- **Seminar Series** (`Classes → Seminar Series`) — a specific run of that camp with concrete dates, sessions, capacity, and registration status. Think of it as the "scheduled instance".

---

## 1. Admin: Setting Up a Summer Camp

### Step 1 — Create the Seminar Template

1. Go to **Admin → Curriculum → Seminar Templates**
2. Click **New Program**
3. Fill in:
   - **Name** — e.g. "Summer Camp 2025"
   - **Engagement Type** — select `Seminar`
   - **Audience Scope** — `Youth`, `Adults`, or `Mixed` (summer camps for all ages → `Mixed`)
   - **Age Range** — e.g. min 5, max 17
   - **Duration** — session length in minutes (e.g. 120)
   - **Single Purchase Price** — the per-registration fee (e.g. $150)
   - **Description** — visible to families on the public curriculum page
4. Save. This template can be reused for future camp years.

### Step 2 — Create a Seminar Series (the actual camp dates)

1. Go to **Admin → Curriculum → Seminar Series**
2. Click **Create Seminar Series**
3. Fill in:
   - **Seminar Template** — select the template created in Step 1
   - **Series Label** — e.g. "Week 1: July 7–11"
   - **Topic** — optional theme, e.g. "Beginner Fundamentals"
   - **Start Date / End Date** — camp start and end
   - **Number of Sessions** — total sessions in the series
   - **Min / Max Capacity** — e.g. 8 minimum, 20 maximum
   - **Price Override** — leave blank to use the template price, or set a different price for this run
   - **Series Status** — set to `Confirmed` once dates are locked (start with `Tentative`)
   - **Registration Status** — set to `Open` to allow sign-ups
   - **Allow Self-Enrollment** — enable so families can register themselves online
4. Save. Add schedule slots (day + time) as needed.

### Step 3 — Generate Sessions (optional)

After creating the series, go to the series detail and use **Sessions** to generate or manually add individual session dates (e.g. each day of the camp week).

### Step 4 — Verify Public Visibility

- Visit `/curriculum` — the camp should appear in the Seminars section
- Click through to confirm the series shows with correct dates, price, and a **Register Now** button (only appears when `Allow Self-Enrollment` is on and `Registration Status` is `Open`)

### Admin Registration (bypassing self-enrollment)

For families without online access, or to manually place a child:

1. Go to **Admin → Enrollments → New Enrollment**
2. Select the student, then the seminar series class
3. Set status to `Active`
4. Handle payment separately via **Admin → Billing → Invoices**

---

## 2. Parent of an Enrolled Family (existing account)

> Your family already has an account on the system.

1. Log in at `/login`
2. Go to **Curriculum** in the top navigation
3. Scroll to the **Seminars** section — summer camps appear here
4. Click the camp name to see details (dates, sessions, price, age range)
5. Click **Register Now** on the specific series (week) you want
6. On the registration page:
   - Your existing students are shown — select who is attending
   - If no students are listed, contact the dojo to add children to your family account
   - Review the price and confirm registration
7. Complete payment if required
8. You will receive a confirmation email. The camp appears in your family dashboard.

**Note:** If **Register Now** is not visible, registration is closed or contact-only — email the dojo directly.

---

## 3. Parent of an Unenrolled Family (no account)

> Your child does not currently attend the dojo. Summer camps are open to all.

### Option A — Self-Register Online

1. Go to `/curriculum` on the dojo website
2. Find the summer camp in the **Seminars** section and click it
3. Click **Register Now** on the series/week you want
4. You will be redirected to **Sign In** — click **Create account** to register
5. Create your account with your email address
6. Once signed in, you are returned to the registration page:
   - Enter your child's details (first name, last name, date of birth)
   - Review the camp price
   - Complete registration and payment
7. You will receive a confirmation email

### Option B — Contact the Dojo

If online registration is not available (button says "Contact us to register"):

- Email or call the dojo with:
  - Parent name and contact details
  - Child's name and date of birth
  - Which camp week(s) you want
- The admin will create your account and enrollment manually

---

## Key Concepts for Summer Camps

| Concept | What it means |
|---|---|
| **Seminar Template** | The camp "product" — reusable definition |
| **Seminar Series** | A specific camp run with actual dates |
| **Series Status: Confirmed** | Dates are locked and the camp is running |
| **Registration Status: Open** | Families can sign up |
| **Allow Self-Enrollment** | Families can register online without contacting admin |
| **Price Override** | Charge a different price for this specific run vs. the template default |
| **Audience Scope: Mixed** | Open to both youth and adults / all ages |

## Checklist Before Opening Registration

- [ ] Seminar template exists with correct age range and pricing
- [ ] Series has confirmed dates, start/end, and session count
- [ ] Capacity set (min and max)
- [ ] Series Status = `Confirmed`
- [ ] Registration Status = `Open`
- [ ] Allow Self-Enrollment = enabled
- [ ] Tested registration flow from a family account
