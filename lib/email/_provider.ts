import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM =
  process.env.RESEND_FROM ?? "FamLine <onboarding@resend.dev>";

export async function sendRawEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
