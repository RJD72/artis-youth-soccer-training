import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export type ETransferConfirmationEmailProps = {
  guardianName: string;
  playerName: string;
  trainingGroupName: string;
  programPackageName: string;
  registrationId: string;
  paymentReference: string;
  amount: string;
  paidAt: string;
  trainingDates: string;
  registrationStatus: string;
};

type DetailRowProps = {
  label: string;
  children: ReactNode;
};

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <tr>
      <td style={detailLabelStyle}>{label}</td>
      <td style={detailValueStyle}>{children}</td>
    </tr>
  );
}

export function ETransferConfirmationEmail({
  guardianName,
  playerName,
  trainingGroupName,
  programPackageName,
  registrationId,
  paymentReference,
  amount,
  paidAt,
  trainingDates,
  registrationStatus,
}: ETransferConfirmationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Payment confirmed for {playerName}</Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={academyNameStyle}>ARTIS SOCCER ACADEMY</Text>
            <Heading as="h1" style={headingStyle}>
              Payment confirmed
            </Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={paragraphStyle}>Hello {guardianName},</Text>

            <Text style={paragraphStyle}>
              ARTIS Soccer Academy has received and verified your e-transfer
              payment for {playerName}. The registration is now confirmed.
            </Text>

            <Section style={statusSectionStyle}>
              <Text style={statusLabelStyle}>REGISTRATION STATUS</Text>
              <Text style={statusValueStyle}>{registrationStatus}</Text>
            </Section>

            <Heading as="h2" style={detailsHeadingStyle}>
              Registration and payment details
            </Heading>

            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              style={detailsTableStyle}
            >
              <tbody>
                <DetailRow label="Player">{playerName}</DetailRow>
                <DetailRow label="Training group">
                  {trainingGroupName}
                </DetailRow>
                <DetailRow label="Package">{programPackageName}</DetailRow>
                <DetailRow label="Training dates">{trainingDates}</DetailRow>
                <DetailRow label="Amount paid">{amount}</DetailRow>
                <DetailRow label="Payment reference">
                  {paymentReference}
                </DetailRow>
                <DetailRow label="Payment confirmed">{paidAt}</DetailRow>
                <DetailRow label="Registration number">
                  {registrationId}
                </DetailRow>
              </tbody>
            </table>

            <Hr style={dividerStyle} />

            <Text style={smallTextStyle}>
              Please keep this email for your records. If any of these details
              appear incorrect, contact ARTIS Soccer Academy.
            </Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              ARTIS Soccer Academy · Youth soccer training
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ETransferConfirmationEmail;

const bodyStyle: CSSProperties = {
  backgroundColor: "#f7f8f6",
  color: "#0b1f33",
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: 0,
  padding: "32px 12px",
};

const containerStyle: CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #dce1e5",
  borderRadius: "12px",
  margin: "0 auto",
  maxWidth: "600px",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  backgroundColor: "#0b1f33",
  borderTop: "6px solid #d3a62c",
  padding: "28px 32px 24px",
};

const academyNameStyle: CSSProperties = {
  color: "#d3a62c",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "1.4px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const headingStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "28px",
  fontWeight: 700,
  lineHeight: "36px",
  margin: 0,
};

const contentStyle: CSSProperties = {
  padding: "28px 32px 32px",
};

const paragraphStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 18px",
};

const statusSectionStyle: CSSProperties = {
  backgroundColor: "#e8f4ee",
  borderLeft: "4px solid #217a57",
  margin: "24px 0 28px",
  padding: "14px 16px",
};

const statusLabelStyle: CSSProperties = {
  color: "#5e6874",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1px",
  lineHeight: "16px",
  margin: "0 0 3px",
};

const statusValueStyle: CSSProperties = {
  color: "#217a57",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: 0,
};

const detailsHeadingStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "20px",
  fontWeight: 700,
  lineHeight: "28px",
  margin: "0 0 14px",
};

const detailsTableStyle: CSSProperties = {
  borderCollapse: "collapse",
  width: "100%",
};

const detailLabelStyle: CSSProperties = {
  borderBottom: "1px solid #dce1e5",
  color: "#5e6874",
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: "20px",
  padding: "10px 12px 10px 0",
  textAlign: "left",
  verticalAlign: "top",
  width: "42%",
};

const detailValueStyle: CSSProperties = {
  borderBottom: "1px solid #dce1e5",
  color: "#0b1f33",
  fontSize: "14px",
  lineHeight: "21px",
  padding: "10px 0",
  textAlign: "right",
  verticalAlign: "top",
};

const dividerStyle: CSSProperties = {
  borderColor: "#dce1e5",
  margin: "26px 0 22px",
};

const smallTextStyle: CSSProperties = {
  color: "#5e6874",
  fontSize: "13px",
  lineHeight: "21px",
  margin: 0,
};

const footerStyle: CSSProperties = {
  backgroundColor: "#061522",
  padding: "18px 32px",
};

const footerTextStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: "12px",
  lineHeight: "18px",
  margin: 0,
  textAlign: "center",
};
