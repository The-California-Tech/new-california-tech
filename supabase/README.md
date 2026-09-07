# Database layout

This is the reference example for using symbiont-cms with Supabase. The schema is
organised around **who owns what**, because that boundary is the whole point of
symbiont: it should be a beneficial accessory to your Postgres database, not an
opinionated framework that owns it.

## Read these two files first

| File                           | Owner            | What's in it                                                                                                                                                       |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemas/10_symbiont_core.sql` | **symbiont-cms** | `pages`, `image_metadata`, `set_updated_at()`, `list_storage_objects_recursive()`. The library reads and writes these directly. Treat as the library's, not yours. |
| `schemas/20_tech_feed.sql`     | **your app**     | Everything built on top: the `search_fts` column, tag listing, and the feed functions. symbiont knows nothing about any of it.                                     |

The rule of thumb: **if symbiont-cms would break when you change it, it belongs in
`10_`.** Everything else is yours.

`schema_paths` in `config.toml` lists both explicitly rather than globbing,
because the order is load-bearing — `20_` runs `ALTER TABLE` against the table
`10_` creates.

### The relationship to aim for

`search_fts` is the clearest illustration. It's a column _your app adds to the
library's table_, declared in `20_tech_feed.sql` as an `ALTER TABLE`. symbiont
doesn't know it exists and doesn't need to. Extend, don't fork.

Today `10_symbiont_core.sql` has to live here because **symbiont-cms ships no
DDL**, so every consuming app hand-maintains the library's own tables. The
intended direction is for symbiont to own and migrate its own schema — ideally a
dedicated `symbiont` Postgres schema — at which point `10_` gets replaced by a
path into `node_modules/symbiont-cms` and stops being your problem. Splitting
along ownership lines now makes that swap mechanical.

## Workflow

The declarative files in `schemas/` are the source you edit. Migrations are
derived:

```bash
# 1. edit schemas/*.sql
# 2. generate the migration
supabase db diff -f describe_your_change
# 3. rebuild locally and verify
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
     -f supabase/tests/feed_sql_checks.sql
```

To regenerate the baseline from scratch:

```bash
git add -A && git commit -m "checkpoint"   # migrations are about to be deleted
rm supabase/migrations/*.sql
supabase db diff -f baseline_schema
git checkout supabase/migrations/*_harden_privileges.sql   # see below -- must survive
supabase db reset
```

## Privileges: defaults off, grants explicit

`migrations/*_default_privileges.sql` revokes Supabase's automatic grants on
future objects in `public`, and Postgres's automatic `EXECUTE` to `PUBLIC` on
future functions. Consequences, all of them good:

- New tables and functions are **not** reachable via the Data API until you write
  an explicit `GRANT`. If one is missing, PostgREST returns `42501` with a hint
  naming the exact grant — a loud failure instead of a silent exposure.
- Because nothing is granted automatically, **every privilege statement is a
  `GRANT`** — which the diff engine can express. That is the only reason
  privileges can live in `schemas/` at all. See the REVOKE caveat below.
- It matches [Supabase's 2026-04-28 breaking change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically),
  which becomes the enforced default for all existing projects on **2026-10-30**.
  Adopting it early makes that date a no-op here.

Two corrections to Supabase's published snippet, both found by running it:

- **It targets the wrong role.** The snippet says `for role postgres`, but on a
  local stack the default ACLs are registered against `supabase_admin`
  (`anon=arwdDxtm/supabase_admin`). Default privileges are keyed to the
  _creating_ role, so revoking them for `postgres` silently does nothing. The
  migration discovers whichever roles hold them instead of assuming.
- **Its privilege list is incomplete.** It revokes select/insert/update/delete.
  The real grant is `arwdDxtm`, which also includes `D` (TRUNCATE — the one that
  bypasses RLS), `x` (REFERENCES), `t` (TRIGGER) and `m` (MAINTAIN). Use
  `revoke all`.

**Caveat found the hard way:** revoking the _function_ default did not reliably
take. `pg_default_acl` showed PUBLIC's `EXECUTE` removed for role `postgres`, yet
a freshly created function was still executable by `anon`. Also, `postgres`
cannot alter `supabase_admin`'s defaults (insufficient privilege), so only the
`postgres` creation path is covered. So don't rely on defaults for functions —
`_harden_privileges.sql` does an explicit `revoke all ... from public` followed by
the grants it wants, per function. Deterministic and greppable. Check 3c asserts
the resulting RPC surface is exactly the intended set.

Two things to know if you copy this pattern:

1. **The statements are duplicated** — in the migration _and_ at the top of
   `schemas/10_symbiont_core.sql`. Both are required. `db diff` builds one
   database from the migrations and another from the schema files, then compares
   object privileges; if only one side has the defaults revoked, every table's
   grants differ and the diff is permanently noisy. `ALTER DEFAULT PRIVILEGES`
   isn't a schema object, so the differ never emits it — it only sees the
   consequences.
2. **It only affects objects created afterwards.** Tables that already existed
   keep their old grants, which is why `*_harden_privileges.sql` still carries a
   one-time revoke for `pages` and `image_metadata`.

## Two things `db diff` cannot express

Both were learned by having them silently break the site. Neither is a bug you
can fix — plan around them.

### 1. REVOKE

The diff engine models privileges **additively**. It emits `GRANT`, but has no
vocabulary for "PUBLIC must not hold the default privilege." Postgres grants
`EXECUTE` on every new function to `PUBLIC`, and Supabase's
`ALTER DEFAULT PRIVILEGES` grants the full DML set on every new table in `public`
to `anon`/`authenticated`/`service_role`. Those are the defaults, so there is
nothing for the tool to describe.

Consequences:

- A regenerated baseline **drops every REVOKE**, silently. `anon` regains
  `TRUNCATE` on `pages` (not subject to RLS!) and `EXECUTE` on
  `list_storage_objects_recursive` (which enumerates a public bucket, exposing
  unlinked files such as unreleased issue PDFs).
- `db diff` reports **"No schema changes found"** even when the hardening is
  missing. It is blind in both directions.

So `migrations/*_harden_privileges.sql` is **hand-written and permanent**. It must
survive every baseline regeneration. The REVOKEs also appear in `schemas/*.sql`,
but only as documentation of intent.

### 2. View reloptions

`WITH (security_invoker = on)` is not preserved. A generated migration recreates
the view without it, which switches RLS evaluation from the caller to the view's
owner — bypassing the policy that hides unpublished articles, with no error.

This repo has **no views** for exactly that reason. `public.homepage` used to do
the feed's job and was dropped in favour of `list_homepage_posts()`. Functions
don't have the problem: `SECURITY INVOKER` is their default, so escalating one to
`SECURITY DEFINER` means _adding_ a visible keyword rather than silently losing
one.

If you add a view here, assume every future `db diff` will try to break it.

## The actual regression guard

`tests/feed_sql_checks.sql`. It is behavioural, so normalisation differences
can't fool it. It asserts, among other things:

- no `homepage` view has reappeared, and every feed function is `SECURITY INVOKER`
- `anon` has a permissive SELECT policy on `image_metadata` (without it, cover
  dimensions come back NULL through a LEFT JOIN, silently)
- `anon` cannot `TRUNCATE` `pages` or execute the storage-listing function
- `anon` cannot see unpublished or future-dated articles through the feed function
- the issue-boundary pagination rule: a page never ends mid-issue
- the cover→dimensions join is host-agnostic, so it survives a preview branch or
  a new project

Run it after any schema change. It rolls back, so it persists nothing, and it
asserts on deltas against baselines rather than absolute counts — safe to run
against a database with real content.
