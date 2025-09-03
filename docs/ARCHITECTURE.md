# Architecture Documentation

## Overview

This karate school management system is built as a modern web application using Remix, Supabase, and TypeScript. The architecture follows a full-stack approach with server-side rendering, real-time capabilities, and comprehensive business logic for managing students, classes, payments, and communications.

## Technology Stack

### Core Technologies
- **Framework**: [Remix](https://remix.run/) - Full-stack web framework with server-side rendering
- **Database**: [Supabase](https://supabase.com/) PostgreSQL with real-time capabilities
- **UI Framework**: [Shadcn](https://ui.shadcn.com/) components built on Tailwind CSS
- **Payment Processing**: [Stripe](https://stripe.com/) for secure payment handling
- **Email Service**: [Resend](https://resend.com/) for transactional emails
- **Deployment**: [Vercel](https://vercel.com/) or [Netlify](https://netlify.com/)
- **Authentication**: Supabase Auth with JWT tokens

### Additional Technologies
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first CSS framework
- **PWA**: Progressive Web App capabilities with service worker
- **Push Notifications**: Browser-based push notifications
- **PDF Generation**: Server-side PDF generation for invoices

## Project Structure

### Frontend Structure
```
app/
├── components/           # Reusable UI components
│   ├── ConversationList.tsx
│   ├── MessageView.tsx
│   ├── InvoiceForm.tsx
│   ├── DiscountCodeSelector.tsx
│   └── ...
├── routes/              # Remix routes (pages and API endpoints)
│   ├── _layout.family.*  # Family-facing routes
│   ├── admin.*          # Admin-facing routes
│   ├── api.*            # API endpoints
│   └── ...
├── services/            # Server-side business logic
│   ├── class.server.ts
│   ├── enrollment.server.ts
│   ├── discount.server.ts
│   ├── invoice-template.server.ts
│   └── ...
├── utils/               # Utility functions
│   ├── email.server.ts
│   ├── auto-discount-events.server.ts
│   └── ...
├── types/               # TypeScript type definitions
│   ├── database.types.ts
│   ├── discount.ts
│   └── ...
└── db/                  # Database setup scripts
    └── supabase-setup.sql
```

### Backend Structure
```
supabase/
├── functions/           # Edge functions (serverless)
│   ├── _shared/         # Shared code between functions
│   └── ...
├── migrations/          # Database migrations
└── config.toml          # Supabase configuration
```

### PWA Assets
```
public/
├── manifest.json        # Web app manifest
├── sw.js               # Service worker
├── offline.html        # Offline fallback page
├── browserconfig.xml   # Windows tile configuration
└── icons/              # App icons for various sizes
```

## Database Architecture

### Hybrid JSONB + Explicit Columns Design

The system uses a performance-optimized hybrid approach combining:
- **Explicit columns** for commonly queried fields (better performance, indexing)
- **JSONB columns** for additional/custom data (flexibility)

This provides optimal performance through targeted indexing while maintaining flexibility for future extensions.

### Core Database Tables

#### User Management
- `families` - Family information and contact details
- `students` - Student profiles and medical information
- `guardians` - Guardian/parent contact information

#### Program Management
- `programs` - Training program definitions with curricula
  - Explicit columns: `monthly_fee`, `registration_fee`, `payment_frequency`, `family_discount`
  - Explicit columns: `min_age`, `max_age`, `gender_restriction`, `special_needs_support`
- `classes` - Specific class instances with scheduling
  - Explicit columns: `days_of_week[]`, `start_time`, `end_time`, `timezone`
- `class_sessions` - Individual session occurrences
- `enrollments` - Student program registrations with status tracking
- `enrollment_history` - Audit trail of enrollment changes

#### E-commerce
- `products` - Store product catalog
- `product_variants` - Product variations (size, color, etc.)
- `orders` - Customer orders
- `order_items` - Individual items within orders

#### Discount System
- `discount_codes` - Manual discount code definitions
- `discount_code_usage` - Usage tracking and audit trail
- `discount_events` - Student/family events for automatic discounts
- `discount_automation_rules` - Rules linking events to discount templates
- `discount_assignments` - Tracking of automatically assigned discounts

#### Invoice System
- `invoice_entities` - Business entity information and branding
- `invoices` - Core invoice data with status tracking
- `invoice_line_items` - Detailed line item information
- `invoice_payments` - Payment history and transaction records
- `invoice_status_history` - Complete audit trail of status changes
- `invoice_templates` - Reusable template definitions
- `invoice_template_line_items` - Template line item configurations

#### Communication
- `conversations` - Message threads between families and admin
- `messages` - Individual messages within conversations
- `push_subscriptions` - Device subscription management for push notifications
- `user_notification_preferences` - User-specific notification settings

## System Components

### Multi-Class System
Comprehensive program and class management featuring:
- **Program Management**: Training program definitions with curricula and requirements
- **Class Scheduling**: Specific class instances with capacity management
- **Session Generation**: Automated session creation and tracking
- **Enrollment Processing**: Student registration with status tracking and waitlist handling
- **Family Discounts**: Automatic calculation of multi-student discounts

### Discount Systems

#### Manual Discount Codes
- Code-based discounts with flexible rules
- Support for fixed amount and percentage discounts
- Applicability rules (training, store, both)
- Scope control (per-student, per-family)
- Usage restrictions (one-time, ongoing)

#### Automatic Discount System
- Event-driven discount assignment
- Complex rule conditions and triggers
- Duplicate prevention mechanisms
- Comprehensive audit trails

### Invoice System
- **Multi-Entity Support**: Multiple business entities with separate branding
- **Dynamic Templates**: Flexible template system for different invoice types
- **Status Tracking**: Complete lifecycle management with audit trails
- **Payment Integration**: Stripe integration for payment processing
- **PDF Generation**: Professional PDF invoice generation

### Communication System
- **Real-time Messaging**: Supabase real-time for instant message delivery
- **Push Notifications**: Browser-based notifications with customizable preferences
- **Email Integration**: Automated email notifications via Resend

### Security Architecture

#### Content Security Policy (CSP)
- **Nonce-based CSP**: Dynamic nonce generation for inline scripts
- **Strict Policy**: Comprehensive security headers
- **Development Support**: Relaxed policies for development with hot reloading

#### Authentication & Authorization
- **Supabase Auth**: JWT-based authentication
- **Role-based Access**: Admin and family user roles
- **Row Level Security**: Database-level access control

#### Security Headers
- **HSTS**: HTTP Strict Transport Security enabled
- **CSP**: Content Security Policy with nonce implementation
- **Additional Headers**: X-Frame-Options, X-Content-Type-Options, etc.

### PWA Implementation
- **Service Worker**: Offline capability and caching strategies
- **Web App Manifest**: Native app-like installation
- **Offline Fallback**: Graceful degradation when offline
- **Push Notifications**: Browser-based push notification support

## API Architecture

### Internal API (Remix Actions/Loaders)
Most backend logic is handled through Remix's built-in `loader` and `action` functions within routes, providing:
- Server-side rendering capabilities
- Type-safe data fetching
- Integrated error handling
- Automatic revalidation

### External API (v1)
Versioned REST API for external consumption:
- **Base Path**: `/api/v1`
- **Authentication**: Supabase JWT Bearer tokens
- **Authorization**: Role-based access control
- **Format**: JSON requests and responses
- **Error Handling**: Standardized error responses

### Real-time Features
- **Supabase Realtime**: Live updates for conversations and messages
- **Push Notifications**: Browser notifications for important events
- **Automatic Revalidation**: Remix automatically revalidates data on mutations

## Performance Considerations

### Database Optimization
- **Explicit Columns**: Performance-critical fields use explicit columns for better indexing
- **JSONB Flexibility**: Additional data stored in JSONB for flexibility
- **Targeted Indexing**: Indexes on frequently queried explicit columns

### Frontend Optimization
- **Server-Side Rendering**: Remix provides SSR for better initial load times
- **Progressive Enhancement**: Works without JavaScript, enhanced with it
- **Code Splitting**: Automatic route-based code splitting
- **Caching**: Service worker caching for offline capability

### Deployment Architecture
- **Edge Functions**: Supabase Edge Functions for serverless backend logic
- **CDN**: Vercel/Netlify CDN for static asset delivery
- **Database**: Supabase managed PostgreSQL with global distribution

## Development Workflow

### Type Safety
- **Database Types**: Generated TypeScript types from Supabase schema
- **API Types**: Shared types between frontend and backend
- **Component Props**: Fully typed React components

### Testing Strategy
- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user workflow testing

### Deployment Pipeline
- **GitHub Actions**: Automated deployment workflows
- **Environment Management**: Separate staging and production environments
- **Database Migrations**: Automated schema updates
- **Type Generation**: Automatic type updates on schema changes

## Monitoring and Observability

### Error Handling
- **Remix ErrorBoundary**: Graceful error handling and user feedback
- **Supabase Logs**: Database and function execution logs
- **Stripe Dashboard**: Payment processing monitoring

### Performance Monitoring
- **Core Web Vitals**: Performance metrics tracking
- **Database Performance**: Query performance monitoring via Supabase
- **Real-time Monitoring**: Connection and message delivery tracking

## Future Architecture Considerations

### Scalability
- **Horizontal Scaling**: Supabase handles database scaling
- **Function Scaling**: Edge functions scale automatically
- **CDN Scaling**: Global content delivery

### Extensibility
- **Plugin Architecture**: Modular component system
- **API Versioning**: Support for multiple API versions
- **Database Flexibility**: JSONB columns for future extensions

### Integration Points
- **External APIs**: Structured for third-party integrations
- **Webhook Support**: Stripe webhooks for payment processing
- **Real-time Events**: Supabase real-time for live updates