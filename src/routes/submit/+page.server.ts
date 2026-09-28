import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { allowSubmission, createSubmission } from '$lib/server/submission.js';
import { SUPABASE_URL } from '$lib/symbiont.js';
import {
  HONEYPOT_FIELD,
  mediaPublicUrlPrefix,
  validateSubmission,
  type SubmissionField,
} from '$lib/utils/submission.js';

// A page with form actions cannot be prerendered, and the root layout
// prerenders by default.
export const prerender = false;

const FIELDS: SubmissionField[] = ['name', 'email', 'title', 'category', 'body'];

type FormErrors = Partial<Record<SubmissionField | 'form', string>>;

export const actions: Actions = {
  default: async ({ request, getClientAddress }) => {
    const form = await request.formData();

    // Tripped: look successful, write nothing. Telling a bot it failed only
    // teaches it which field to leave empty.
    if (String(form.get(HONEYPOT_FIELD) ?? '').trim()) {
      return { success: true as const, reference: null };
    }

    const raw = Object.fromEntries(FIELDS.map((key) => [key, form.get(key) ?? '']));
    // Sent back on failure so a reader without JavaScript does not lose the
    // piece they typed; with JavaScript, the editor keeps its own state.
    const values = Object.fromEntries(FIELDS.map((key) => [key, String(raw[key])]));

    // Only images the editor uploaded to our bucket survive; see
    // keepOnlyHostedImages for why that is enforced here and not trusted.
    const result = validateSubmission(raw, { imageUrlPrefix: mediaPublicUrlPrefix(SUPABASE_URL) });
    if (!result.ok) {
      return fail(400, { errors: result.errors as FormErrors, values });
    }

    // After validation, so fixing a typo does not spend an attempt.
    if (!allowSubmission(getClientAddress())) {
      const errors: FormErrors = {
        form: 'You have sent several pieces in the last hour. Please try again later, or email tech@caltech.edu.',
      };
      return fail(429, { errors, values });
    }

    try {
      const created = await createSubmission(result.value);
      console.info('[submit] created', { pageId: created.pageId, reference: created.reference });
      return { success: true as const, reference: created.reference };
    } catch (error) {
      // Logged without the submission itself: it holds a name and an email.
      console.error('[submit] notion_create_failed', error instanceof Error ? error.message : error);
      const errors: FormErrors = {
        form: 'Something went wrong on our end and your piece was not sent. Your draft is saved in this browser — please try again, or email tech@caltech.edu.',
      };
      return fail(502, { errors, values });
    }
  },
};
