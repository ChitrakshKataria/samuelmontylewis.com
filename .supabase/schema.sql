create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text not null,
  status text not null default 'published' check (status in ('draft', 'published')),
  published_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create table if not exists public.blog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.blog_admins enable row level security;

drop policy if exists "Blog admins can read own admin record" on public.blog_admins;
create policy "Blog admins can read own admin record"
on public.blog_admins for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read published posts" on public.posts;
drop policy if exists "Authenticated users can read posts" on public.posts;
drop policy if exists "Authenticated users can insert posts" on public.posts;
drop policy if exists "Authenticated users can update posts" on public.posts;
drop policy if exists "Authenticated users can delete posts" on public.posts;
drop policy if exists "Authenticated users can read allowed posts" on public.posts;
drop policy if exists "Blog admins can read all posts" on public.posts;
drop policy if exists "Blog admins can insert posts" on public.posts;
drop policy if exists "Blog admins can update posts" on public.posts;
drop policy if exists "Blog admins can delete posts" on public.posts;

create policy "Public can read published posts"
on public.posts for select
to anon
using (status = 'published');

create policy "Authenticated users can read allowed posts"
on public.posts for select
to authenticated
using (
  status = 'published'
  or exists (select 1 from public.blog_admins where user_id = (select auth.uid()))
);

create policy "Blog admins can insert posts"
on public.posts for insert
to authenticated
with check (exists (select 1 from public.blog_admins where user_id = (select auth.uid())));

create policy "Blog admins can update posts"
on public.posts for update
to authenticated
using (exists (select 1 from public.blog_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.blog_admins where user_id = (select auth.uid())));

create policy "Blog admins can delete posts"
on public.posts for delete
to authenticated
using (exists (select 1 from public.blog_admins where user_id = (select auth.uid())));

create index if not exists posts_status_published_at_idx on public.posts (status, published_at desc);
