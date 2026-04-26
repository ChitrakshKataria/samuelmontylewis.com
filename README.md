Samuel Monty Lewis sin blog

## Auth email redirects

Account confirmation emails use the current site URL by default. To force a
specific production URL, set `window.SML_SITE_URL` in `assets/js/config.js`.

In Supabase, open **Authentication > URL Configuration** and make sure:

- **Site URL** is the live site URL, not localhost.
- **Redirect URLs** includes:
  - `https://samuelmontylewis.com/email-confirmed/`
  - `http://localhost:8000/email-confirmed/`
