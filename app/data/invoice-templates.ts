import { InvoiceTemplate } from "~/types/invoice";
import { createFeeLineItem, getDefaultServicePeriod } from "~/utils/line-item-helpers";
import { fromDollars } from '~/utils/money';

export const invoiceTemplates: InvoiceTemplate[] = [
  {
    id: 'monthly-enrollment',
    name: 'Monthly Class Enrollment',
    description: 'Standard monthly enrollment fee for regular classes',
    category: 'enrollment',
    lineItems: [
      {
        item_type: 'class_enrollment',
        description: 'Monthly Class Fee',
        quantity: 1,
        unit_price: fromDollars(0), // Will be filled based on actual class
        tax_rate: 0,
        discount_rate: 0,
        service_period_start: getDefaultServicePeriod().start,
        service_period_end: getDefaultServicePeriod().end
      }
    ],
    defaultTerms: 'Payment is due by the 1st of each month. Late fees may apply after the 5th.',
    defaultNotes: 'Thank you for your continued participation in our martial arts program.'
  },
  
  {
    id: 'registration-package',
    name: 'New Student Registration',
    description: 'Complete package for new student registration including fees and equipment',
    category: 'enrollment',
    lineItems: [
      createFeeLineItem('Registration Fee', fromDollars(50)),
      createFeeLineItem('Uniform (Gi)', fromDollars(75)),
      createFeeLineItem('Belt', fromDollars(15)),
      {
        item_type: 'class_enrollment',
        description: 'First Month Class Fee',
        quantity: 1,
        unit_price: fromDollars(0), // Will be filled based on actual class
        tax_rate: 0,
        discount_rate: 0,
        service_period_start: getDefaultServicePeriod().start,
        service_period_end: getDefaultServicePeriod().end
      }
    ],
    defaultTerms: 'Registration fee is non-refundable. Monthly fees are due by the 1st of each month.',
    defaultNotes: 'Welcome to our martial arts family! We look forward to your training journey.'
  },
  
  {
    id: 'testing-fees',
    name: 'Belt Testing Fees',
    description: 'Fees for belt promotion testing',
    category: 'fees',
    lineItems: [
      createFeeLineItem('Belt Testing Fee', fromDollars(40)),
      createFeeLineItem('New Belt', fromDollars(20))
    ],
    defaultTerms: 'Testing fees are due before the testing date.',
    defaultNotes: 'Congratulations on your progress! Good luck with your testing.'
  },
  
  {
    id: 'tournament-fees',
    name: 'Tournament Registration',
    description: 'Registration fees for tournament participation',
    category: 'fees',
    lineItems: [
      createFeeLineItem('Tournament Entry Fee', fromDollars(60)),
      createFeeLineItem('USANKF Membership (if required)', fromDollars(35))
    ],
    defaultTerms: 'Tournament fees are non-refundable and must be paid before the registration deadline.',
    defaultNotes: 'We wish you the best of luck in the tournament!'
  },
  
  {
    id: 'equipment-package',
    name: 'Sparring Equipment Package',
    description: 'Complete sparring gear package for competition students',
    category: 'products',
    lineItems: [
      createFeeLineItem('Sparring Gloves', fromDollars(45)),
      createFeeLineItem('Foot Pads', fromDollars(35)),
      createFeeLineItem('Shin Guards', fromDollars(40)),
      createFeeLineItem('Headgear', fromDollars(65)),
      createFeeLineItem('Mouthguard', fromDollars(15))
    ],
    defaultTerms: 'Equipment sales are final. Please ensure proper fit before purchase.',
    defaultNotes: 'This equipment meets tournament standards and regulations.'
  },
  
  {
    id: 'private-lessons',
    name: 'Private Lesson Package',
    description: 'Package of private one-on-one lessons',
    category: 'enrollment',
    lineItems: [
      {
        item_type: 'individual_session',
        description: 'Private Lesson (1 hour)',
        quantity: 4,
        unit_price: fromDollars(75),
        tax_rate: 0,
        discount_rate: 0
      }
    ],
    defaultTerms: 'Private lessons must be scheduled in advance and are subject to instructor availability.',
    defaultNotes: 'Private lessons provide personalized instruction to accelerate your progress.'
  },
  
  {
    id: 'family-discount',
    name: 'Family Enrollment with Discount',
    description: 'Multiple family members with family discount applied',
    category: 'enrollment',
    lineItems: [
      {
        item_type: 'class_enrollment',
        description: 'First Family Member - Monthly Fee',
        quantity: 1,
        unit_price: fromDollars(0), // Will be filled based on actual class
        tax_rate: 0,
        discount_rate: 0,
        service_period_start: getDefaultServicePeriod().start,
        service_period_end: getDefaultServicePeriod().end
      },
      {
        item_type: 'class_enrollment',
        description: 'Additional Family Member - Monthly Fee',
        quantity: 1,
        unit_price: fromDollars(0), // Will be filled based on actual class
        tax_rate: 0,
        discount_rate: 10, // 10% family discount
        service_period_start: getDefaultServicePeriod().start,
        service_period_end: getDefaultServicePeriod().end
      }
    ],
    defaultTerms: 'Family discount applies to additional family members. Payment is due by the 1st of each month.',
    defaultNotes: 'Thank you for bringing your family to train with us!'
  },
  
  {
    id: 'makeup-classes',
    name: 'Makeup Class Fees',
    description: 'Fees for makeup classes due to absences',
    category: 'fees',
    lineItems: [
      createFeeLineItem('Makeup Class Fee', fromDollars(25))
    ],
    defaultTerms: 'Makeup classes must be scheduled within 30 days of the missed class.',
    defaultNotes: 'Makeup classes help ensure you stay on track with your training.'
  },
  
  {
    id: 'summer-camp',
    name: 'Summer Camp Program',
    description: 'Week-long summer martial arts camp',
    category: 'enrollment',
    lineItems: [
      createFeeLineItem('Summer Camp Week 1', fromDollars(150)),
      createFeeLineItem('Camp T-Shirt', fromDollars(20)),
      createFeeLineItem('Lunch (5 days)', fromDollars(50))
    ],
    defaultTerms: 'Camp fees are due one week before the camp start date. Cancellations must be made 48 hours in advance.',
    defaultNotes: 'Our summer camp provides intensive training and fun activities for all skill levels.'
  },
  
  {
    id: 'annual-membership',
    name: 'Annual Membership Discount',
    description: 'Full year membership with discount for upfront payment',
    category: 'enrollment',
    lineItems: [
      {
        item_type: 'class_enrollment',
        description: 'Annual Membership (12 months)',
        quantity: 12,
        unit_price: fromDollars(0), // Will be filled based on actual class
        tax_rate: 0,
        discount_rate: 15, // 15% discount for annual payment
        service_period_start: getDefaultServicePeriod().start,
        service_period_end: new Date(new Date().getFullYear() + 1, new Date().getMonth(), 0).toISOString().split('T')[0]
      }
    ],
    defaultTerms: 'Annual membership is non-refundable but transferable. Membership includes all regular classes.',
    defaultNotes: 'Thank you for your commitment to training with us for the full year!'
  }
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): InvoiceTemplate | undefined {
  return invoiceTemplates.find(template => template.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: InvoiceTemplate['category']): InvoiceTemplate[] {
  return invoiceTemplates.filter(template => template.category === category);
}

/**
 * Get all template categories
 */
export function getTemplateCategories(): Array<{ value: InvoiceTemplate['category']; label: string }> {
  return [
    { value: 'enrollment', label: 'Class Enrollments' },
    { value: 'fees', label: 'Fees & Testing' },
    { value: 'products', label: 'Products & Equipment' },
    { value: 'custom', label: 'Custom Templates' }
  ];
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): InvoiceTemplate[] {
  const searchTerm = query.toLowerCase();
  return invoiceTemplates.filter(template => 
    template.name.toLowerCase().includes(searchTerm) ||
    template.description.toLowerCase().includes(searchTerm)
  );
}