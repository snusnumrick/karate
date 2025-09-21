import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { siteConfig } from '~/config/site';
import type { Invoice, InvoiceEntity, InvoiceLineItem } from '~/types/invoice';
import { calculateLineItemDiscount } from '~/utils/line-item-helpers';
import {
    addMoney, subtractMoney, multiplyMoney, formatMoney, formatPercentage, type Money,
    isPositive, ZERO_MONEY
} from '~/utils/money';

interface LineItemTax {
  tax_description_snapshot?: string;
  tax_name_snapshot?: string;
  tax_rate_snapshot?: number;
  tax_amount?: Money;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 25,
    paddingBottom: 40,
    paddingHorizontal: 30,
    backgroundColor: '#ffffff',
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: `2px solid ${siteConfig.colors.primary}`,
  },
  logo: {
    width: 160,
    height: 30,
  },
  companyInfo: {
    textAlign: 'right',
    maxWidth: 250,
  },
  companyName: {
    fontSize: 12,
    // fontWeight: 'bold',
    // color: siteConfig.colors.primary,
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.3,
  },
  companyDetails: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
    marginBottom: 3,
    marginTop: 2,
  },
  addressLine: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.2,
    marginBottom: 1,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 20,
  },
  invoiceDetails: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
  },
  billingInfo: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 6,
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: siteConfig.colors.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: 3,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  detailLabel: {
    width: 80,
    fontSize: 9,
    color: '#64748b',
    fontWeight: 'bold',
  },
  detailValue: {
    fontSize: 9,
    color: '#1f2937',
    flex: 1,
    lineHeight: 1.3,
  },
  recipientAddress: {
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.4,
    marginBottom: 2,
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: siteConfig.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #f1f5f9',
    paddingVertical: 8,
    paddingHorizontal: 6,
    minHeight: 28,
    backgroundColor: '#ffffff',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableCell: {
    fontSize: 9,
    color: '#1f2937',
    paddingRight: 6,
    lineHeight: 1.3,
  },
  descriptionColumn: {
    flex: 3,
  },
  quantityColumn: {
    flex: 1,
    textAlign: 'center',
  },
  priceColumn: {
    flex: 1.5,
    textAlign: 'right',
  },
  amountColumn: {
    flex: 1.5,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  totalsSection: {
    marginTop: 15,
    alignItems: 'flex-end',
  },
  totalsTable: {
    width: 250,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottom: '1px solid #e2e8f0',
  },
  totalLabel: {
    fontSize: 10,
    color: '#4b5563',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 10,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingHorizontal: 8,
    paddingLeft: 16,
  },
  breakdownLabel: {
    fontSize: 8,
    color: '#6b7280',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 8,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: siteConfig.colors.primary,
    borderRadius: 4,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  notesSection: {
    marginTop: 20,
    backgroundColor: '#fef7cd',
    padding: 12,
    borderRadius: 6,
    border: '1px solid #fbbf24',
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  notesText: {
    fontSize: 9,
    color: '#78350f',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#6b7280',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 8,
    lineHeight: 1.3,
  },
  statusBadge: {
    position: 'absolute',
    top: 25,
    right: 30,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    border: '1px solid #f59e0b',
  },
  paidBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '1px solid #10b981',
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #ef4444',
  },
  draftBadge: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #6b7280',
  },
  sentBadge: {
    backgroundColor: '#dcfce7',
    color: siteConfig.colors.primary,
    border: '1px solid #22c55e',
  },
  lineItemAdjustments: {
    paddingLeft: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  adjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  adjustmentLabel: {
    fontSize: 8,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  adjustmentValue: {
    fontSize: 8,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  discountValue: {
    color: '#059669',
  },
  taxValue: {
    color: '#1f2937',
  },
});

interface InvoiceTemplateProps {
  invoice: Invoice & {
    entity: InvoiceEntity;
    line_items: InvoiceLineItem[];
  };
  companyInfo?: {
    name: string;
    address: string;
    phone?: string;
    email?: string;
    website?: string;
    logo?: string;
  };
}

export function InvoiceTemplate({ invoice, companyInfo }: InvoiceTemplateProps) {


  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString(siteConfig.localization.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const safeText = (text: string | null | undefined, fallback: string = 'N/A') => {
    if (!text || text.trim() === '') return fallback;
    return text.trim();
  };

  const getStatusBadgeStyle = () => {
    switch (invoice.status) {
      case 'paid':
        return [styles.statusBadge, styles.paidBadge];
      case 'overdue':
        return [styles.statusBadge, styles.overdueBadge];
      case 'draft':
        return [styles.statusBadge, styles.draftBadge];
      case 'sent':
      case 'viewed':
        return [styles.statusBadge, styles.sentBadge];
      default:
        return styles.statusBadge;
    }
  };

  // Calculate totals using dinero.js
  const subtotalMoney : Money = invoice.line_items?.reduce((sum: Money, item) => {
    const lineTotal : Money = multiplyMoney(item.unit_price, item.quantity || 0);
    return addMoney(sum, lineTotal);
  }, ZERO_MONEY);

  const discountMoney : Money = invoice.line_items?.reduce((sum: Money, item) => {
    const discount = calculateLineItemDiscount(item);
    return addMoney(sum, discount);
  }, ZERO_MONEY);

  const taxMoney = invoice.line_items?.reduce((sum: Money, item) => {
    const itemTaxes = (item as InvoiceLineItem & { taxes?: LineItemTax[] }).taxes || [];
    const itemTaxTotal : Money = itemTaxes.reduce((taxSum: Money, tax) => {
      // tax_amount is stored in cents according to our documentation
      return addMoney(taxSum, tax.tax_amount);
    }, ZERO_MONEY);
    return addMoney(sum, itemTaxTotal);
  }, ZERO_MONEY) || ZERO_MONEY;

  const totalMoney = addMoney(subtractMoney(subtotalMoney, discountMoney), taxMoney);

  // Get dynamic origin for logo URL
  const getLogoUrl = () => {
    if (typeof window !== 'undefined') {
        console.log('client side logo url', `${window.location.origin}/logo-light.png`);
      return `${window.location.origin}/logo-light.png`;
    }
    // Fallback for server-side rendering
      console.log('server side logo url', `${siteConfig.url}/logo-light.png`);
    return siteConfig.url + '/logo-light.png';
  };

  return (
    <Document>
      <Page size={siteConfig.localization.pageSize as 'A4' | 'LETTER'} style={styles.page}>
        {/* Status Badge - Only show for paid, overdue, or cancelled status */}
        {(invoice.status === 'paid' || invoice.status === 'overdue' || invoice.status === 'cancelled') && (
          <View style={getStatusBadgeStyle()}>
            <Text>{safeText(invoice.status, 'DRAFT').toUpperCase()}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          {/* Company Logo and Info */}
          <View style={styles.companyInfo}>
            <Image 
              src={getLogoUrl()} 
              style={styles.logo}
            />
            <Text style={styles.companyName}>{companyInfo?.name || siteConfig.name}</Text>
            <View style={styles.companyDetails}>
              <Text style={styles.addressLine}>{companyInfo?.address || siteConfig.legal.address}</Text>
              <Text style={styles.addressLine}>{companyInfo?.phone || siteConfig.contact.phone}</Text>
              <Text style={styles.addressLine}>{companyInfo?.email || siteConfig.contact.email}</Text>
              {companyInfo?.website && (
                <Text style={styles.addressLine}>{companyInfo.website}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Invoice Title */}
        <Text style={styles.invoiceTitle}>INVOICE</Text>

        {/* Invoice Info */}
        <View style={styles.invoiceInfo}>
          <View style={styles.invoiceDetails}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Invoice #:</Text>
              <Text style={styles.detailValue}>{safeText(invoice.invoice_number, 'TBD')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Issue Date:</Text>
              <Text style={styles.detailValue}>{formatDate(invoice.issue_date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Due Date:</Text>
              <Text style={styles.detailValue}>{formatDate(invoice.due_date)}</Text>
            </View>

          </View>

          <View style={styles.billingInfo}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Text style={styles.recipientAddress}>{safeText(invoice.entity?.name, 'Customer Name')}</Text>
            {invoice.entity?.contact_person && invoice.entity.contact_person.trim() ? (
              <Text style={styles.recipientAddress}>
                Attn: {safeText(invoice.entity.contact_person, 'N/A')}
              </Text>
            ) : null}
            {invoice.entity?.address_line1 && invoice.entity.address_line1.trim() ? (
              <Text style={styles.recipientAddress}>{safeText(invoice.entity.address_line1, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.address_line2 && invoice.entity.address_line2.trim() ? (
              <Text style={styles.recipientAddress}>{safeText(invoice.entity.address_line2, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.city && invoice.entity.city.trim() ? (
              <Text style={styles.recipientAddress}>
                {[
                  invoice.entity.city.trim(), 
                  invoice.entity?.state && invoice.entity.state.trim() ? invoice.entity.state.trim() : null,
                  invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? invoice.entity.postal_code.trim() : null
                ].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {!invoice.entity?.city?.trim() && invoice.entity?.state && invoice.entity.state.trim() ? (
              <Text style={styles.recipientAddress}>
                {[
                  invoice.entity.state.trim(),
                  invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? invoice.entity.postal_code.trim() : null
                ].filter(Boolean).join(' ')}
              </Text>
            ) : null}
            {!invoice.entity?.city?.trim() && !invoice.entity?.state?.trim() && invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? (
              <Text style={styles.recipientAddress}>{invoice.entity.postal_code.trim()}</Text>
            ) : null}
            {invoice.entity?.email && invoice.entity.email.trim() ? (
              <Text style={styles.recipientAddress}>{safeText(invoice.entity.email, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.phone && invoice.entity.phone.trim() ? (
              <Text style={styles.recipientAddress}>{safeText(invoice.entity.phone, 'N/A')}</Text>
            ) : null}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.descriptionColumn]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, styles.quantityColumn]}>
              Qty
            </Text>
            <Text style={[styles.tableHeaderCell, styles.priceColumn]}>
              Unit Price
            </Text>
            <Text style={[styles.tableHeaderCell, styles.amountColumn]}>
              Amount
            </Text>
          </View>

          {invoice.line_items?.map((item, index) => {
            const itemDiscount = calculateLineItemDiscount(item);
            const itemTaxes = (item as InvoiceLineItem & { taxes?: LineItemTax[] }).taxes || [];
            const hasAdjustments = isPositive(itemDiscount) || itemTaxes.length > 0;
            
            return (
              <View key={index}>
                <View style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
                  <View style={styles.descriptionColumn}>
                    <Text style={styles.tableCell}>{safeText(item.description, 'Item')}</Text>
                  </View>
                  <Text style={[styles.tableCell, styles.quantityColumn]}>
                    {item.quantity || 0}
                  </Text>
                  <Text style={[styles.tableCell, styles.priceColumn]}>
                    {formatMoney(item.unit_price || ZERO_MONEY)}
                  </Text>
                  <Text style={[styles.tableCell, styles.amountColumn]}>
                    {formatMoney(multiplyMoney(item.unit_price || ZERO_MONEY, item.quantity || 0))}
                  </Text>
                </View>
                
                {hasAdjustments && (
                  <View style={[styles.lineItemAdjustments, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}>
                    {isPositive(itemDiscount) && (
                      <View style={styles.adjustmentRow}>
                        <Text style={styles.adjustmentLabel}>
                          Discount ({Number(item.discount_rate).toFixed(2)}%):
                        </Text>
                        <Text style={[styles.adjustmentValue, styles.discountValue]}>
                          -{formatMoney(itemDiscount)}
                        </Text>
                      </View>
                    )}
                    
                    {itemTaxes.map((tax: LineItemTax, taxIndex: number) => (
                      <View key={taxIndex} style={styles.adjustmentRow}>
                        <Text style={styles.adjustmentLabel}>
                          {tax.tax_description_snapshot || tax.tax_name_snapshot || 'Tax'} ({formatPercentage(tax.tax_rate_snapshot || 0)}):
                        </Text>
                        <Text style={[styles.adjustmentValue, styles.taxValue]}>
                          {formatMoney(tax.tax_amount || ZERO_MONEY)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatMoney(subtotalMoney)}</Text>
            </View>
            
            {isPositive(discountMoney)  && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Discounts:</Text>
                <Text style={styles.totalValue}>-{formatMoney(discountMoney)}</Text>
              </View>
            )}
            
            {isPositive(taxMoney) && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Tax:</Text>
                <Text style={styles.totalValue}>{formatMoney(taxMoney)}</Text>
              </View>
            )}
            
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>{formatMoney(totalMoney)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && invoice.notes.trim() ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{safeText(invoice.notes, 'N/A')}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business! Payment is due by {formatDate(invoice.due_date)}.
          {companyInfo?.email && companyInfo.email.trim() ? (
            <Text> For questions, contact us at {safeText(companyInfo.email, 'N/A')}.</Text>
          ) : null}
        </Text>
      </Page>
    </Document>
  );
}