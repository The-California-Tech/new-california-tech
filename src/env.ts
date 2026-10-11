import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Server-only environment, read at runtime and exposed via `$app/env/private`.
 * Values come from .env locally and from the Vercel project in production; see
 * .env.example. The scripts in scripts/ read process.env directly and are not
 * declared here (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
 *
 * Every one is deliberately optional. Kit validates declared variables when
 * the app starts, and a required one that is missing takes the WHOLE site
 * down. These are read lazily instead -- symbiont's requireEnvVar, the mailer's
 * own check -- so a missing secret only breaks the endpoint that needs it, and
 * CI can build with none of them set.
 */
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
  NOTION_TOKEN: {
    schema: optional,
    description: 'Notion integration token (Markdown Export); connected to all three synced databases.',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    schema: optional,
    description: 'Supabase service_role key: sync writes, submissions, media uploads. Never client-side.',
  },
  NOTION_WEBHOOK_SECRET: {
    schema: optional,
    description: 'x-symbiont-webhook-secret sent by the Notion automations and the Manual Sync button.',
  },
  CRON_SECRET: {
    schema: optional,
    description: 'Bearer token for GET /api/sync (the Vercel cron sends it automatically).',
  },
  SUBMISSION_GMAIL_APP_PASSWORD: {
    schema: optional,
    description: 'Gmail app password for caltechnewsroom@gmail.com, which sends /submit emails.',
  },
  LOG_LEVEL: {
    schema: optional,
    description: "symbiont's log level (pino); defaults to info.",
  },
});
