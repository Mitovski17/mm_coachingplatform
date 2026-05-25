import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY?.trim())
}

const FROM = 'noreply@mitovski.co'
const REPLY_TO = 'martinmitovski17@gmail.com'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendInviteEmail({
  to,
  inviteUrl,
  coachName,
}: {
  to: string
  inviteUrl: string
  coachName: string
}) {
  return getResend().emails.send({
    from: FROM,
    to,
    subject: `${coachName} invited you to join their coaching platform`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
                <tr>
                  <td style="padding-bottom:32px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">coaching<span style="color:#7c6af0;">platform</span></span>
                  </td>
                </tr>
                <tr>
                  <td style="background:#141414;border:1px solid #222;border-radius:16px;padding:36px;">
                    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;">You've been invited</h1>
                    <p style="margin:0 0 24px;font-size:15px;color:#888;line-height:1.6;">
                      <strong style="color:#ccc;">${coachName}</strong> has invited you to join their coaching platform. Click below to create your account and get started.
                    </p>
                    <a
                      href="${inviteUrl}"
                      style="display:inline-block;padding:14px 28px;background:#7c6af0;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;"
                    >
                      Accept Invite
                    </a>
                    <p style="margin:28px 0 0;font-size:12px;color:#555;line-height:1.6;">
                      Or copy this link into your browser:<br />
                      <span style="color:#7c6af0;word-break:break-all;">${inviteUrl}</span>
                    </p>
                    <hr style="margin:28px 0;border:none;border-top:1px solid #222;" />
                    <p style="margin:0;font-size:12px;color:#444;">
                      This invite expires in 7 days. If you weren't expecting this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  })
}

const REMINDER_CONFIG: Record<number, { subject: string; headline: string; body: string }> = {
  12: {
    subject: '📋 Your weekly check-in is ready',
    headline: 'Time for your weekly check-in',
    body: 'Your coach is waiting for your update. It only takes a few minutes — log how your week went and keep your progress on track.',
  },
  18: {
    subject: '🔔 Reminder: weekly check-in still pending',
    headline: 'Still waiting on your check-in',
    body: "You haven't submitted your weekly check-in yet. Your coach reviews these every week — don't miss out on the feedback loop.",
  },
  24: {
    subject: '⚠️ Your check-in is overdue',
    headline: 'Check-in overdue — 24 hours',
    body: "It's been a full day since your weekly check-in opened. Submit now so your coach can review your progress and keep your plan on track.",
  },
  36: {
    subject: '🚨 Final reminder: weekly check-in',
    headline: 'Last chance — check-in closing soon',
    body: "This is your final reminder. Your coach can't review your week without your check-in. Take 5 minutes now to complete it.",
  },
}

export async function sendCheckinReminderEmail({
  to,
  clientName,
  hoursLate,
}: {
  to: string
  clientName: string
  hoursLate: number
}) {
  const config = REMINDER_CONFIG[hoursLate] ?? REMINDER_CONFIG[12]
  const checkinUrl = `${APP_URL}/check-in`

  return getResend().emails.send({
    from: FROM,
    to,
    subject: config.subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
                <tr>
                  <td style="padding-bottom:32px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">coaching<span style="color:#7c6af0;">platform</span></span>
                  </td>
                </tr>
                <tr>
                  <td style="background:#141414;border:1px solid #222;border-radius:16px;padding:36px;">
                    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#ffffff;">${config.headline}</h1>
                    <p style="margin:0 0 8px;font-size:15px;color:#888;">Hi ${clientName},</p>
                    <p style="margin:0 0 28px;font-size:15px;color:#888;line-height:1.6;">${config.body}</p>
                    <a
                      href="${checkinUrl}"
                      style="display:inline-block;padding:14px 28px;background:#7c6af0;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;"
                    >
                      Complete Check-In
                    </a>
                    <hr style="margin:28px 0;border:none;border-top:1px solid #222;" />
                    <p style="margin:0;font-size:12px;color:#444;">
                      You're receiving this because your coach has check-in reminders enabled. Log in to adjust your notification preferences.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  })
}
