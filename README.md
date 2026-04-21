# Samuel Monty Lewis Blog

Static blog frontend for GitHub Pages with Supabase as the backend.

## Files

- `/` shows the latest published posts.
- `/archive/` groups all published posts by year.
- `/posts/your-post-slug/` renders a single post.
- `admin.html` signs in with Supabase Auth and manages posts.
- `assets/js/config.js` contains the public Supabase browser config.

## Supabase setup

The `samuelmontylewisblog` project has already been given the `posts` table and row-level-security policies. The same schema is kept in `.supabase/schema.sql`.

Before publishing, add the project `anon public` key in `assets/js/config.js`. This key is expected to be visible in the browser on a static site. Do not use the `service_role` key here.

```js
window.SML_SUPABASE_URL = "https://gchnnqthwchasdciwvub.supabase.co";
window.SML_SUPABASE_ANON_KEY = "paste-your-anon-public-key-here";
```

Then create at least one Supabase Auth user in the dashboard. Add that user's id to `public.blog_admins`:

```sql
insert into public.blog_admins (user_id)
values ('your-auth-user-id')
on conflict (user_id) do nothing;
```

That user can sign in on `admin.html` and create, edit, draft, publish, or delete posts.

The public pages do not link to `admin.html`, but the page still exists at that path for you. Security is enforced by Supabase Auth and row-level-security policies, not by hiding the URL.

## GitHub Pages

Host from the repository root. No build step is required.

Clean post URLs are handled by the static router and `404.html` fallback. On GitHub Pages, opening a dynamic post URL directly may technically return the fallback document, but the page will render the correct post in the browser.
