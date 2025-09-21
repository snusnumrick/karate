import type { InvoiceEntity, EntityType, PaymentTerms } from "~/types/invoice";
import { siteConfig } from "~/config/site";

/**
 * Format entity display name with type
 */
export function formatEntityDisplayName(entity: InvoiceEntity): string {
  return `${entity.name} (${entity.entity_type})`;
}

/**
 * Format entity address as a single string
 */
export function formatEntityAddress(entity: InvoiceEntity): string {
  const parts = [
    entity.address_line1,
    entity.address_line2,
    entity.city,
    entity.state,
    entity.postal_code,
    entity.country !== siteConfig.localization.country ? entity.country : undefined
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Get entity type display label
 */
export function getEntityTypeLabel(entityType: EntityType): string {
  const labels: Record<EntityType, string> = {
    family: 'Family',
    school: 'School',
    government: 'Government',
    corporate: 'Corporate',
    other: 'Other'
  };
  
  return labels[entityType] || entityType;
}

/**
 * Get payment terms display label
 */
export function getPaymentTermsLabel(paymentTerms: PaymentTerms): string {
  const labels: Record<PaymentTerms, string> = {
    'Due on Receipt': 'Due on Receipt',
    'Net 15': 'Net 15 Days',
    'Net 30': 'Net 30 Days',
    'Net 60': 'Net 60 Days',
    'Net 90': 'Net 90 Days'
  };
  
  return labels[paymentTerms] || paymentTerms;
}

/**
 * Calculate due date based on issue date and payment terms
 */
export function calculateDueDate(issueDate: string, paymentTerms: PaymentTerms): string {
  const issue = new Date(issueDate);
  
  switch (paymentTerms) {
    case 'Due on Receipt':
      return issueDate;
    case 'Net 15':
      issue.setDate(issue.getDate() + 15);
      break;
    case 'Net 30':
      issue.setDate(issue.getDate() + 30);
      break;
    case 'Net 60':
      issue.setDate(issue.getDate() + 60);
      break;
    case 'Net 90':
      issue.setDate(issue.getDate() + 90);
      break;
    default:
      issue.setDate(issue.getDate() + 30); // Default to 30 days
  }
  
  return issue.toISOString().split('T')[0];
}

/**
 * Validate entity data
 */
export function validateEntityData(data: Partial<InvoiceEntity>): string[] {
  const errors: string[] = [];
  
  if (!data.name?.trim()) {
    errors.push('Entity name is required');
  }
  
  if (!data.entity_type) {
    errors.push('Entity type is required');
  }
  
  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email format');
  }
  
  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Invalid phone format');
  }
  
  if (data.credit_limit && data.credit_limit.getAmount() < 0) {
    errors.push('Credit limit cannot be negative');
  }
  
  return errors;
}

/**
 * Check if email format is valid
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if phone format is valid (basic validation)
 */
function isValidPhone(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Should have 10 or 11 digits (US format)
  return digits.length >= 10 && digits.length <= 11;
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  return phone; // Return original if format doesn't match
}

/**
 * Get entity status badge color
 */
export function getEntityStatusColor(isActive: boolean): string {
  return isActive ? 'green' : 'gray';
}

/**
 * Filter entities by search term
 */
export function filterEntitiesBySearch(entities: InvoiceEntity[], searchTerm: string): InvoiceEntity[] {
  if (!searchTerm.trim()) {
    return entities;
  }
  
  const term = searchTerm.toLowerCase();
  
  return entities.filter(entity => 
    entity.name.toLowerCase().includes(term) ||
    entity.contact_person?.toLowerCase().includes(term) ||
    entity.email?.toLowerCase().includes(term) ||
    entity.entity_type.toLowerCase().includes(term)
  );
}

/**
 * Sort entities by name
 */
export function sortEntitiesByName(entities: InvoiceEntity[], ascending: boolean = true): InvoiceEntity[] {
  return [...entities].sort((a, b) => {
    const comparison = a.name.localeCompare(b.name);
    return ascending ? comparison : -comparison;
  });
}

/**
 * Group entities by type
 */
export function groupEntitiesByType(entities: InvoiceEntity[]): Record<EntityType, InvoiceEntity[]> {
  return entities.reduce((groups, entity) => {
    const type = entity.entity_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(entity);
    return groups;
  }, {} as Record<EntityType, InvoiceEntity[]>);
}

/**
 * Check if entity has complete address
 */
export function hasCompleteAddress(entity: InvoiceEntity): boolean {
  return !!(entity.address_line1 && entity.city && entity.state && entity.postal_code);
}

/**
 * Generate entity summary for display
 */
export function generateEntitySummary(entity: InvoiceEntity): string {
  const parts = [
    entity.name,
    getEntityTypeLabel(entity.entity_type),
    entity.contact_person,
    entity.email
  ].filter(Boolean);
  
  return parts.join(' • ');
}