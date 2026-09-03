import {
  Body,
  Button,
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
import type { CSSProperties } from "react";

export type GuardianVerificationEmailProps = {
  guardianName: string;
  verificationUrl: string;
  expiresAt: string;
};

export function GuardianVerificationEmail({
  guardianName,
  verificationUrl,
  expiresAt,
}: GuardianVerificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your email to continue an ARTIS registration</Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={academyNameStyle}>ARTIS SOCCER ACADEMY</Text>
            <Heading as="h1" style={headingStyle}>
              Verify your family email
            </Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={paragraphStyle}>Hello {guardianName},</Text>

            <Text style={paragraphStyle}>
              We received a request to use this email address for another ARTIS
              Soccer Academy player registration. Please verify that you control
              this inbox before continuing.
            </Text>

            <Section style={buttonSectionStyle}>
              <Button href={verificationUrl} style={buttonStyle}>
                Verify email and continue
              </Button>
            </Section>

            <Text style={expiryStyle}>
              This private link expires at {expiresAt} and can only be used
              once.
            </Text>

            <Hr style={dividerStyle} />

            <Text style={smallTextStyle}>
              If the button does not work, copy and paste this address into your
              browser:
            </Text>

            <Text style={linkContainerStyle}>
              <Link href={verificationUrl} style={linkStyle}>
                {verificationUrl}
              </Link>
            </Text>

            <Text style={smallTextStyle}>
              If you did not request this email, you can safely ignore it. No
              registration will be created and no existing family information
              will be changed.
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

export default GuardianVerificationEmail;

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

const buttonSectionStyle: CSSProperties = {
  margin: "28px 0 20px",
  textAlign: "center",
};

const buttonStyle: CSSProperties = {
  backgroundColor: "#b4232d",
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: "20px",
  padding: "15px 24px",
  textDecoration: "none",
};

const expiryStyle: CSSProperties = {
  backgroundColor: "#f5ecd1",
  borderLeft: "4px solid #d3a62c",
  color: "#0b1f33",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 24px",
  padding: "12px 14px",
};

const dividerStyle: CSSProperties = {
  borderColor: "#dce1e5",
  margin: "24px 0",
};

const smallTextStyle: CSSProperties = {
  color: "#5e6874",
  fontSize: "13px",
  lineHeight: "21px",
  margin: "0 0 12px",
};

const linkContainerStyle: CSSProperties = {
  fontSize: "12px",
  lineHeight: "19px",
  margin: "0 0 22px",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const linkStyle: CSSProperties = {
  color: "#217a57",
  textDecoration: "underline",
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
