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

type RegistrationAdminUpdateEmailBaseProps = {
  guardianName: string;
  playerName: string;
  trainingGroupName: string;
  registrationId: string;
};

type CancelledRegistrationEmailProps = RegistrationAdminUpdateEmailBaseProps & {
  updateType: "cancelled";
};

type RescheduledRegistrationEmailProps =
  RegistrationAdminUpdateEmailBaseProps & {
    updateType: "rescheduled";
    startsOn: string;
    endsOn: string;
  };

export type RegistrationAdminUpdateEmailProps =
  CancelledRegistrationEmailProps | RescheduledRegistrationEmailProps;

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

export function RegistrationAdminUpdateEmail(
  props: RegistrationAdminUpdateEmailProps,
) {
  const registrationWasCancelled = props.updateType === "cancelled";
  const previewText = registrationWasCancelled
    ? `${props.playerName}’s ARTIS registration was cancelled`
    : `${props.playerName}’s ARTIS training dates were updated`;

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>

      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Text style={academyNameStyle}>ARTIS SOCCER ACADEMY</Text>
            <Heading as="h1" style={headingStyle}>
              Registration update
            </Heading>
          </Section>

          <Section style={contentStyle}>
            <Text style={paragraphStyle}>Hello {props.guardianName},</Text>

            <Text style={paragraphStyle}>
              {registrationWasCancelled
                ? `ARTIS Soccer Academy has cancelled ${props.playerName}’s registration.`
                : `ARTIS Soccer Academy has updated ${props.playerName}’s training dates.`}
            </Text>

            <Section
              style={
                registrationWasCancelled
                  ? cancelledStatusSectionStyle
                  : updatedStatusSectionStyle
              }
            >
              <Text style={statusLabelStyle}>REGISTRATION STATUS</Text>
              <Text
                style={
                  registrationWasCancelled
                    ? cancelledStatusValueStyle
                    : updatedStatusValueStyle
                }
              >
                {registrationWasCancelled ? "Cancelled" : "Dates updated"}
              </Text>
            </Section>

            <Heading as="h2" style={detailsHeadingStyle}>
              Registration details
            </Heading>

            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              style={detailsTableStyle}
            >
              <tbody>
                <DetailRow label="Player">{props.playerName}</DetailRow>
                <DetailRow label="Training group">
                  {props.trainingGroupName}
                </DetailRow>
                {props.updateType === "rescheduled" ? (
                  <>
                    <DetailRow label="New starting date">
                      {props.startsOn}
                    </DetailRow>
                    <DetailRow label="New ending date">
                      {props.endsOn}
                    </DetailRow>
                  </>
                ) : null}
                <DetailRow label="Registration number">
                  {props.registrationId}
                </DetailRow>
              </tbody>
            </table>

            <Hr style={dividerStyle} />

            <Text style={smallTextStyle}>
              {registrationWasCancelled
                ? "This registration is no longer scheduled, and the player’s place has been released."
                : "The purchased package length and recorded payment have not changed."}
            </Text>

            <Text style={smallTextStyle}>
              If you believe this update was made in error or have questions,
              reply to this email and ARTIS Soccer Academy will assist you.
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

export default RegistrationAdminUpdateEmail;

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

const statusSectionBaseStyle: CSSProperties = {
  borderLeftWidth: "4px",
  borderLeftStyle: "solid",
  margin: "24px 0 28px",
  padding: "14px 16px",
};

const cancelledStatusSectionStyle: CSSProperties = {
  ...statusSectionBaseStyle,
  backgroundColor: "#fff0f1",
  borderLeftColor: "#b4232d",
};

const updatedStatusSectionStyle: CSSProperties = {
  ...statusSectionBaseStyle,
  backgroundColor: "#edf8f2",
  borderLeftColor: "#217a57",
};

const statusLabelStyle: CSSProperties = {
  color: "#5e6874",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "1px",
  lineHeight: "16px",
  margin: "0 0 3px",
};

const cancelledStatusValueStyle: CSSProperties = {
  color: "#b4232d",
  fontSize: "18px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: 0,
};

const updatedStatusValueStyle: CSSProperties = {
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
  overflowWrap: "anywhere",
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
  margin: "0 0 12px",
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
