create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

alter table "public"."image_metadata" enable row level security;

grant delete on table "public"."image_metadata" to "anon";

grant insert on table "public"."image_metadata" to "anon";

grant select on table "public"."image_metadata" to "anon";

grant update on table "public"."image_metadata" to "anon";

grant delete on table "public"."image_metadata" to "authenticated";

grant insert on table "public"."image_metadata" to "authenticated";

grant select on table "public"."image_metadata" to "authenticated";

grant update on table "public"."image_metadata" to "authenticated";

grant delete on table "public"."image_metadata" to "service_role";

grant insert on table "public"."image_metadata" to "service_role";

grant select on table "public"."image_metadata" to "service_role";

grant update on table "public"."image_metadata" to "service_role";


  create policy "Service role full access"
  on "public"."image_metadata"
  as permissive
  for all
  to public
using ((auth.role() = 'service_role'::text))
with check ((auth.role() = 'service_role'::text));



