let _resend = null;

async function getResend() {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = await import('resend');
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = 'Epiphany <noreply@epiphany.heyitsmejosh.com>';

export async function sendEmail({ to, subject, html }) {
  const resend = await getResend();
  if (!resend) {
    console.warn('[EMAIL] No RESEND_API_KEY configured, skipping email to', to);
    return null;
  }
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) throw new Error(error.message);
  return data;
}
