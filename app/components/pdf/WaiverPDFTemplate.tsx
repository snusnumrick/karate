import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';
import { siteConfig } from '~/config/site';

interface WaiverPDFTemplateProps {
  waiver: {
    id: string;
    title: string;
    content: string;
  };
  signature: {
    id: string;
    signedAt: string;
    signatureImage: string; // base64 data URL
  };
  guardian: {
    firstName: string;
    lastName: string;
  };
  students: {
    id: string;
    firstName: string;
    lastName: string;
  }[];
  program?: {
    name: string;
  };
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 30,
    paddingBottom: 40,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
    paddingBottom: 15,
    borderBottom: `2px solid ${siteConfig.colors.primary}`,
  },
  logo: {
    width: 140,
    height: 26,
  },
  companyInfo: {
    textAlign: 'right',
    maxWidth: 250,
  },
  companyName: {
    fontSize: 11,
    marginBottom: 4,
    marginTop: 8,
    color: '#1f2937',
    letterSpacing: 0.3,
  },
  companyDetails: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: siteConfig.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 25,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: siteConfig.colors.primary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: 4,
  },
  infoBox: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: 12,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4b5563',
    width: 120,
  },
  infoValue: {
    fontSize: 9,
    color: '#1f2937',
    flex: 1,
  },
  studentList: {
    marginTop: 6,
  },
  studentItem: {
    fontSize: 9,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 8,
  },
  studentBullet: {
    marginRight: 6,
    color: siteConfig.colors.primary,
  },
  waiverContent: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.6,
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    padding: 15,
    marginBottom: 20,
    whiteSpace: 'pre-wrap',
  },
  signatureSection: {
    marginTop: 25,
    paddingTop: 20,
    borderTop: '2px solid #e5e7eb',
  },
  signatureBox: {
    backgroundColor: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    padding: 15,
    marginBottom: 15,
  },
  signatureLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4b5563',
    marginBottom: 8,
  },
  signatureImage: {
    width: 250,
    height: 80,
    border: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  signatureName: {
    fontSize: 10,
    color: '#1f2937',
    borderBottom: '1px solid #9ca3af',
    paddingBottom: 4,
    marginBottom: 4,
  },
  signatureDate: {
    fontSize: 8,
    color: '#6b7280',
  },
  agreementText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
    fontStyle: 'italic',
    backgroundColor: '#fef3c7',
    border: '1px solid #fbbf24',
    borderRadius: 4,
    padding: 12,
    marginTop: 15,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: '#9ca3af',
    borderTop: '1px solid #e5e7eb',
    paddingTop: 10,
    lineHeight: 1.4,
  },
  documentId: {
    position: 'absolute',
    top: 30,
    right: 40,
    fontSize: 7,
    color: '#9ca3af',
  },
  legalNotice: {
    fontSize: 7,
    color: '#6b7280',
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    lineHeight: 1.4,
  },
});

export function WaiverPDFTemplate({
  waiver,
  signature,
  guardian,
  students,
  program,
}: WaiverPDFTemplateProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(siteConfig.localization.locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const guardianFullName = `${guardian.firstName} ${guardian.lastName}`;

  const studentNames = students.map(s => `${s.firstName} ${s.lastName}`);
  const studentNamesText = students.length === 1
    ? studentNames[0]
    : students.length === 2
    ? `${studentNames[0]} and ${studentNames[1]}`
    : `${studentNames.slice(0, -1).join(', ')}, and ${studentNames[students.length - 1]}`;

  // Get dynamic origin for logo URL
  const getLogoUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/logo-light.png`;
    }
    return `${siteConfig.url}/logo-light.png`;
  };

  return (
    <Document>
      <Page size={siteConfig.localization.pageSize as 'A4' | 'LETTER'} style={styles.page}>
        {/* Document ID */}
        <Text style={styles.documentId}>
          Document ID: {signature.id.substring(0, 8).toUpperCase()}
        </Text>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Image
              src={getLogoUrl()}
              style={styles.logo}
            />
            <Text style={styles.companyName}>{siteConfig.name}</Text>
            <Text style={styles.companyDetails}>{siteConfig.legal.address}</Text>
            <Text style={styles.companyDetails}>{siteConfig.contact.phone}</Text>
            <Text style={styles.companyDetails}>{siteConfig.contact.email}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Liability Waiver</Text>
        <Text style={styles.subtitle}>{waiver.title}</Text>

        {/* Participant Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participant Information</Text>
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Guardian/Parent:</Text>
              <Text style={styles.infoValue}>{guardianFullName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {students.length === 1 ? 'Student:' : 'Students:'}
              </Text>
              <View style={styles.studentList}>
                {students.map((student) => (
                  <Text key={student.id} style={styles.studentItem}>
                    <Text style={styles.studentBullet}>•</Text>
                    {student.firstName} {student.lastName}
                  </Text>
                ))}
              </View>
            </View>

            {program && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Program:</Text>
                <Text style={styles.infoValue}>{program.name}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date Signed:</Text>
              <Text style={styles.infoValue}>{formatDate(signature.signedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Waiver Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waiver Terms and Conditions</Text>
          <Text style={styles.waiverContent}>
            {waiver.content}
          </Text>
        </View>

        {/* Agreement Statement */}
        <View style={styles.agreementText}>
          <Text>
            I, {guardianFullName}, on behalf of {studentNamesText}, have carefully read and fully understand the above waiver and release of liability. I voluntarily agree to the terms and conditions stated above.
          </Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>Guardian Signature</Text>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Signature:</Text>
            <Image
              src={signature.signatureImage}
              style={styles.signatureImage}
            />
            <Text style={styles.signatureName}>
              {guardianFullName}
            </Text>
            <Text style={styles.signatureDate}>
              Signed on: {formatDate(signature.signedAt)}
            </Text>
          </View>
        </View>

        {/* Legal Notice for BC */}
        <View style={styles.legalNotice}>
          <Text>
            LEGAL NOTICE (British Columbia): Under BC law, waivers signed by parents/guardians on behalf of minors (persons under 19 years of age) may not be enforceable. This document serves as evidence of informed consent and acknowledgment of risks. The school maintains liability insurance as primary protection.
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a legally binding document. Please keep a copy for your records.{'\n'}
          Document generated on {formatDate(signature.signedAt)} · {siteConfig.name}{'\n'}
          {siteConfig.contact.email} · {siteConfig.contact.phone}
        </Text>
      </Page>
    </Document>
  );
}
