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

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Reader' check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'comments'
      and constraint_name = 'comments_user_id_profiles_fkey'
  ) then
    alter table public.comments
      add constraint comments_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(user_id) on delete cascade;
  end if;
end $$;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace view public.published_comments_with_profiles
with (security_invoker = true)
as
select
  c.id,
  c.post_id,
  c.user_id,
  c.body,
  c.created_at,
  coalesce(nullif(p.display_name, ''), 'Reader') as display_name
from public.comments c
left join public.profiles p on p.user_id = c.user_id
where c.status = 'published';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

alter table public.blog_admins enable row level security;
alter table public.profiles enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.comments from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;

grant select on public.profiles to anon, authenticated;
grant insert (user_id, display_name), update (display_name) on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.comments to anon, authenticated;
grant insert (post_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert, update, delete on public.comments to authenticated;
revoke all on public.published_comments_with_profiles from anon, authenticated;
grant select on public.published_comments_with_profiles to anon, authenticated;

grant select on public.post_likes to anon, authenticated;
grant insert (post_id) on public.post_likes to authenticated;
grant delete on public.post_likes to authenticated;
grant insert, delete on public.post_likes to authenticated;

drop policy if exists "Blog admins can read own admin record" on public.blog_admins;
create policy "Blog admins can read own admin record"
on public.blog_admins for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Public can read published comments" on public.comments;
create policy "Public can read published comments"
on public.comments for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Users can create own comments" on public.comments;
create policy "Users can create own comments"
on public.comments for insert
to authenticated
with check (user_id = (select auth.uid()) and status = 'published');

drop policy if exists "Users can update own comments" on public.comments;
create policy "Users can update own comments"
on public.comments for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and status = 'published');

drop policy if exists "Users and admins can delete comments" on public.comments;
create policy "Users and admins can delete comments"
on public.comments for delete
to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.blog_admins where user_id = (select auth.uid()))
);

drop policy if exists "Public can read like rows" on public.post_likes;
create policy "Public can read like rows"
on public.post_likes for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own likes" on public.post_likes;
create policy "Users can create own likes"
on public.post_likes for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own likes" on public.post_likes;
create policy "Users can delete own likes"
on public.post_likes for delete
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
create index if not exists comments_post_created_at_idx on public.comments (post_id, created_at asc) where status = 'published';
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists post_likes_post_id_idx on public.post_likes (post_id);
create index if not exists post_likes_user_id_idx on public.post_likes (user_id);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default ''
);

alter table public.site_settings enable row level security;

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings for select
to anon, authenticated
using (true);

drop policy if exists "Blog admins can insert site settings" on public.site_settings;
create policy "Blog admins can insert site settings"
on public.site_settings for insert
to authenticated
with check (exists (select 1 from public.blog_admins where user_id = (select auth.uid())));

drop policy if exists "Blog admins can update site settings" on public.site_settings;
create policy "Blog admins can update site settings"
on public.site_settings for update
to authenticated
using (exists (select 1 from public.blog_admins where user_id = (select auth.uid())))
with check (exists (select 1 from public.blog_admins where user_id = (select auth.uid())));
