# Custom PMS (CPMS)

Project management software for clients, projects, templates, backlog and AI-assisted documentation.

- Spec: [docs/SPEC.md](docs/SPEC.md)
- Stack: Next.js + Supabase + Vercel
- Database migrations: `supabase/migrations`
- Roles: owner / member / viewer, per workspace

## Run locally
1. Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key.
2. `npm install`, then `npm run dev`, then open http://localhost:3000
