set check_function_bodies = off;

create or replace function public.list_storage_objects_recursive(
  p_bucket_id text,
  p_prefix text default ''::text,
  p_limit integer default 1000,
  p_after_name text default null
)
returns table(
  id uuid,
  name text,
  bucket_id text,
  owner uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  last_accessed_at timestamp with time zone,
  metadata jsonb
)
language sql
stable
set search_path to 'pg_catalog', 'storage'
as $function$
  select
    o.id,
    o.name,
    o.bucket_id,
    o.owner,
    o.created_at,
    o.updated_at,
    o.last_accessed_at,
    o.metadata
  from storage.objects as o
  where o.bucket_id = p_bucket_id
    and o.name like p_prefix || '%'
    and (p_after_name is null or o.name > p_after_name)
  order by o.name asc
  limit least(greatest(p_limit, 1), 1000);
$function$;