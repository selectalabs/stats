# Selecta Labs stats

A public dashboard with downloads, ratings and site status for Selecta Labs apps.
GitHub Actions updates it every day. Your laptop can be off.

- Apps, sites and the visit counter are listed in `config.json`.
- `collect.mjs` reads the numbers and writes `site/data.json`.
- `site/index.html` is the dashboard.

Optional: add the secrets `STORE_TENANT_ID`, `STORE_CLIENT_ID` and `STORE_CLIENT_SECRET`
(Partner Center API) to show live Microsoft Store installs instead of the hand-read numbers.
