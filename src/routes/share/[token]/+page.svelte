<script lang="ts">
  import { enhance } from '$app/forms';
  import { beforeNavigate } from '$app/navigation';
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { ActionData, PageData } from './$types';
  import '$lib/styles/prose.scss';
  import SubmissionEditor from '$lib/components/submit/SubmissionEditor.svelte';
  import { techConfig } from '$config/tech';
  import { SUBMISSION_LIMITS } from '$lib/utils/submission';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // What the server last confirmed. Read once from the load; after that it
  // moves only when a save succeeds.
  let saved = $state(untrack(() => ({ title: data.title, body: data.body })));
  let title = $state(untrack(() => data.title));
  let body = $state(untrack(() => data.body));
  let submitting = $state(false);
  let imagesBusy = $state(false);
  let savedAt = $state<string | null>(null);

  const errors = $derived<Record<string, string | undefined>>(form && 'errors' in form ? (form.errors ?? {}) : {});

  // The editor serialises its own markdown, which can differ trivially from
  // what was stored (a trailing newline), so compare trimmed.
  const dirty = $derived(title.trim() !== saved.title.trim() || body.trim() !== saved.body.trim());

  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

  beforeNavigate(({ cancel, type }) => {
    if (!dirty || submitting) return;
    // 'leave' is closing the tab or going to another site: the browser's own
    // prompt handles that (see onbeforeunload below), so only intercept here.
    if (type === 'leave') return;
    if (!confirm('You have changes that are not saved. Leave anyway?')) cancel();
  });

  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (dirty && !submitting) event.preventDefault();
  }

  const inputClass =
    'w-full px-3 py-2 border-2 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--qwer-link-color)]';
</script>

<svelte:window onbeforeunload={warnBeforeUnload} />

<svelte:head>
  <title>{data.title} | The California Tech</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="max-w-3xl mx-auto px-4 py-8" in:fade={{ duration: 300, delay: 300 }}>
  {#if data.editable}
    <header class="mb-6 pb-4 border-b-2 border-black dark:border-white">
      <h1 class="text-3xl font-bold mb-2">Your piece</h1>
      <p class="opacity-80">
        You can keep working on this until the editors take it over. Saved changes go straight to them. Anyone with this
        page's address can edit it, so keep the link to yourself.
      </p>
    </header>

    <form
      method="POST"
      class="flex flex-col gap-6"
      aria-busy={submitting}
      use:enhance={() => {
        submitting = true;
        const sent = { title, body };
        return async ({ result, update }) => {
          submitting = false;
          if (result.type === 'success') {
            saved = sent;
            savedAt = timeFormat.format(new Date());
          }
          await update({ reset: false });
        };
      }}>
      {#if errors.form}
        <p class="p-4 border-2 border-red-600 rounded-lg" role="alert">{errors.form}</p>
      {/if}

      <div>
        <label for="share-title" class="block font-semibold mb-1">Title</label>
        <input
          id="share-title"
          name="title"
          class="{inputClass} {errors.title ? 'border-red-600' : 'border-black dark:border-white'}"
          maxlength={SUBMISSION_LIMITS.title}
          required
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? 'share-title-error' : undefined}
          bind:value={title} />
        {#if errors.title}<p id="share-title-error" class="mt-1 text-sm text-red-600">{errors.title}</p>{/if}
      </div>

      <div>
        <label for="share-body" class="block font-semibold mb-1">Your piece</label>
        <SubmissionEditor
          name="body"
          id="share-body"
          bind:markdown={body}
          bind:busy={imagesBusy}
          restoreDraft={false}
          invalid={!!errors.body}
          describedBy={errors.body ? 'share-body-error' : undefined} />
        {#if errors.body}<p id="share-body-error" class="mt-1 text-sm text-red-600">{errors.body}</p>{/if}
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          class="px-6 py-2 border-2 border-black dark:border-white rounded-lg font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-50 disabled:cursor-wait"
          disabled={submitting || imagesBusy || !dirty}>
          {submitting ? 'Saving...' : imagesBusy ? 'Waiting for images...' : 'Save changes'}
        </button>
        <p class="text-sm opacity-70" aria-live="polite">
          {#if dirty}
            Unsaved changes.
          {:else if savedAt}
            Saved at {savedAt}.
          {:else}
            Everything is saved.
          {/if}
        </p>
      </div>
    </form>
  {:else}
    <p class="mb-6 p-4 border-2 border-black/40 dark:border-white/40 rounded-lg">
      {#if data.locked}
        The editors have taken this piece over, so it can no longer be edited here. This is the version they have. Write
        to <a class="link" href="mailto:{techConfig.email}">{techConfig.email}</a>
        with any changes you would still like to make.
      {:else}
        A read-only view of a piece submitted to the <em>Tech</em>
        .
      {/if}
    </p>
    <article>
      <h1 class="text-4xl font-bold mb-6">{data.title}</h1>
      <div class="prose prose-slate dark:prose-invert max-w-none">{@html data.html}</div>
    </article>
  {/if}
</main>
