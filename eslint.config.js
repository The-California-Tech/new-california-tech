import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    ignores: ['build/', '.svelte-kit/', 'dist/'],
  },
  {
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'svelte/no-at-html-tags': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',

      /**
       * DELIBERATELY OFF, with a plan to re-enable. Not a "this rule is wrong"
       * suppression -- see below before removing this line.
       *
       * WHAT IT WANTS
       *   Every internal href/goto/replaceState wrapped in `resolve()` from
       *   `$app/paths`, e.g.
       *     href={resolve('/issues/[date=issuedate]', { date: issue.date })}
       *
       * WHY IT IS WORTH DOING EVENTUALLY
       *   `resolve()` takes a route ID, so TypeScript verifies at compile time
       *   that the route exists and the params are right. That catches typo'd
       *   and stale internal links -- valuable on a link-heavy news site. It
       *   also makes links correct under a `base` path.
       *
       * WHY IT IS OFF FOR NOW (Sep 2026, pre-launch)
       *   The site deploys at a domain root, so the base-path half fixes nothing
       *   today. And it is not a mechanical change: of the 29 sites, ~18 are
       *   straightforward wraps, but 11 require changing data structures rather
       *   than call sites --
       *     - index_post.svelte x4: `href={data.slug}`, where Post.slug is a
       *       pre-built path from toTechPublicSlug(). Using resolve() means
       *       changing what that function returns and what Post.slug means.
       *     - loadMoreHref x3: built inside buildCountLoadMoreHref() in
       *       feed-client.ts.
       *     - DefaultNav x2: `href={section.href}` from the nav config.
       *     - post_tags: `href={tag.url}`, built elsewhere.
       *     - post_heading x2: intentionally ABSOLUTE URLs for microformats
       *       (u-url/u-uid), where resolve() does not apply at all.
       *   The failure mode of getting it wrong is a silently broken link, which
       *   is a bad thing to risk in launch week.
       *
       * TO RE-ENABLE
       *   1. Make Post.slug carry a route ID + params instead of a path, or add
       *      a resolved-href field alongside it.
       *   2. Have buildCountLoadMoreHref() take a resolved base path.
       *   3. Type the nav config's `href` as a route ID.
       *   4. Add targeted inline disables for the two post_heading microformat
       *      links, which are meant to be absolute.
       *   Then flip this to 'error' and click through every route.
       *
       * Note the 19 `svelte/require-each-key` errors found alongside these were
       * NOT suppressed -- they were fixed, because unkeyed {#each} in Svelte 5
       * matches by position and can reuse the wrong DOM node when a list
       * reorders (an article showing another article's cover).
       */
      'svelte/no-navigation-without-resolve': 'off',
    },
  },
];
