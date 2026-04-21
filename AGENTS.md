# Repository Guidelines

## Project Structure & Module Organization

This is a static GitHub Pages blog backed by Supabase.

- `index.html` and `404.html` are the public app shell and route fallback.
- `archive.html`, `post.html`, and `admin.html` remain direct static entry points.
- `assets/js/app.js` contains routing, Supabase reads/writes, and admin behavior.
- `assets/js/config.js` contains public Supabase browser configuration.
- `assets/css/styles.css` contains all shared styling.
- `local-server.mjs` serves the site locally with clean URL fallback.
- `README.md` documents setup and deployment.

There is no build output directory; GitHub Pages serves the repository root.

## Build, Test, and Development Commands

Run the local server:

```powershell
node local-server.mjs
```

Open `http://localhost:8000/`. Clean routes such as `/archive/` and `/posts/on-writing-every-day/` should work locally.

Check JavaScript syntax:

```powershell
node --check .\assets\js\app.js
```

Optional browser smoke test:

```powershell
npx --yes playwright screenshot --wait-for-selector "text=Samuel Monty Lewis" http://127.0.0.1:8000/ smoke.png
```

No install or build step is required for production.

## Coding Style & Naming Conventions

Use plain HTML, CSS, and JavaScript. Keep indentation at two spaces in HTML/CSS/JS. Prefer small functions in `assets/js/app.js` and keep DOM IDs descriptive, for example `postList`, `archiveContent`, and `authPanel`.

Use lowercase, hyphenated slugs for posts, such as `on-writing-every-day`. Keep CSS custom properties in `:root` and reuse existing color tokens before adding new colors.

## Testing Guidelines

There is no formal test framework. Before committing changes, run `node --check .\assets\js\app.js` and manually verify:

- `/` renders recent posts.
- `/archive/` renders grouped posts.
- `/posts/<slug>/` renders a post.
- `admin.html` still signs in and saves posts for users in `public.blog_admins`.

## Commit & Pull Request Guidelines

No Git history is available in this workspace, so use concise imperative commit messages, for example `Add clean post routes` or `Fix admin auth state`.

Pull requests should include a short summary, screenshots for visual changes, verification steps run, and any Supabase schema or RLS changes.

## Security & Configuration Tips

Only place the Supabase `anon public` or `sb_publishable_...` key in `assets/js/config.js`. Never commit a `service_role` key. Admin access must be enforced through Supabase Auth and RLS, especially `public.blog_admins`.
