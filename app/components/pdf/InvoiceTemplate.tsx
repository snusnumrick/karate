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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 40,
    paddingBottom: 25,
    borderBottom: '3px solid #1e40af',
  },
  logo: {
    width: 80,
    height: 80,
  },
  companyInfo: {
    textAlign: 'right',
    maxWidth: 250,
  },
  companyName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  companyDetails: {
    fontSize: 10,
    color: '#4b5563',
    lineHeight: 1.5,
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 1,
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 35,
    gap: 30,
  },
  invoiceDetails: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  billingInfo: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    borderBottom: '1px solid #cbd5e1',
    paddingBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },
  detailLabel: {
    width: 90,
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
  },
  detailValue: {
    fontSize: 10,
    color: '#1f2937',
    flex: 1,
    lineHeight: 1.4,
  },
  table: {
    marginTop: 25,
    marginBottom: 25,
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 35,
    backgroundColor: '#ffffff',
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableCell: {
    fontSize: 10,
    color: '#1f2937',
    paddingRight: 8,
    lineHeight: 1.4,
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
    marginTop: 30,
    alignItems: 'flex-end',
  },
  totalsTable: {
    width: 280,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 5,
    borderBottom: '1px solid #e2e8f0',
  },
  totalLabel: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 5,
    backgroundColor: '#1e40af',
    borderRadius: 6,
    marginTop: 10,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  notesSection: {
    marginTop: 35,
    backgroundColor: '#fef7cd',
    padding: 20,
    borderRadius: 8,
    border: '1px solid #fbbf24',
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 10,
    color: '#78350f',
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#6b7280',
    borderTop: '2px solid #e5e7eb',
    paddingTop: 15,
    lineHeight: 1.4,
  },
  statusBadge: {
    position: 'absolute',
    top: 40,
    right: 40,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    border: '2px solid #f59e0b',
  },
  paidBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '2px solid #10b981',
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '2px solid #ef4444',
  },
  draftBadge: {
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '2px solid #6b7280',
  },
  sentBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    border: '2px solid #3b82f6',
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
  const formatCurrency = (amount: number | null | undefined) => {
    const safeAmount = amount || 0;
    try {
      const formatted = new Intl.NumberFormat(siteConfig.localization.locale, {
        style: 'currency',
        currency: siteConfig.localization.currency,
      }).format(safeAmount);
      return formatted || '$0.00'; // Fallback if formatted is empty
    } catch (error) {
      return '$0.00'; // Fallback if formatting fails
    }
  };

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

  const subtotal = invoice.line_items?.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0) || 0;
  const taxAmount = invoice.tax_amount || 0;
  const discountAmount = invoice.discount_amount || 0;
  const total = subtotal + taxAmount - discountAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Status Badge */}
        <View style={getStatusBadgeStyle()}>
          <Text>{safeText(invoice.status, 'DRAFT').toUpperCase()}</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            {companyInfo?.logo ? (
              <Image style={styles.logo} src={companyInfo.logo} />
            ) : null}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>
              {safeText(companyInfo?.name, 'Your Company Name')}
            </Text>
            <Text style={styles.companyDetails}>
              {safeText(companyInfo?.address, 'Company Address')}
            </Text>
            {companyInfo?.phone && companyInfo.phone.trim() ? (
              <Text style={styles.companyDetails}>
                Phone: {safeText(companyInfo.phone, 'N/A')}
              </Text>
            ) : null}
            {companyInfo?.email && companyInfo.email.trim() ? (
              <Text style={styles.companyDetails}>
                Email: {safeText(companyInfo.email, 'N/A')}
              </Text>
            ) : null}
            {companyInfo?.website && companyInfo.website.trim() ? (
              <Text style={styles.companyDetails}>
                Website: {safeText(companyInfo.website, 'N/A')}
              </Text>
            ) : null}
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
            <Text style={styles.detailValue}>{safeText(invoice.entity?.name, 'Customer Name')}</Text>
            {invoice.entity?.contact_person && invoice.entity.contact_person.trim() ? (
              <Text style={styles.detailValue}>
                Attn: {safeText(invoice.entity.contact_person, 'N/A')}
              </Text>
            ) : null}
            {invoice.entity?.address_line1 && invoice.entity.address_line1.trim() ? (
              <Text style={styles.detailValue}>{safeText(invoice.entity.address_line1, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.address_line2 && invoice.entity.address_line2.trim() ? (
              <Text style={styles.detailValue}>{safeText(invoice.entity.address_line2, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.city && invoice.entity.city.trim() ? (
              <Text style={styles.detailValue}>
                {[
                  invoice.entity.city.trim(), 
                  invoice.entity?.state && invoice.entity.state.trim() ? invoice.entity.state.trim() : null,
                  invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? invoice.entity.postal_code.trim() : null
                ].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {!invoice.entity?.city?.trim() && invoice.entity?.state && invoice.entity.state.trim() ? (
              <Text style={styles.detailValue}>
                {[
                  invoice.entity.state.trim(),
                  invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? invoice.entity.postal_code.trim() : null
                ].filter(Boolean).join(' ')}
              </Text>
            ) : null}
            {!invoice.entity?.city?.trim() && !invoice.entity?.state?.trim() && invoice.entity?.postal_code && invoice.entity.postal_code.trim() ? (
              <Text style={styles.detailValue}>{invoice.entity.postal_code.trim()}</Text>
            ) : null}
            {invoice.entity?.email && invoice.entity.email.trim() ? (
              <Text style={styles.detailValue}>{safeText(invoice.entity.email, 'N/A')}</Text>
            ) : null}
            {invoice.entity?.phone && invoice.entity.phone.trim() ? (
              <Text style={styles.detailValue}>{safeText(invoice.entity.phone, 'N/A')}</Text>
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

          {invoice.line_items?.map((item, index) => (
            <View key={index} style={index % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.tableCell}>{safeText(item.description, 'Item')}</Text>
              </View>
              <Text style={[styles.tableCell, styles.quantityColumn]}>
                {item.quantity || 0}
              </Text>
              <Text style={[styles.tableCell, styles.priceColumn]}>
                {formatCurrency(item.unit_price)}
              </Text>
              <Text style={[styles.tableCell, styles.amountColumn]}>
                {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            
            {discountAmount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount:</Text>
                <Text style={styles.totalValue}>-{formatCurrency(discountAmount)}</Text>
              </View>
            ) : null}
            
            {taxAmount > 0 ? (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax:</Text>
                <Text style={styles.totalValue}>{formatCurrency(taxAmount)}</Text>
              </View>
            ) : null}
            
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
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