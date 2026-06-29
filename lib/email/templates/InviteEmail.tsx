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

export function InviteEmail({
  inviteUrl,
  treeName,
  inviterName,
}: {
  inviteUrl: string;
  treeName: string;
  inviterName: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{inviterName} invited you to join {treeName} on FamLine</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>FamLine</Text>
          <Text style={paragraph}>
            <strong>{inviterName}</strong> has invited you to join their family
            tree <strong>&ldquo;{treeName}&rdquo;</strong> on FamLine.
          </Text>
          <Section style={btnSection}>
            <Button href={inviteUrl} style={button}>
              Accept invitation
            </Button>
          </Section>
          <Text style={hint}>
            This invitation expires in 7 days. If you don&apos;t have a FamLine
            account yet, you&apos;ll be prompted to create one when you click the
            link above.
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
