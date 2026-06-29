import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function PasswordResetEmail({ url }: { url: string }) {
  return (
    <Html>
      <Head />
      <Preview>Reset your FamLine password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>FamLine</Text>
          <Text style={paragraph}>
            We received a request to reset your password. Click the button below
            to choose a new one.
          </Text>
          <Section style={btnSection}>
            <Button href={url} style={button}>
              Reset password
            </Button>
          </Section>
          <Text style={hint}>
            This link expires in 1 hour. If you didn&apos;t request a password
            reset, you can safely ignore this email — your password won&apos;t
            change.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>FamLine · Family tree builder</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = { backgroundColor: "#f6f6f6", fontFamily: "sans-serif" };
const container = {
  margin: "40px auto",
  padding: "32px",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  maxWidth: "480px",
};
const heading = { fontSize: "24px", fontWeight: "700", color: "#111827", margin: "0 0 16px" };
const paragraph = { fontSize: "15px", lineHeight: "1.6", color: "#374151" };
const btnSection = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#111827",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  fontSize: "15px",
  fontWeight: "600",
  textDecoration: "none",
};
const hint = { fontSize: "13px", color: "#6b7280" };
const hr = { borderColor: "#e5e7eb", margin: "24px 0" };
const footer = { fontSize: "12px", color: "#9ca3af", textAlign: "center" as const };
