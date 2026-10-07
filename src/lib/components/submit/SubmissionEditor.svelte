<!--
  A TipTap editor that submits as an ordinary form field.

  The <textarea> is the real field, always. Before JavaScript loads -- or if it
  never does -- it is visible and a reader can type or paste plain text, which
  is already valid markdown. Once the editor mounts, the textarea is hidden and
  kept in step with the editor's markdown, so the form posts the same way on
  both paths and the action never needs to know which one ran.

  Deliberately narrow schema: paragraphs, H2/H3, emphasis, lists, quotes,
  links, rules, images. Pasting from Google Docs or Word maps onto that schema,
  which is the path most submitters will actually take. No underline --
  markdown has none, so it would arrive in Notion as nothing.

  IMAGES
    Any image whose src is not already in our bucket gets uploaded and its src
    swapped for the hosted URL -- files picked, pasted or dropped, and images
    that came in with pasted HTML alike. One mechanism, driven by scanning the
    document after every change, rather than one per way an image can arrive:
    that is what makes undo/redo, drafts and pastes all come out right. How
    each kind of src is uploaded is in ./images.ts.
-->
<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { loadDraft } from './draft';
  import { ImageRehostError, rehost, releaseStaged, stageFile } from './images';
  import { SUPABASE_URL } from '$lib/symbiont';
  import { mediaPublicUrlPrefix } from '$lib/utils/submission';

  interface Props {
    /** Form field name. */
    name: string;
    id: string;
    /**
     * The field's markdown, both ways: seed it with what a failed no-JS post
     * sent back, and read the editor's current content from it.
     */
    markdown?: string;
    placeholder?: string;
    invalid?: boolean;
    describedBy?: string;
    /** True while any image is still uploading; the piece is not ready to send. */
    busy?: boolean;
    /**
     * Fall back to the /submit draft in localStorage when `markdown` is empty.
     * Off on /share, where the server copy is the piece and a stray /submit
     * draft from the same browser must not leak into someone's article.
     */
    restoreDraft?: boolean;
  }

  let {
    name,
    id,
    markdown = $bindable(''),
    placeholder = '',
    invalid = false,
    describedBy,
    busy = $bindable(false),
    restoreDraft = true,
  }: Props = $props();

  let host = $state<HTMLDivElement>();
  let editor = $state<Editor | null>(null);
  let filePicker = $state<HTMLInputElement>();
  let notice = $state('');

  const HOSTED = mediaPublicUrlPrefix(SUPABASE_URL);
  const BUBBLE_KEY = 'submissionBubble';

  /** Sources being uploaded now, so a scan does not start the same one twice. */
  // Bookkeeping, never rendered; `busy` is the reactive summary of it.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const inFlight = new Set<string>();
  /**
   * Every source already uploaded, and where it went. Undo can put an old
   * src back into the document after its swap; this turns that into an
   * instant re-swap instead of a second upload of a file we have released.
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const hostedFor = new Map<string, string>();

  function eachImage(visit: (src: string, pos: number, attrs: Record<string, unknown>, size: number) => void) {
    editor?.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image' && typeof node.attrs.src === 'string') {
        visit(node.attrs.src, pos, node.attrs, node.nodeSize);
      }
    });
  }

  /** Swap `from` for `to` everywhere, or delete those images if `to` is null. */
  function replaceSource(from: string, to: string | null) {
    if (!editor) return;
    const { tr } = editor.state;
    const hits: Array<{ pos: number; attrs: Record<string, unknown>; size: number }> = [];
    eachImage((src, pos, attrs, size) => {
      if (src === from) hits.push({ pos, attrs, size });
    });
    if (!hits.length) return;
    // Back to front, so deleting one does not shift the positions of the rest.
    for (const hit of hits.reverse()) {
      if (to) tr.setNodeMarkup(hit.pos, undefined, { ...hit.attrs, src: to });
      else tr.delete(hit.pos, hit.pos + hit.size);
    }
    // Not an edit the writer made, so it must not be one they can undo.
    tr.setMeta('addToHistory', false);
    editor.view.dispatch(tr);
  }

  function scanImages() {
    eachImage((src) => {
      if (src.startsWith(HOSTED) || inFlight.has(src)) return;
      const known = hostedFor.get(src);
      if (known) {
        queueMicrotask(() => replaceSource(src, known));
        return;
      }
      void upload(src);
    });
  }

  async function upload(src: string) {
    inFlight.add(src);
    busy = true;
    try {
      const { url } = await rehost(src);
      hostedFor.set(src, url);
      replaceSource(src, url);
    } catch (error) {
      replaceSource(src, null);
      notice = error instanceof ImageRehostError ? error.message : 'An image could not be uploaded. Please try again.';
    } finally {
      inFlight.delete(src);
      releaseStaged(src);
      busy = inFlight.size > 0;
    }
  }

  function imageFiles(list: FileList | null | undefined): File[] {
    return Array.from(list ?? []).filter((file) => file.type.startsWith('image/'));
  }

  /** Put files into the document now, shown from memory; scanImages uploads them. */
  function insertFiles(files: File[], at?: number) {
    if (!editor || !files.length) return;
    notice = '';
    const nodes = files.map((file) => ({ type: 'image', attrs: { src: stageFile(file), alt: '' } }));
    const chain = editor.chain().focus();
    (at === undefined ? chain.insertContent(nodes) : chain.insertContentAt(at, nodes)).run();
  }

  // Bumped on every transaction so the toolbar's active states re-derive;
  // TipTap's editor object is mutable and Svelte cannot see inside it.
  let version = $state(0);
  const active = (nameOrAttrs: string, attrs?: Record<string, unknown>) => {
    void version;
    return editor?.isActive(nameOrAttrs, attrs) ?? false;
  };

  onMount(async () => {
    // Imported here rather than at the top so neither ProseMirror nor TipTap
    // is ever evaluated during SSR, and they stay out of every other route.
    const [{ Editor }, { StarterKit }, { Markdown }, { Placeholder }, { Image }, { BubbleMenu }] = await Promise.all([
      import('@tiptap/core'),
      import('@tiptap/starter-kit'),
      import('@tiptap/markdown'),
      import('@tiptap/extensions'),
      import('@tiptap/extension-image'),
      import('@tiptap/extension-bubble-menu'),
    ]);
    if (!host || !bubble) return;

    // `markdown` already holds whatever was typed into the textarea before we
    // got here, or the server's copy; failing both, the saved draft.
    const start = markdown.trim() || (restoreDraft ? loadDraft().body : '') || '';

    editor = new Editor({
      element: host,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          underline: false,
          codeBlock: false,
          link: {
            openOnClick: false,
            autolink: true,
            protocols: ['http', 'https', 'mailto'],
            defaultProtocol: 'https',
          },
        }),
        Markdown,
        Placeholder.configure({ placeholder }),
        // allowBase64 so Word's inline data: images parse at all; they are
        // uploaded like anything else a moment later.
        Image.configure({ allowBase64: true }).extend({
          // The stock renderer writes alt verbatim, so a `]` or a newline in
          // a description would break the markdown. Titles are dropped: the
          // editor never sets one, and pasted ones are Google's filenames.
          renderMarkdown: (node) => {
            const alt = String(node.attrs?.alt ?? '')
              .replace(/[[\]\n\r]/g, ' ')
              .trim();
            return `![${alt}](${node.attrs?.src ?? ''})`;
          },
        }),
        BubbleMenu.configure({
          pluginKey: BUBBLE_KEY,
          element: bubble,
          options: { placement: 'top', offset: 8, flip: true, shift: { padding: 8 } },
          shouldShow: ({ editor, view, state, from, to, element }) => {
            // Focus inside the bubble counts: that is the link or alt field.
            if (!editor.isEditable || !(view.hasFocus() || element.contains(document.activeElement))) return false;
            if (editor.isActive('image') || editor.isActive('link')) return true;
            return !state.selection.empty && state.doc.textBetween(from, to).trim().length > 0;
          },
        }),
      ],
      content: start,
      contentType: 'markdown',
      editorProps: {
        attributes: {
          id,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Your piece',
          ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          class: 'prose prose-slate dark:prose-invert max-w-none min-h-[24rem] px-4 py-3 focus:outline-none',
        },
        // Files only. Pasted HTML -- including a Doc with images in it -- goes
        // through the default path, and scanImages picks the images up after.
        handlePaste: (_view, event) => {
          const files = imageFiles(event.clipboardData?.files);
          if (!files.length || event.clipboardData?.getData('text/html')) return false;
          insertFiles(files);
          return true;
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            void openLinkEditor();
            return true;
          }
          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          const files = imageFiles(event.dataTransfer?.files);
          if (moved || !files.length) return false;
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          insertFiles(files, at);
          event.preventDefault();
          return true;
        },
      },
      onCreate: ({ editor }) => {
        markdown = editor.getMarkdown();
        // After `editor` is assigned, which scanImages reads.
        queueMicrotask(scanImages);
      },
      onUpdate: ({ editor }) => {
        markdown = editor.getMarkdown();
        scanImages();
      },
      onTransaction: () => {
        version++;
      },
      onSelectionUpdate: ({ editor }) => {
        // Moving elsewhere abandons an unsaved link; it was never applied.
        editingLink = false;
        if (editor.isActive('image')) altDraft = (editor.getAttributes('image').alt as string | undefined) ?? '';
      },
    });
  });

  onDestroy(() => editor?.destroy());

  $effect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    if (invalid) dom.setAttribute('aria-invalid', 'true');
    else dom.removeAttribute('aria-invalid');
  });

  /*
   * THE BUBBLE MENU
   *
   * Formatting, links and image descriptions, next to whatever is selected,
   * instead of window.prompt(). A bubble rather than a right-click menu: it
   * works the same on a phone, where there is no right click, and it leaves
   * the browser's own context menu -- spellcheck suggestions above all -- alone.
   *
   * One element with three modes rather than three menus, so there is only
   * ever one thing floating over the text.
   */
  let bubble = $state<HTMLDivElement>();
  let linkInput = $state<HTMLInputElement>();
  let editingLink = $state(false);
  let linkDraft = $state('');
  let altDraft = $state('');

  /** Ask the bubble to re-measure; its width changes with its mode. */
  function refreshBubble() {
    editor?.view.dispatch(editor.state.tr.setMeta(BUBBLE_KEY, 'updatePosition'));
  }

  const bubbleMode = $derived(active('image') ? 'image' : editingLink ? 'link' : 'format');

  // Its width changes with its mode, and floating-ui measured the old one.
  // Keyed on the derived mode, not on active() directly: active() reads
  // `version`, the refresh is a transaction, and every transaction bumps
  // `version` -- depending on it here would re-run this forever.
  $effect(() => {
    void bubbleMode;
    void tick().then(refreshBubble);
  });

  async function openLinkEditor() {
    if (!editor) return;
    if (editor.state.selection.empty && !editor.isActive('link')) {
      notice = 'Select the words you want to link first.';
      editor.commands.focus();
      return;
    }
    notice = '';
    linkDraft = (editor.getAttributes('link').href as string | undefined) ?? '';
    editingLink = true;
    await tick();
    refreshBubble();
    linkInput?.focus();
    linkInput?.select();
  }

  /**
   * Leave link mode *before* touching the editor. Leaving it unmounts the
   * focused input, and a focused element being removed sends focus to <body>;
   * if the editor were focused first, that removal would then steal focus back
   * from it and the bubble would close under the writer.
   */
  async function leaveLinkMode(then: () => void) {
    editingLink = false;
    await tick();
    then();
  }

  function applyLink() {
    const href = linkDraft.trim();
    void leaveLinkMode(() => {
      const chain = editor?.chain().focus().extendMarkRange('link');
      if (!chain) return;
      if (!href) chain.unsetLink().run();
      else chain.setLink({ href: /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}` }).run();
    });
  }

  function removeLink() {
    void leaveLinkMode(() => editor?.chain().focus().extendMarkRange('link').unsetLink().run());
  }

  function cancelLink() {
    void leaveLinkMode(() => editor?.commands.focus());
  }

  function applyAlt() {
    if (!editor?.isActive('image')) return;
    const alt = altDraft.trim();
    if (alt === ((editor.getAttributes('image').alt as string | undefined) ?? '')) return;
    // No focus(): this also runs on blur, when focus is going somewhere else.
    editor.chain().updateAttributes('image', { alt }).run();
  }

  type Tool = {
    label: string;
    icon?: string;
    text?: string;
    run: () => void;
    isActive?: () => boolean;
    disabled?: () => boolean;
  };

  // Selected-text subset of the toolbar, looked up by label so the two cannot drift.
  const bubbleTools = $derived(
    ['Bold', 'Italic', 'Strikethrough', 'Heading', 'Subheading'].map((label) =>
      tools.flat().find((tool) => tool.label === label)!,
    ),
  );

  const tools: Tool[][] = [
    [
      {
        label: 'Bold',
        icon: 'i-carbon-text-bold',
        run: () => editor?.chain().focus().toggleBold().run(),
        isActive: () => active('bold'),
      },
      {
        label: 'Italic',
        icon: 'i-carbon-text-italic',
        run: () => editor?.chain().focus().toggleItalic().run(),
        isActive: () => active('italic'),
      },
      {
        label: 'Strikethrough',
        icon: 'i-carbon-text-strikethrough',
        run: () => editor?.chain().focus().toggleStrike().run(),
        isActive: () => active('strike'),
      },
    ],
    [
      {
        label: 'Heading',
        text: 'H2',
        run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => active('heading', { level: 2 }),
      },
      {
        label: 'Subheading',
        text: 'H3',
        run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => active('heading', { level: 3 }),
      },
    ],
    [
      {
        label: 'Bulleted list',
        icon: 'i-carbon-list-bulleted',
        run: () => editor?.chain().focus().toggleBulletList().run(),
        isActive: () => active('bulletList'),
      },
      {
        label: 'Numbered list',
        icon: 'i-carbon-list-numbered',
        run: () => editor?.chain().focus().toggleOrderedList().run(),
        isActive: () => active('orderedList'),
      },
      {
        label: 'Quote',
        icon: 'i-carbon-quotes',
        run: () => editor?.chain().focus().toggleBlockquote().run(),
        isActive: () => active('blockquote'),
      },
      { label: 'Link (Ctrl/⌘ K)', icon: 'i-carbon-link', run: openLinkEditor, isActive: () => active('link') },
    ],
    [{ label: 'Add image', icon: 'i-carbon-image', run: () => filePicker?.click() }],
    [
      { label: 'Undo', icon: 'i-carbon-undo', run: () => editor?.chain().focus().undo().run() },
      { label: 'Redo', icon: 'i-carbon-redo', run: () => editor?.chain().focus().redo().run() },
    ],
  ];
</script>

{#snippet toolButton(tool: Tool)}
  {@const pressed = tool.isActive?.()}
  <button
    type="button"
    class="inline-flex items-center justify-center min-w-8 h-8 px-1.5 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
    class:bg-black={pressed}
    class:text-white={pressed}
    class:dark:bg-white={pressed}
    class:dark:text-black={pressed}
    aria-label={tool.label}
    title={tool.label}
    aria-pressed={tool.isActive ? pressed : undefined}
    disabled={tool.disabled?.()}
    onclick={tool.run}>
    {#if tool.icon}<span class="{tool.icon} w-4 h-4" aria-hidden="true"></span>{:else}<span class="text-sm font-bold">
        {tool.text}
      </span>{/if}
  </button>
{/snippet}

<!-- No overflow-hidden here: it would make this box the toolbar's scroll
     container, and position: sticky would then stick to nothing. -->
<div
  class="submission-editor border-2 rounded-lg bg-transparent"
  class:border-black={!invalid}
  class:dark:border-white={!invalid}
  class:border-red-600={invalid}>
  {#if editor}
    <!-- Opaque, because the piece scrolls underneath it. White and black are
         the page colours in each theme (defaultTheme.scss). -->
    <div
      class="sticky top-0 z-10 flex flex-wrap items-center gap-1 px-2 py-1 rounded-t-md bg-white dark:bg-black border-b-2 border-black/20 dark:border-white/20"
      role="toolbar"
      aria-label="Formatting"
      aria-controls={id}>
      {#each tools as group, g (g)}
        {#if g > 0}<span class="w-px h-5 mx-1 bg-black/20 dark:bg-white/20" aria-hidden="true"></span>{/if}
        {#each group as tool (tool.label)}
          {@render toolButton(tool)}
        {/each}
      {/each}
    </div>
  {/if}

  <div bind:this={host}></div>

  <!-- The bubble. Rendered here so it exists before the editor does; the
       BubbleMenu plugin then moves it next to the editor and toggles it. -->
  <div
    bind:this={bubble}
    class="z-20 flex items-center gap-1 p-1 border-2 border-black dark:border-white rounded-lg bg-white dark:bg-black shadow-lg"
    style="visibility: hidden">
    {#if bubbleMode === 'image'}
      <label class="sr-only" for="{id}-alt">Image description</label>
      <input
        id="{id}-alt"
        class="w-64 px-2 py-1 text-sm bg-transparent border border-black/30 dark:border-white/30 rounded focus:outline-none focus:border-current"
        placeholder="Describe this image for screen readers"
        bind:value={altDraft}
        onchange={applyAlt}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyAlt();
            editor?.commands.focus();
          } else if (event.key === 'Escape') {
            editor?.commands.focus();
          }
        }} />
      {@render toolButton({
        label: 'Remove image',
        icon: 'i-carbon-trash-can',
        run: () => editor?.chain().focus().deleteSelection().run(),
      })}
    {:else if bubbleMode === 'link'}
      <label class="sr-only" for="{id}-link">Link address</label>
      <input
        bind:this={linkInput}
        id="{id}-link"
        type="url"
        inputmode="url"
        class="w-64 px-2 py-1 text-sm bg-transparent border border-black/30 dark:border-white/30 rounded focus:outline-none focus:border-current"
        placeholder="Paste a link, then press Enter"
        bind:value={linkDraft}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            applyLink();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelLink();
          }
        }} />
      {@render toolButton({ label: 'Apply link', icon: 'i-carbon-checkmark', run: applyLink })}
      {#if active('link')}
        {@render toolButton({ label: 'Remove link', icon: 'i-carbon-unlink', run: removeLink })}
      {/if}
    {:else}
      {#each bubbleTools as tool (tool.label)}
        {@render toolButton(tool)}
      {/each}
      <span class="w-px h-5 mx-1 bg-black/20 dark:bg-white/20" aria-hidden="true"></span>
      {@render toolButton({
        label: active('link') ? 'Edit link' : 'Add link',
        icon: 'i-carbon-link',
        run: openLinkEditor,
        isActive: () => active('link'),
      })}
      {#if active('link')}
        {@render toolButton({ label: 'Remove link', icon: 'i-carbon-unlink', run: removeLink })}
      {/if}
    {/if}
  </div>

  {#if editor}
    <input
      bind:this={filePicker}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
      multiple
      hidden
      onchange={(event) => {
        insertFiles(imageFiles(event.currentTarget.files));
        event.currentTarget.value = '';
      }} />
    <p class="px-4 pb-2 text-sm" aria-live="polite">
      {#if busy}
        <span class="opacity-70">Uploading images...</span>
      {:else if notice}
        <span class="text-red-600">{notice}</span>
      {/if}
    </p>
  {/if}

  <!-- `required` only while it is the visible input: a hidden required field
       blocks submission with "an invalid form control is not focusable".
       Hidden by class as well as attribute, because a display utility on the
       element beats the UA's [hidden] rule. -->
  <textarea
    bind:value={markdown}
    {name}
    id={editor ? undefined : id}
    hidden={!!editor}
    required={!editor}
    rows="18"
    class="w-full px-4 py-3 bg-transparent font-serif focus:outline-none"
    class:block={!editor}
    class:hidden={!!editor}
    {placeholder}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}>
  </textarea>
</div>

<style>
  .submission-editor:focus-within {
    box-shadow: 0 0 0 2px var(--qwer-link-color, currentColor);
  }

  .submission-editor :global(.ProseMirror img) {
    max-width: 100%;
    height: auto;
  }

  /* A picked, dropped or Word image, shown from memory while it uploads. A
     pasted Google image is https already, so it shows at full strength. */
  .submission-editor :global(.ProseMirror img:not([src^='https://'])) {
    opacity: 0.5;
  }

  .submission-editor :global(.ProseMirror img.ProseMirror-selectednode) {
    outline: 3px solid var(--qwer-link-color, currentColor);
  }

  .submission-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    opacity: 0.5;
    pointer-events: none;
  }
</style>
