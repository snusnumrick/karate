# Customization Guide

This guide covers how to customize various aspects of the karate school management system to fit your specific needs.

## Table of Contents

- [Site Configuration](#site-configuration)
- [Styling and Theming](#styling-and-theming)
- [Pricing Configuration](#pricing-configuration)
- [Tax Configuration](#tax-configuration)
- [Student Eligibility Logic](#student-eligibility-logic)
- [Email Templates](#email-templates)
- [Content Security Policy](#content-security-policy)
- [Localization](#localization)
- [Feature Toggles](#feature-toggles)

## Site Configuration

The main site configuration is located in `app/config/site.ts`. This file contains all the customizable settings for your karate school.

### Basic Information

```typescript
export const siteConfig = {
    name: "YOUR KARATE SCHOOL NAME",
    description: "Your school description for SEO",
    url: siteUrl, // Set via VITE_SITE_URL environment variable
    
    location: {
        address: "Your Address",
        locality: "Your City",
        region: "Your Province/State",
        postalCode: "Your Postal Code",
        country: "CA", // Country code
        description: "Location description"
    },
    
    contact: {
        phone: "Your Phone Number",
        email: "Your Email",
        paymentsEmail: "Your Payments Email"
    }
};
```

### Class Schedule

```typescript
classes: {
    days: "Your Class Days",
    time: "Your Class Time",
    timeLong: "Formal Time Display",
    ageRange: "Age Range",
    duration: "Class Duration",
    maxStudents: 15, // Maximum students per class
    minAge: 4,
    maxAge: 12
}
```

### Instructor Information

```typescript
instructor: {
    name: "Your Instructor Name",
    title: "Instructor Title",
    rank: "Belt Rank",
    experience: "Years of Experience",
    specializations: [
        "Your Specializations"
    ],
    bio: "Instructor biography"
}
```

### SEO Configuration

```typescript
seo: {
    keywords: [
        "your keywords",
        "martial arts",
        "your location"
    ],
    author: "Your Name",
    robots: "index, follow",
    googleSiteVerification: "your-verification-code",
    openGraph: {
        type: "website",
        siteName: "Your Site Name",
        locale: "en_CA"
    }
}
```

## Styling and Theming

The application uses **Tailwind CSS** and **Shadcn UI** components for styling.

### Primary Colors

Update the primary color in `app/config/site.ts`:

```typescript
colors: {
    primary: "#your-hex-color" // Replace with your brand color
}
```

### Tailwind Configuration

Customize colors, fonts, and other design tokens in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#your-primary-color',
          900: '#your-dark-primary'
        }
      },
      fontFamily: {
        sans: ['Your Font', 'sans-serif']
      }
    }
  }
}
```

### Shadcn UI Components

Customize component styles by modifying the CSS variables in `app/globals.css`:

```css
:root {
  --primary: your-hsl-values;
  --secondary: your-hsl-values;
  --accent: your-hsl-values;
}
```

## Pricing Configuration

### Program Fees

Monthly, yearly, and individual session pricing now come from the `programs` table in Supabase. Update these amounts through the admin Programs UI (`/admin/programs`) or by editing the `monthly_fee`, `yearly_fee`, and `individual_session_fee` columns directly.

Each enrollment references a program, and payment flows automatically pull the matching program fees to calculate totals. Ensure active programs have correct values before enabling family payments.

### Free Trial Messaging

Marketing copy for free-trial CTAs lives in `app/config/site.ts` under:

```typescript
promotions: {
    freeTrialLabel: 'FREE TRIAL',
    freeTrialDescription: 'Free trial available!'
}
```

### Dynamic Pricing Logic

Business rules for composing totals live in the family payment loader/action (`app/routes/_layout.family.payment.tsx`) and supporting services (`app/services/payment-eligibility.server.ts`, `app/services/enrollment-payment.server.ts`). Customise these modules to introduce additional pricing rules such as multi-student discounts, automatic promotions, or program-specific offers.

## Tax Configuration

### Tax Rates Table

Tax rates are managed through the `tax_rates` table in Supabase. Configure applicable taxes in `app/config/site.ts`:

```typescript
// Add to siteConfig
applicableTaxNames: ['GST', 'PST', 'HST'] // Adjust based on your location
```

### Tax Calculation

The system automatically calculates taxes based on:
- Student's province/state
- Configured tax rates in the database
- `applicableTaxNames` setting

Tax logic is implemented in the payment processing components and displays appropriately on invoices and receipts.

## Student Eligibility Logic

### Age-Based Eligibility

Customize student eligibility in `app/utils/supabase.server.ts`:

```typescript
// Example eligibility function
export function isStudentEligible(student: Student): boolean {
    const age = calculateAge(student.birthDate);
    return age >= siteConfig.classes.minAge && age <= siteConfig.classes.maxAge;
}
```

### Custom Eligibility Rules

Implement custom eligibility logic based on:
- Age requirements
- Previous experience
- Medical clearances
- Parent/guardian approval
- Class capacity limits

## Email Templates

### Available Templates

The system includes templates for:
- Welcome emails
- Payment confirmations
- Class reminders
- Waiver reminders
- Absence notifications
- Invoice notifications

### Template Customization

Email templates are stored in Supabase and can be customized through:

1. **Admin Dashboard**: Modify templates directly in the admin interface
2. **Template Files**: Edit source templates and redeploy
3. **Supabase Dashboard**: Direct database editing

### Template Deployment

Use the unified deployment script:

```bash
npm run deploy:email-templates
```

Or deploy individual templates:

```bash
npm run deploy:template:welcome
npm run deploy:template:payment
npm run deploy:template:reminder
```

### Template Variables

Templates support placeholders like:
- `{{studentName}}`
- `{{parentName}}`
- `{{className}}`
- `{{paymentAmount}}`
- `{{dueDate}}`

## Content Security Policy

### CSP Configuration

The application implements a robust Content Security Policy with nonce support.

#### Environment Variables

```env
# CSP Configuration
CSP_NONCE_ENABLED=true
CSP_REPORT_ONLY=false
CSP_REPORT_URI=https://your-csp-report-endpoint.com/report
```

#### Development vs Production

- **Development**: More permissive CSP for hot reloading
- **Production**: Strict CSP with nonce-based script execution

#### Troubleshooting CSP

1. Check browser console for CSP violations
2. Verify nonce generation and propagation
3. Ensure all inline scripts use proper nonce attributes
4. Review CSP report endpoint for violations

## Localization

### Locale Configuration

```typescript
localization: {
    locale: 'en-CA', // Primary locale
    currency: 'CAD',
    country: 'CA',
    pageSize: 'A4', // PDF page size
    fallbackLocale: 'en-US'
}
```

### Supported Regions

The system includes province/state data for:
- Canada (all provinces and territories)
- United States (can be added)
- Other countries (customizable)

### Date and Number Formatting

Localization affects:
- Date display formats
- Number formatting
- Currency display
- Address formats
- PDF generation

## Feature Toggles

### Available Features

```typescript
features: {
    enableOnlinePayments: true,
    enableClassBooking: true,
    enableMessaging: true,
    enableCalendarIntegration: true,
    enableMultiLanguage: false,
    enableDarkMode: true,
    enablePrintInvoices: true,
    enableBulkOperations: true,
    enableAdvancedReporting: true,
    enableAPIAccess: false
}
```

### Performance Features

```typescript
performance: {
    enableServiceWorker: true,
    enablePWA: true,
    cacheStrategy: "networkFirst",
    offlineSupport: true,
    enablePushNotifications: true,
    enableWebVitals: true
}
```

### Notification Settings

```typescript
notifications: {
    enableEmailNotifications: true,
    enableSMSNotifications: false,
    enablePushNotifications: true,
    defaultNotificationPreferences: {
        classReminders: true,
        paymentReminders: true,
        announcements: true,
        promotions: false
    }
}
```

## Advanced Customization

### Custom Payment Receipts

Customize receipt templates and branding in the invoice system components.

### Multi-Class System

Configure multiple class types, schedules, and pricing tiers through the admin interface.

### Automated Discounts

Set up automatic discount rules based on:
- Number of students in family
- Enrollment duration
- Special promotions
- Referral programs

### Push Notifications

Configure push notification settings:

```env
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@domain.com
```

### Analytics Integration

```typescript
analytics: {
    enableCookieConsent: true,
    enablePerformanceTracking: true
}
```

## Best Practices

1. **Test Changes**: Always test customizations in a development environment
2. **Backup Configuration**: Keep backups of your `site.ts` configuration
3. **Environment Variables**: Use environment variables for sensitive data
4. **Gradual Rollout**: Implement changes gradually, especially for live systems
5. **Documentation**: Document your customizations for future reference
6. **Version Control**: Track all configuration changes in version control

## Support

For additional customization support:

1. Check the main README.md for basic setup
2. Review the ARCHITECTURE.md for technical details
3. Consult the API.md for integration options
4. Review the codebase for implementation examples