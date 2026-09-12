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
import type { CSSProperties } from "react";

export type AdminMessageEmailProps = {
  guardianName: string;
  subject: string;
  message: string;
};

export function AdminMessageEmail({
  guardianName,
  subject,
  message,
}: AdminMessageEmailProps) {
  const paragraphs = message
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <Html lang="en">
      <Head />

      <Preview>{subject}</Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={academyNameStyle}>ARTIS SOCCER ACADEMY</Text>

            <Heading as="h1" style={headingStyle}>
              {subject}
            </Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={paragraphStyle}>Hello {guardianName},</Text>

            {paragraphs.map((paragraph, index) => (
              <Text key={`${index}-${paragraph}`} style={paragraphStyle}>
                {paragraph}
              </Text>
            ))}

            <Hr style={dividerStyle} />

            <Text style={smallTextStyle}>
              If you have questions, reply to this email and ARTIS Soccer
              Academy will assist you.
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

export default AdminMessageEmail;

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
