# Selecta Labs Admin

A private admin dashboard for Selecta Labs, with Google login. It has:

- **Overview**: downloads, Store ratings, site visits and ad clicks, with charts.
- **Apps**: Microsoft Store installs and ratings, and GitHub downloads by version.
- **Sites & visits**: visits per site, site status, and the embed code.
- **Ads**: create, schedule and switch ads for any site (image, text + button, or ad code).
- **Settings**: admins and appearance.

The dashboard page is hosted on GitHub Pages. All data lives in Supabase and is protected by database rules: only admins can read it.

## How it works

- `site/` is the dashboard (plain HTML/JS).
- `site/selecta.src.js` becomes `selecta.js`, the one-line snippet that goes on every site. It counts visits and shows the ads.
- `collect.mjs` runs every day in GitHub Actions. It saves downloads, ratings and site status to Supabase.
- `supabase/schema.sql` creates the tables, the login rules and the image storage.

Preview with sample data: open `/?demo` on the dashboard.

## Setup (one time)

1. **Supabase**: create a free project. Open SQL Editor, paste `supabase/schema.sql` and click Run.
2. **Google login**:
   - In Google Cloud Console, open APIs & Services → Credentials and create an OAuth client ID (Web application).
   - Set its redirect URI to the callback URL shown in Supabase → Authentication → Sign In / Providers → Google.
   - Paste the Client ID and Client secret into that Supabase page and turn Google on.
   - In Supabase → Authentication → URL Configuration, set the Site URL and a Redirect URL to `https://selectalabs.github.io/stats/`.
3. **GitHub repo settings** (Settings → Secrets and variables → Actions):
   - Variables:
     - `SUPABASE_URL`: the Project URL.
     - `SUPABASE_ANON_KEY`: the publishable (anon) key.
   - Secret: `SUPABASE_SERVICE_KEY`, the secret (service_role) key. Never put it anywhere else.
   - Optional secrets for live Store installs: `STORE_TENANT_ID`, `STORE_CLIENT_ID`, `STORE_CLIENT_SECRET`.
4. **Pages**: Settings → Pages → Source: GitHub Actions. Then run the **Dashboard** workflow.
5. **Sites**: copy each site's line from Sites & visits and paste it before `</body>`.
