/**
 * Email after a /submit submission: a confirmation to the submitter, and a
 * notification to the editors.
 *
 * Sent through Gmail SMTP with an app password, from the newsroom's Gmail
 * account (SENDER), to the editors at techConfig.email. Not a transactional service (Resend, Postmark...), because those
 * need DNS control of the sending domain, and the paper does not control
 * caltech.edu's. Not the Gmail API, because an OAuth app in testing mode gets
 * refresh tokens that expire after seven days: mail would stop a week after
 * setup with nothing to say why.
 *
 * NEVER FAILS A SUBMISSION. This runs after the Notion page exists, so the
 * piece is safe whatever happens here. Every error is logged and swallowed, and
 * the whole send is bounded by a timeout, so a slow SMTP server cannot hold the
 * form response hostage. Same rule as the sync-status note: reporting must
 * never become the failure.
 */
import { env } from '$env/dynamic/private';
import { techConfig } from '$config/tech';
import type { Transporter } from 'nodemailer';
import type { SubmissionInput } from '$lib/utils/submission.js';
import type { CreatedSubmission } from '$lib/server/submission.js';

/**
 * Overall cap on sending, in ms. Generous enough for two messages over one
 * SMTP connection; short enough that the submitter is not left watching a
 * spinner after their piece has already been saved.
 */
const SEND_BUDGET_MS = 8_000;

/**
 * The account the mail is sent from. In code, not the environment: it is not a
 * secret (it is in the From line of every message), and changing it means
 * generating a new app password for the new account anyway.
 */
const SENDER = 'caltechnewsroom@gmail.com';

interface MailConfig {
  user: string;
  appPassword: string;
  /** Notifications go here, and replies to confirmations come back here. */
  editors: string;
}

/**
 * Only the app password comes from the environment. Unset in CI and anywhere
 * that should not send mail, in which case sending is skipped with one warning.
 */
function mailConfig(): MailConfig | null {
  const appPassword = env.SUBMISSION_GMAIL_APP_PASSWORD;
  if (!appPassword) return null;
  return { user: SENDER, appPassword, editors: techConfig.email };
}

let transporter: Transporter | null = null;

async function getTransporter(config: MailConfig): Promise<Transporter> {
  if (transporter) return transporter;
  // Lazy, so routes that never send mail never load it.
  const { createTransport } = await import('nodemailer');
  transporter = createTransport({
    service: 'gmail',
    auth: { user: config.user, pass: config.appPassword },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 7_000,
  });
  return transporter;
}

/**
 * The submitter's copy.
 *
 * FIXED WORDING ON PURPOSE. The form accepts any caltech.edu address, so
 * anything typed into it would be text our account delivers to an address of
 * the sender's choosing: put the title or body in here and the form becomes a
 * way to send arbitrary text to any Caltech inbox from the paper -- phishing
 * that looks like it came from the Tech. The reference number is ours, so it
 * is the one specific thing this message carries. The editors' copy, which
 * goes only to the paper, can carry the details.
 */
function confirmationText(reference: string | null): string {
  const ref = reference ? `Your reference is ${reference}. ` : '';
  return [
    'Thank you for writing for The California Tech.',
    '',
    `We have received your submission. ${ref}The editors read every piece and will be in touch.`,
    '',
    'Nothing is published without an editor’s review. To follow up, reply to this email; it reaches the editors.',
    '',
    '— The California Tech',
  ].join('\n');
}

function notificationText(input: SubmissionInput, created: CreatedSubmission): string {
  return [
    `New web submission${created.reference ? ` ${created.reference}` : ''}.`,
    '',
    `Title:    ${input.title}`,
    `From:     ${input.name} <${input.email}>`,
    `Category: ${input.category ?? 'not chosen'}`,
    `Length:   ${input.body.trim().split(/\s+/).length} words`,
    '',
    created.notionUrl ? `In Notion: ${created.notionUrl}` : 'Find it in tech-article-staging under "web submission".',
    '',
    'It is tagged No Sync, so it will not reach the site until an editor removes that tag.',
    'Replying to this email replies to the submitter.',
  ].join('\n');
}

/**
 * Resolves to whether the submitter's confirmation was accepted for delivery,
 * so the page only says "we've emailed you" when that is true. Never rejects.
 */
export async function sendSubmissionEmails(input: SubmissionInput, created: CreatedSubmission): Promise<boolean> {
  const config = mailConfig();
  if (!config) {
    console.warn('[submit] mail_skipped: SUBMISSION_GMAIL_APP_PASSWORD is not set');
    return false;
  }

  const send = async (): Promise<boolean> => {
    const mailer = await getTransporter(config);
    // Gmail rewrites any other From to the account's own address, so say so.
    const from = { name: 'The California Tech', address: config.user };
    const results = await Promise.allSettled([
      mailer.sendMail({
        from,
        to: input.email,
        replyTo: config.editors,
        subject: `We received your submission${created.reference ? ` (${created.reference})` : ''}`,
        text: confirmationText(created.reference),
      }),
      mailer.sendMail({
        from,
        to: config.editors,
        replyTo: { name: input.name, address: input.email },
        // The title is the submitter's text, but this goes only to the paper,
        // and validateSubmission has already collapsed it to one line, so it
        // cannot smuggle a header.
        subject: `[Submission] ${input.title}`,
        text: notificationText(input, created),
      }),
    ]);
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const which = i === 0 ? 'confirmation' : 'notification';
        // The reason only -- not the addresses or the text.
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.error(`[submit] mail_failed ${which}`, { pageId: created.pageId, reason });
      }
    });
    return results[0].status === 'fulfilled';
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => (timer = setTimeout(() => resolve('timeout'), SEND_BUDGET_MS)));
  try {
    const outcome = await Promise.race([send(), timeout]);
    if (outcome === 'timeout') {
      // It may still arrive; but the page cannot say so, so it says nothing.
      console.error('[submit] mail_timeout', { pageId: created.pageId });
      return false;
    }
    return outcome;
  } catch (error) {
    console.error('[submit] mail_failed', {
      pageId: created.pageId,
      reason: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
