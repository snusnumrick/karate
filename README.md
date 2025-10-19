# Karate School Management System

A comprehensive web application for managing karate schools, built with Remix, Supabase, and Stripe. This system provides complete family-oriented registration, class management, payment processing, and communication tools.

## 🚀 Quick Start

For detailed setup instructions, see our [Development Guide](docs/DEVELOPMENT.md).

```bash
# Clone and install
git clone <repository-url>
cd karate
npm install

# Configure environment (see .env.example)
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

## 📚 Documentation

### Setup & Deployment
- **[Development Setup](docs/DEVELOPMENT.md)** - Complete development environment setup
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[Customization Guide](docs/CUSTOMIZATION.md)** - How to customize the system for your school

### Architecture & Technical
- **[Architecture Overview](docs/ARCHITECTURE.md)** - Technical architecture and database design
- **[API Documentation](docs/API.md)** - External API endpoints and integration

### Feature Guides
- **[Admin Operations Guide](docs/ADMIN_OPERATIONS.md)** - Family creation, portal access, and administrative workflows
- **[Instructor Portal Guide](docs/INSTRUCTOR_PORTAL.md)** - Instructor workflows, permissions, and attendance tools

### Operations & Troubleshooting
- **[Payment Error Monitoring](docs/PAYMENT_ERROR_MONITORING_SETUP.md)** - Error monitoring setup and payment issue diagnostics
- **[Payment Diagnostic Query](docs/PAYMENT_DIAGNOSTIC_QUERY.sql)** - SQL query to identify payment data integrity issues

## ✨ Key Features

### For Families
- **Family Portal** - Centralized dashboard for managing students and payments
- **Multi-Class Programs** - Enroll in multiple training programs with automatic discounts
- **Online Payments** - Secure Stripe integration with tax calculation and receipts
- **Digital Waivers** - Electronic waiver signing and management
- **Messaging System** - Direct communication with instructors and administrators
- **Online Store** - Purchase uniforms and equipment with inventory management
- **Push Notifications** - Real-time updates for messages and announcements

### For Administrators
- **Comprehensive Dashboard** - Overview of families, students, payments, and programs
- **Family Management** - Create families with automatic portal access and welcome emails
- **Program Management** - Create and manage multi-class training programs
- **Attendance Tracking** - Digital attendance recording and reporting
- **Payment Processing** - Manual payment recording and Stripe integration
- **Discount System** - Flexible discount codes and automatic family discounts
- **Database Chat** - Natural language database queries using AI
- **Bulk Operations** - Efficient management of large datasets

### For Instructors
- **Instructor Portal** - Dedicated workspace for session schedules, rosters, and student context
- **Tablet-Friendly Attendance** - Tap-to-mark interface with automatic late detection (15-minute threshold)
- **Eligibility Insights** - Quickly review tuition status and promotion readiness before each class
- **Cross-Access for Admins** - Admins can switch into the instructor view to cover classes or audit workflows

### Marketing Tools
- **Dynamic Landing Pages** - Customizable program landing pages for different audiences
- **URL Builder** - Generate custom marketing URLs with pricing and dates
- **SEO Optimization** - Built-in SEO features and structured data
- **Professional Design** - Modern, responsive interface

## 🛠 Tech Stack

- **Frontend**: Remix, React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Payments**: Stripe (Elements, Webhooks, Tax calculation)
- **Email**: Resend with custom templates
- **AI**: Google Gemini API for database chat
- **Notifications**: Web Push API with VAPID
- **Error Monitoring**: Sentry (optional, for production error tracking)
- **Deployment**: Vercel with Edge Functions

## 💰 Monetary System

**INT4 Cents Storage**: All monetary values are stored as integers representing cents for precision and consistency:
- **Precision**: Eliminates floating-point arithmetic errors
- **Performance**: Faster integer operations and indexing
- **Consistency**: Standardized storage across all tables
- **Type Safety**: Strong typing with dinero.js integration

See [MONETARY_STORAGE.md](docs/MONETARY_STORAGE.md) for detailed documentation and migration information.

## 🔒 Security Features

- **CSRF Protection**: Comprehensive Cross-Site Request Forgery protection on all forms
- **Content Security Policy**: Strict CSP with nonce-based script execution
- **Authentication**: Secure JWT-based authentication via Supabase Auth
- **Authorization**: Role-based access control for admin and family users
- **Payment Security**: PCI-compliant payment processing through Stripe
- **Data Protection**: Row Level Security (RLS) policies and input validation
- **HTTPS Enforcement**: SSL/TLS encryption for all communications

## 📋 System Requirements

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- Resend account (for emails)
- Google Gemini API key (for AI features)
- Sentry account (optional, for error monitoring)

## 🔧 Configuration

The system is highly configurable through `app/config/site.ts`. You can customize:

- School information and branding
- Class schedules and pricing
- Instructor details
- Payment settings and tax rates
- Feature toggles
- SEO and analytics settings

See the [Customization Guide](docs/CUSTOMIZATION.md) for detailed instructions.
## 🚀 Getting Started

1. **Clone the repository**
2. **Follow the [Development Setup Guide](docs/DEVELOPMENT.md)** for detailed instructions
3. **Configure your environment** using the provided `.env.example`
4. **Deploy to production** using our [Deployment Guide](docs/DEPLOYMENT.md)

## 📖 Learn More

This system is designed to be flexible and customizable for different karate schools and martial arts organizations. Check out our documentation to understand the full capabilities and how to adapt it to your needs.

## 🤝 Contributing

Contributions are welcome! Please read through our documentation to understand the system architecture before making changes.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
