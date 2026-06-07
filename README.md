# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Post-deploy SEO automation

The workflow at `.github/workflows/post-deploy-seo.yml` runs the
post-publish verification (FAQ JSON-LD, canonical, robots.txt, sitemap,
GSC), Lighthouse audits, full-page screenshots, and a versioned
Rich Results snapshot — on every push to `main` / `staging`, on PRs,
and on demand via **Actions → Post-deploy SEO checks → Run workflow**.

### Required GitHub Secrets
| Secret | Purpose |
|---|---|
| `LOVABLE_API_KEY` | Auth for the Lovable connector gateway |
| `GOOGLE_SEARCH_CONSOLE_API_KEY` | GSC connector key |
| `SLACK_WEBHOOK_URL` *(optional)* | Slack failure notifications |
| `RESEND_API_KEY` + `ALERT_EMAIL_TO` *(optional)* | Email failure notifications |

### Required GitHub Variables (Settings → Variables → Actions)

Per-environment site URLs — set the ones you use:

| Variable | When it's used | Example |
|---|---|---|
| `SITE_URL_MAIN` | Push to `main` | `https://jobs1001.lovable.app` |
| `SITE_URL_STAGING` | Push to `staging` | `https://staging.jobs1001.lovable.app` |
| `SITE_URL_PREVIEW` | PRs + manual runs without override | `https://id-preview--<id>.lovable.app` |

`LH_BASE_URL` is automatically set to the same value as `SITE_URL` for
the resolved branch, so you don't need to configure it separately —
override it only if Lighthouse must hit a different origin than the
post-publish verifier.

Optional tuning variables:

| Variable | Default | Notes |
|---|---|---|
| `LH_MIN_PERFORMANCE` | `0.70` | 0..1 |
| `LH_MIN_ACCESSIBILITY` | `0.90` | 0..1 |
| `LH_MIN_SEO` | `0.95` | 0..1 |
| `LH_PATHS` | `/como-funciona,/buscar` | Comma-separated |
| `FAQ_PATH` | `/como-funciona` | Page expected to carry FAQPage JSON-LD |
| `ARTIFACT_RETENTION_DAYS` | `30` | Per-run report + screenshots |
| `ARTIFACT_HISTORY_RETENTION_DAYS` | `90` | `rich-results-history.json` |
| `ARTIFACT_MAX_RUNS` | `20` | Keep N most recent per-branch artifacts; older pruned automatically |

### Running on demand (workflow_dispatch)

Override the target URL for a single run without editing code:

1. Go to **Actions → Post-deploy SEO checks**.
2. Click **Run workflow**.
3. In the **Override SITE_URL** input, paste the URL (e.g.
   `https://my-pr-preview.lovable.app`). Leave blank to use the
   branch-resolved variable.
4. Click **Run workflow**. The override applies to both `SITE_URL`
   and `LH_BASE_URL` for that run.

### Artifacts produced per run
- `seo-report-<branch>-<runId>` — JSON summaries + HTML/Markdown report + per-URL Lighthouse reports.
- `seo-screenshots-<branch>-<runId>` — Full-page PNGs of audited paths.
- `seo-rich-results-history` — Long-retention versioned history (overwritten each run).

### Pull Request comments
PRs receive a sticky comment with the run summary (FAQ, canonical,
robots, sitemap, Lighthouse table, snapshot deltas) and links to the
artifacts. On failure, the comment also references the auto-opened
tracking issue.

