import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendQuoteEmailOptions {
  toEmail: string;
  subject: string;
  message: string;
  pdfBase64: string;
  quoteNumber: string;
  customerName: string;
}

export async function sendQuoteEmail(opts: SendQuoteEmailOptions): Promise<void> {
  const client = getClient();

  const pdfBuffer = Buffer.from(opts.pdfBase64, "base64");

  const { error } = await client.emails.send({
    from: fromAddress,
    to: [opts.toEmail],
    subject: opts.subject,
    text: opts.message,
    attachments: [
      {
        filename: `${opts.quoteNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export function isEmailConfigured(): boolean {
  return !!apiKey;
}
