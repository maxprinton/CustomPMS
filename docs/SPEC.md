# Custom PMS (CPMS): Specification v1

## 1. Purpose
Custom PMS makes my work as a project manager easier. It is one place to manage clients, projects, a backlog and a library of project-management templates. It fills out project documents for me, uses AI to draft content, and runs on free-tier technology.

Short name: **CPMS** (code, package name, API key prefix `cpms_live_`). Display name: **Custom PMS**.

## 2. Users and roles
- Every record belongs to a **workspace**. Signing up creates a workspace and makes the new user its owner.
- **Owner:** everything, including members and API keys.
- **Member:** read and write all workspace records.
- **Viewer:** read only.
- Sign-in: email and password.

## 3. Technology
| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js (App Router, server actions), TypeScript, Tailwind | Same as Personal OS, so code ports directly |
| Database, auth, files | Supabase (Postgres with row-level security, Storage) | Free tier; security enforced in the database |
| Hosting | Vercel, deploys on every push to `main` | Free tier |
| AI | Gemini free tier behind a small interface | Cheapest; replaceable |

Systems: GitHub `maxprinton/CustomPMS`, Supabase project `custom-pms`, Vercel project `custompms`. Fully separate from Personal OS.

## 4. Data model
All tables carry `workspace_id` and are protected by row-level security.

- `workspaces`, `workspace_members` (role: owner / member / viewer)
- `clients` (kind: external / internal), `contacts`
- `projects` (client, method: predictive / agile / hybrid, phase: initiation / planning / execution / monitoring / closing, status, objective, sponsor, dates, budget, `profile` JSON for template filling)
- `tasks`, `milestones`, `risks` (probability x impact = score)
- `backlog_items` (type: bug / feature / improvement / big idea; status: inbox / later / next / now / verifying / done / parked; optional project)
- `notes` (kind: note / meeting / decision / lesson; optional project and client)
- `templates`, `template_files`, `template_copies`. Rows with no workspace are the built-in shared library (read-only); a workspace can add its own.
- `tags`, `links` (tag any record)
- `api_keys`, `erp_links` (ERP bridge, phase 5)

Migrations live in `supabase/migrations`.

## 5. Screens
| Screen | What it does |
|---|---|
| Login | Sign in, create account, reset password |
| Dashboard | Counts and what is in progress now |
| Clients | List, create, open a client with its contacts and projects |
| Projects | List, create, open a project: profile, tasks, milestones, risks, its backlog, its documents |
| Backlog | Global board by status, filter by project, WIP limits |
| Templates | Library by phase and method; make a filled working copy for a project |
| Notes | Project journal: meetings, decisions, lessons learned |
| Settings | Language (English / Spanish), workspace name, members, API keys |

Interface text is English and Spanish, switchable, stored per browser. Look: clean and calm, light and dark, one accent color.

## 6. Features by phase
**Phase 1: Foundation.** Database, security, sign-in, app shell, language switch, clients, projects, tasks, milestones, risks, simple backlog board, deployment.

**Phase 2: Templates.** Import the 132 built-in templates and their files from Personal OS. Library screen with filters. Working copies filled from project and client data (Word, Excel, PowerPoint, PDF), in English or Spanish. "Out of date" detection when project data changes.

**Phase 3: Backlog, full port.** Steps, tests, activity history, WIP limits, triage prompt, per-project board.

**Phase 4: AI and notes.** AI drafts for charter sections, risks, milestones, status reports and meeting summaries, using project and client context, with a usage cap. Notes editor as project journal. Tags.

**Phase 5: ERP bridge.** REST API under `/api/v1` authenticated with workspace API keys (stored hashed). Endpoints for clients, projects, tasks. Webhooks for status changes. `erp_links` maps ERP IDs to CPMS records. Designed once the ERP's platform and first data flow are known.

**Later.** Search, "Ask" AI chat per project, recurring tasks, Coursera clipper, dashboards, time tracking and billing.

## 7. Rules
- Nothing from Personal OS's personal data is copied: only code, the template library and structure.
- Security is enforced in the database, not only in the app. Every new table gets row-level security in the same migration.
- Secrets (AI key, service keys) live only in Vercel environment variables, never in the repo.
- Every schema change is a numbered migration file in the repo.
- Each phase ends with a working deployment.

## 8. Open decisions
1. What the ERP is built on, and the first data flow between the two systems.
2. Whether to keep Telegram notifications for the backlog (default: no).
3. Custom domain for the app (default: the free Vercel address).
