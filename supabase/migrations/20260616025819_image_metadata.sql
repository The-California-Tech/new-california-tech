-- 1) Create table
create table if not exists public.image_metadata (
  id bigint generated always as identity primary key,

  bucket_id text not null,
  object_path text not null,

  width integer not null check (width > 0),
  height integer not null check (height > 0),

  -- optional but useful direct relation to storage.objects
  storage_object_id uuid unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- app-level canonical identity
  constraint image_metadata_bucket_path_unique unique (bucket_id, object_path),

  -- relation to bucket
  constraint image_metadata_bucket_fkey
    foreign key (bucket_id)
    references storage.buckets (id)
    on delete cascade,

  -- relation to storage object row (when known)
  constraint image_metadata_storage_object_fkey
    foreign key (storage_object_id)
    references storage.objects (id)
    on delete cascade
);

-- 2) Helpful lookup index
create index if not exists image_metadata_bucket_path_idx
  on public.image_metadata (bucket_id, object_path);

-- 3) Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_image_metadata_set_updated_at on public.image_metadata;

create trigger trg_image_metadata_set_updated_at
before update on public.image_metadata
for each row
execute function public.set_updated_at();