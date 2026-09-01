import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

export type ContactMessageEmailProps = {
  senderName: string;
  senderEmail: string;
  phoneNumber: string | null;
  enquiryType: string;
  message: string;
  submittedAt: string;
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

export function ContactMessageEmail({
  senderName,
  senderEmail,
  phoneNumber,
  enquiryType,
  message,
  submittedAt,
}: ContactMessageEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        New {enquiryType.toLowerCase()} from {senderName}
      </Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={academyNameStyle}>ARTIS SOCCER ACADEMY</Text>
            <Heading as="h1" style={headingStyle}>
              New website enquiry
            </Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={introStyle}>
              A visitor submitted the Contact Us form on the ARTIS Soccer
              Academy website.
            </Text>

            <Section style={enquiryTypeStyle}>
              <Text style={enquiryLabelStyle}>ENQUIRY TYPE</Text>
              <Text style={enquiryValueStyle}>{enquiryType}</Text>
            </Section>

            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              style={detailsTableStyle}
            >
              <tbody>
                <DetailRow label="Name">{senderName}</DetailRow>
                <DetailRow label="Email">
                  <Link href={`mailto:${senderEmail}`} style={linkStyle}>
                    {senderEmail}
                  </Link>
                </DetailRow>
                <DetailRow label="Phone">
                  {phoneNumber ?? "Not provided"}
                </DetailRow>
                <DetailRow label="Submitted">{submittedAt}</DetailRow>
              </tbody>
            </table>

            <Heading as="h2" style={messageHeadingStyle}>
              Message
            </Heading>

            <Section style={messageSectionStyle}>
              <Text style={messageStyle}>{message}</Text>
            </Section>

            <Hr style={dividerStyle} />

            <Text style={smallTextStyle}>
              You can reply directly to this email to respond to {senderName}.
              Treat links and unexpected requests in public form submissions
              with care.
            </Text>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              ARTIS Soccer Academy · Website contact notification
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ContactMessageEmail;

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

const introStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 22px",
};

const enquiryTypeStyle: CSSProperties = {
  backgroundColor: "#f5ecd1",
  borderLeft: "4px solid #d3a62c",
  margin: "0 0 26px",
  padding: "13px 15px",
};

const enquiryLabelStyle: CSSProperties = {
  color: "#5e6874",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1px",
  lineHeight: "16px",
  margin: "0 0 3px",
};

const enquiryValueStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: 0,
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
  width: "32%",
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

const linkStyle: CSSProperties = {
  color: "#217a57",
  overflowWrap: "anywhere",
  textDecoration: "underline",
  wordBreak: "break-word",
};

const messageHeadingStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "20px",
  fontWeight: 700,
  lineHeight: "28px",
  margin: "28px 0 12px",
};

const messageSectionStyle: CSSProperties = {
  backgroundColor: "#f7f8f6",
  border: "1px solid #dce1e5",
  borderRadius: "8px",
  padding: "16px",
};

const messageStyle: CSSProperties = {
  color: "#0b1f33",
  fontSize: "15px",
  lineHeight: "24px",
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
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
