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
 * Something that would make a title a link: a scheme, `www.`, a bare domain
 * with a common TLD, or an email address. Deliberately broad -- a false
 * positive only costs the title its place in one email.
 */
const LINKISH =
  /(?:[a-z][a-z0-9+.-]*:\/\/|www\.|@|\b[a-z0-9-]+\.(?:com|net|org|io|co|edu|gov|ly|me|app|dev|xyz|info|biz|link|site|online|top|ru|cn)\b)/i;

/**
 * The submitter's title, if it is safe to repeat back to them.
 *
 * The form accepts any caltech.edu address, so whatever this email repeats is
 * text the paper's account delivers to an inbox of the submitter's choosing.
 * The body is never repeated. The title is short, one line (validateSubmission
 * collapses it) and rate-limited, so the realistic abuse is a link-bearing
 * title used as phishing that appears to come from the Tech. A title that looks
 * like it carries a link or an address is therefore left out; everything else
 * goes through, quoted, so it reads as theirs rather than as our words.
 */
export function confirmableTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed || LINKISH.test(trimmed)) return null;
  return trimmed;
}

/**
 * The submitter's copy: fixed wording, the reference number (ours), and the
 * title when confirmableTitle allows it. The editors' copy, which goes only to
 * the paper, carries the rest.
 */
function confirmationText(reference: string | null, title: string | null, editUrl: string | null): string {
  const what = title ? `your submission, \u201c${title}\u201d` : 'your submission';
  const ref = reference ? ` Your reference is ${reference}.` : '';
  // The edit link is ours, not the submitter's text, so it is safe to send --
  // and it is the reason to keep this email: it is the only way back in.
  const edit = editUrl
    ? [
        '',
        'You can keep working on it until the editors take it over:',
        editUrl,
        'Anyone with this link can edit your piece, so keep it to yourself.',
      ]
    : [];
  return [
    'Thank you for writing for The California Tech.',
    '',
    `We have received ${what}.${ref} The editors read every piece and will be in touch.`,
    ...edit,
    '',
    'Nothing is published without an editor\u2019s review. To follow up, reply to this email; it reaches the editors.',
    '',
    '\u2014 The California Tech',
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
        text: confirmationText(created.reference, confirmableTitle(input.title), created.editUrl),
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
