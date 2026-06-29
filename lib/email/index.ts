import { render } from "react-email";
import { sendRawEmail } from "./_provider";
import { VerificationEmail } from "./templates/VerificationEmail";
import { PasswordResetEmail } from "./templates/PasswordResetEmail";
import { InviteEmail } from "./templates/InviteEmail";

export async function sendVerificationEmail(
  to: string,
  url: string,
): Promise<void> {
  const html = await render(VerificationEmail({ url }));
  const text = await render(VerificationEmail({ url }), { plainText: true });
  await sendRawEmail({
    to,
    subject: "Verify your FamLine email",
    html,
    text,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  url: string,
): Promise<void> {
  const html = await render(PasswordResetEmail({ url }));
  const text = await render(PasswordResetEmail({ url }), { plainText: true });
  await sendRawEmail({
    to,
    subject: "Reset your FamLine password",
    html,
    text,
  });
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  treeName: string,
  inviterName: string,
): Promise<void> {
  const props = { inviteUrl, treeName, inviterName };
  const html = await render(InviteEmail(props));
  const text = await render(InviteEmail(props), { plainText: true });
  await sendRawEmail({
    to,
    subject: `${inviterName} invited you to join ${treeName} on FamLine`,
    html,
    text,
  });
}
