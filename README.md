# MakeMoviesAI

**Collaborative filmmaking where rejected work becomes new projects.**

[![Live Demo](https://img.shields.io/badge/demo-app.makemoviesai.com-blue)](https://app.makemoviesai.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)](https://www.typescriptlang.org/)

---

## What Makes This Different

Traditional collaboration tools delete rejected contributions. MakeMoviesAI turns them into **forks** — new projects with their own ownership and creative direction.

| Concept | Description |
|---------|-------------|
| **Fork-based conflict resolution** | Rejected work doesn't disappear — it becomes an alternative project |
| **Explicit decision states** | Every creative decision (accept/fork) is logged and traceable |
| **Clean ownership model** | Forked projects have clear, independent ownership |

Think of it as **GitHub's branching model, but for films**.

---

## Tech Stack

- **Frontend:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Hosting:** Vercel

---

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account

### Installation

```bash
git clone https://github.com/MinakamiMario/MakeMoviesAI.git
cd MakeMoviesAI
npm install
```

### Environment Setup

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Core Concepts

### Projects & Scenes

A **project** is a film. A **scene** is a unit within that film. Directors can add scenes directly; contributors submit scenes for review.

### Contributions & Decisions

When a contributor submits work:
- **Accept** → The contribution becomes part of the project
- **Fork** → A new project is created with the contributor as director

Every decision is logged in the `decision_events` table for full traceability.

### Branches vs Forks

| | Branch | Fork |
|--|--------|------|
| Scope | Within project | New project |
| Ownership | Same director | New director |
| Use case | Alternative storylines | Rejected contribution gets own life |

---

## Documentation

For detailed architecture, database schema, and development guidelines, see [HANDOVER.md](./HANDOVER.md).

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
