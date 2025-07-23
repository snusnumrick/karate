import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';
import type { Invoice, InvoiceEntity, InvoiceLineItem } from '~/types/invoice';

// Register fonts for better typography
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2' },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: 2,
    borderBottomColor: '#2563eb',
    paddingBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
  },
  companyInfo: {
    textAlign: 'right',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  invoiceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  invoiceDetails: {
    flex: 1,
  },
  billingInfo: {
    flex: 1,
    marginLeft: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailLabel: {
    width: 80,
    fontSize: 9,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  detailValue: {
    fontSize: 9,
    color: '#1f2937',
    flex: 1,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottom: 1,
    borderBottomColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 5,
    minHeight: 25,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableCell: {
    fontSize: 9,
    color: '#1f2937',
    paddingRight: 5,
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
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalsTable: {
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: 10,
    color: '#374151',
  },
  totalValue: {
    fontSize: 10,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    borderTop: 2,
    borderTopColor: '#2563eb',
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  notesSection: {
    marginTop: 30,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 35,
    right: 35,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 35,
    right: 35,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  paidBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  overdueBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
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
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadgeStyle = () => {
    switch (invoice.status) {
      case 'paid':
        return [styles.statusBadge, styles.paidBadge];
      case 'overdue':
        return [styles.statusBadge, styles.overdueBadge];
      default:
        return styles.statusBadge;
    }
  };

  const subtotal = invoice.line_items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const taxAmount = invoice.tax_amount || 0;
  const discountAmount = invoice.discount_amount || 0;
  const total = subtotal + taxAmount - discountAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Status Badge */}
        <View style={getStatusBadgeStyle()}>
          <Text>{invoice.status.toUpperCase()}</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            {companyInfo?.logo && (
              <Image style={styles.logo} src={companyInfo.logo} />
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>
              {companyInfo?.name || 'Your Company Name'}
            </Text>
            <Text style={styles.companyDetails}>
              {companyInfo?.address || 'Company Address'}
            </Text>
            {companyInfo?.phone && (
              <Text style={styles.companyDetails}>
                Phone: {companyInfo.phone}
              </Text>
            )}
            {companyInfo?.email && (
              <Text style={styles.companyDetails}>
                Email: {companyInfo.email}
              </Text>
            )}
            {companyInfo?.website && (
              <Text style={styles.companyDetails}>
                Website: {companyInfo.website}
              </Text>
            )}
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
              <Text style={styles.detailValue}>{invoice.invoice_number}</Text>
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
            <Text style={styles.detailValue}>{invoice.entity.name}</Text>
            {invoice.entity.contact_person && (
              <Text style={styles.detailValue}>
                Attn: {invoice.entity.contact_person}
              </Text>
            )}
            {invoice.entity.address_line1 && (
              <Text style={styles.detailValue}>{invoice.entity.address_line1}</Text>
            )}
            {invoice.entity.address_line2 && (
              <Text style={styles.detailValue}>{invoice.entity.address_line2}</Text>
            )}
            {invoice.entity.city && invoice.entity.state && (
              <Text style={styles.detailValue}>
                {invoice.entity.city}, {invoice.entity.state} {invoice.entity.postal_code}
              </Text>
            )}
            {invoice.entity.email && (
              <Text style={styles.detailValue}>{invoice.entity.email}</Text>
            )}
            {invoice.entity.phone && (
              <Text style={styles.detailValue}>{invoice.entity.phone}</Text>
            )}
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

          {invoice.line_items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.descriptionColumn}>
                <Text style={styles.tableCell}>{item.description}</Text>
              </View>
              <Text style={[styles.tableCell, styles.quantityColumn]}>
                {item.quantity}
              </Text>
              <Text style={[styles.tableCell, styles.priceColumn]}>
                {formatCurrency(item.unit_price)}
              </Text>
              <Text style={[styles.tableCell, styles.amountColumn]}>
                {formatCurrency(item.quantity * item.unit_price)}
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
            
            {discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount:</Text>
                <Text style={styles.totalValue}>-{formatCurrency(discountAmount)}</Text>
              </View>
            )}
            
            {taxAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax:</Text>
                <Text style={styles.totalValue}>{formatCurrency(taxAmount)}</Text>
              </View>
            )}
            
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total:</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Thank you for your business! Payment is due by {formatDate(invoice.due_date)}.
          {companyInfo?.email && ` For questions, contact us at ${companyInfo.email}.`}
        </Text>
      </Page>
    </Document>
  );
}