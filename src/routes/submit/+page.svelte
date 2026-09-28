<script lang="ts">
  import { enhance } from '$app/forms';
  import { onMount, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { ActionData } from './$types';
  import '$lib/styles/prose.scss';
  import SubmissionEditor from '$lib/components/submit/SubmissionEditor.svelte';
  import { clearDraft, loadDraft, saveDraft } from '$lib/components/submit/draft';
  import { HONEYPOT_FIELD, SUBMISSION_CATEGORIES, SUBMISSION_LIMITS } from '$lib/utils/submission';

  let { form }: { form: ActionData } = $props();

  const sent = $derived(form?.success === true);
  const errors = $derived<Record<string, string | undefined>>(form && 'errors' in form ? (form.errors ?? {}) : {});

  // What the server sent back after a failed no-JS post. Read once: after
  // that the inputs own their state, and a later failure (with JS) must not
  // overwrite what the reader has typed since.
  const returned = untrack(() => (form && 'values' in form ? form.values : undefined));

  let name = $state(returned?.name ?? '');
  let email = $state(returned?.email ?? '');
  let title = $state(returned?.title ?? '');
  let category = $state(returned?.category ?? '');
  let body = $state(returned?.body ?? '');
  let submitting = $state(false);
  let imagesBusy = $state(false);
  let draftLoaded = $state(false);

  const wordCount = $derived(body.trim() ? body.trim().split(/\s+/).length : 0);

  onMount(() => {
    if (untrack(() => sent)) {
      clearDraft();
      return;
    }
    const draft = loadDraft();
    if (!title && draft.title) title = draft.title;
    if (!category && draft.category) category = draft.category;
    draftLoaded = true;
  });

  // Debounced: getMarkdown already runs per keystroke, and re-serialising a
  // long piece into localStorage on every one of them is noticeable.
  $effect(() => {
    if (!draftLoaded || sent) return;
    const draft = { title, category, body };
    const timer = setTimeout(() => saveDraft(draft), 400);
    return () => clearTimeout(timer);
  });

  const inputClass =
    'w-full px-3 py-2 border-2 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--qwer-link-color)]';
  const borderFor = (field: string) => (errors[field] ? 'border-red-600' : 'border-black dark:border-white');
</script>

<svelte:head>
  <title>Submit | The California Tech</title>
  <meta
    name="description"
    content="Submit news, opinion, letters and features to The California Tech, Caltech's student newspaper." />
</svelte:head>

<main class="max-w-3xl mx-auto px-4 py-8" in:fade={{ duration: 300, delay: 300 }} out:fade={{ duration: 300 }}>
  <header class="mb-8 pb-4 border-b-2 border-black dark:border-white">
    <h1 class="text-4xl font-bold mb-2">
      Submit to the <em>Tech</em>
    </h1>
  </header>

  {#if sent}
    <section class="p-6 border-2 border-black dark:border-white rounded-lg" role="status" in:fade>
      <h2 class="text-2xl font-bold mb-2">Thank you — your piece is with the editors.</h2>
      {#if form?.success && form.reference}
        <p class="mb-2">
          Your reference is <strong class="font-mono">{form.reference}</strong>
          — quote it if you write to us about this piece.
        </p>
      {/if}
      <p class="mb-4 opacity-80">
        Nothing is published without an editor's review. If you have questions or follow-ups, send them to
        <a class="link" href="mailto:tech@caltech.edu">tech@caltech.edu</a>
        with the title of your piece.
      </p>
      <a href="/submit" class="link" data-sveltekit-reload>Submit another piece</a>
    </section>
  {:else}
    <form
      method="POST"
      class="flex flex-col gap-6"
      aria-busy={submitting}
      use:enhance={() => {
        submitting = true;
        return async ({ result, update }) => {
          submitting = false;
          if (result.type === 'success') clearDraft();
          await update({ reset: false });
          if (result.type !== 'redirect') window.scrollTo({ top: 0, behavior: 'smooth' });
        };
      }}>
      {#if errors.form}
        <p class="p-4 border-2 border-red-600 rounded-lg" role="alert">{errors.form}</p>
      {:else if Object.keys(errors).length}
        <p class="p-4 border-2 border-red-600 rounded-lg" role="alert">Please fix the fields marked below.</p>
      {/if}

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label for="submit-name" class="block font-semibold mb-1">Your name</label>
          <input
            id="submit-name"
            name="name"
            class="{inputClass} {borderFor('name')}"
            autocomplete="name"
            maxlength={SUBMISSION_LIMITS.name}
            required
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'submit-name-error' : undefined}
            bind:value={name} />
          {#if errors.name}<p id="submit-name-error" class="mt-1 text-sm text-red-600">{errors.name}</p>{/if}
        </div>

        <div>
          <label for="submit-email" class="block font-semibold mb-1">Your Caltech email</label>
          <input
            id="submit-email"
            name="email"
            type="email"
            class="{inputClass} {borderFor('email')}"
            autocomplete="email"
            maxlength={SUBMISSION_LIMITS.email}
            placeholder="you@caltech.edu"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'submit-email-error' : 'submit-email-hint'}
            bind:value={email} />
          {#if errors.email}
            <p id="submit-email-error" class="mt-1 text-sm text-red-600">{errors.email}</p>
          {:else}
            <p id="submit-email-hint" class="mt-1 text-sm opacity-70">Only the editors see this.</p>
          {/if}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-[1fr_14rem] gap-6">
        <div>
          <label for="submit-title" class="block font-semibold mb-1">Title</label>
          <input
            id="submit-title"
            name="title"
            class="{inputClass} {borderFor('title')}"
            maxlength={SUBMISSION_LIMITS.title}
            required
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? 'submit-title-error' : undefined}
            bind:value={title} />
          {#if errors.title}<p id="submit-title-error" class="mt-1 text-sm text-red-600">{errors.title}</p>{/if}
        </div>

        <div>
          <label for="submit-category" class="block font-semibold mb-1">Category</label>
          <select
            id="submit-category"
            name="category"
            class="{inputClass} {borderFor('category')} dark:bg-black"
            aria-invalid={errors.category ? true : undefined}
            aria-describedby={errors.category ? 'submit-category-error' : undefined}
            bind:value={category}>
            <option value="">Not sure</option>
            {#each SUBMISSION_CATEGORIES as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>
          {#if errors.category}
            <p id="submit-category-error" class="mt-1 text-sm text-red-600">{errors.category}</p>
          {/if}
        </div>
      </div>

      <div>
        <div class="flex items-baseline justify-between mb-1">
          <label for="submit-body" class="font-semibold">Your piece</label>
          {#if wordCount}<span class="text-sm opacity-70" aria-live="polite">{wordCount} words</span>{/if}
        </div>
        <p id="submit-body-hint" class="text-sm opacity-70 mb-2">
          Write here, or paste from Google Docs or Word — formatting carries over. Your draft is saved in this browser
          until you send it.
        </p>
        <SubmissionEditor
          name="body"
          id="submit-body"
          bind:markdown={body}
          bind:busy={imagesBusy}
          placeholder="Start writing..."
          invalid={!!errors.body}
          describedBy={errors.body ? 'submit-body-error' : 'submit-body-hint'} />
        {#if errors.body}<p id="submit-body-error" class="mt-1 text-sm text-red-600">{errors.body}</p>{/if}
      </div>

      <!-- Honeypot. Off-screen rather than display:none, which some bots
           check for; hidden from assistive tech and the tab order. -->
      <div class="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
        <label for="submit-hp">Leave this field empty</label>
        <input id="submit-hp" name={HONEYPOT_FIELD} tabindex="-1" autocomplete="off" />
      </div>

      <div class="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          class="px-6 py-2 border-2 border-black dark:border-white rounded-lg font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors disabled:opacity-50 disabled:cursor-wait"
          disabled={submitting || imagesBusy}>
          {submitting ? 'Sending...' : imagesBusy ? 'Waiting for images...' : 'Submit'}
        </button>
        <p class="text-sm opacity-70">
          Problems? Email
          <a class="link" href="mailto:tech@caltech.edu">tech@caltech.edu</a>
        </p>
      </div>
    </form>
  {/if}
</main>
