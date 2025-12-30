# MakeMoviesAI - Project Handover Document

**Datum:** 30 december 2024
**Repository:** https://github.com/MinakamiMario/MakeMoviesAI
**Live URL:** https://app.makemoviesai.com
**Supabase Project:** dicdmlcrhnunhgltiabg (eu-west-1)

---

## 1. VISIE & CONCEPT

### Wat is MakeMoviesAI?

MakeMoviesAI is een **collaboratief filmmaking platform** waar meerdere mensen samen aan een film kunnen werken. Het unieke aan dit platform is hoe het omgaat met **creatieve conflicten**: in plaats van dat afgewezen bijdragen verdwijnen, worden ze omgezet in **forks** - nieuwe projecten met eigen eigenaarschap.

### Core Value Proposition (voor acquirers)

1. **Fork-based conflict resolution**: Afgewezen werk verdwijnt niet, maar wordt een alternatieve storyline
2. **Explicit decision states**: Elke creatieve beslissing is traceerbaar (accept/fork)
3. **Traceable lineage**: Volledige herkomst van elk project en elke scene

### GitHub-model voor Films

- **Branch** = alternatieve storyline binnen hetzelfde project (zelfde director)
- **Fork** = nieuw project ontstaan uit rejection (nieuwe director/eigenaar)

---

## 2. TECHNISCHE STACK

| Component | Technologie |
|-----------|-------------|
| Frontend | Next.js 14 (App Router) |
| Styling | CSS Modules |
| Backend/DB | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Hosting | Vercel |
| Repo | GitHub |

---

## 3. PROJECT STRUCTUUR

```
src/
├── app/                            # Next.js App Router pages
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Auth
│   ├── signup/page.tsx             # Auth
│   ├── dashboard/page.tsx          # User's projects
│   └── projects/
│       ├── page.tsx                # Browse all projects
│       ├── new/page.tsx            # Create project
│       └── [id]/
│           ├── page.tsx            # Project detail (orchestrator)
│           ├── page.module.css     # Page-level styles
│           ├── add-scene/          # Director adds scene
│           └── contribute/         # Contributor submits
│
├── components/                     # Presentational components
│   ├── ProjectHeader.tsx           # Project title, director, fork info
│   ├── ProjectHeader.module.css
│   ├── SceneTimeline.tsx           # Timeline met scenes
│   ├── SceneTimeline.module.css
│   ├── PendingContributions.tsx    # Lijst pending contributions
│   ├── PendingContributions.module.css
│   ├── ContributionCard.tsx        # Collapsed contribution preview
│   ├── ContributionCard.module.css
│   ├── ContributionReview.tsx      # Modal for accept/fork decision
│   ├── ContributionReview.module.css
│   ├── DecisionLog.tsx             # Audit trail component
│   ├── DecisionLog.module.css
│   ├── LineageTree.tsx             # Fork visualization
│   ├── LineageTree.module.css
│   ├── MediaUpload.tsx             # File upload component
│   └── MediaUpload.module.css
│
├── lib/                            # Business logic & utilities
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server Supabase client
│   ├── graph.ts                    # Graph traversal utilities
│   ├── projectLoader.ts            # Data fetching (alle reads)
│   └── decisions.ts                # Mutations (accept via client, fork via RPC)
│
└── types/                          # Centrale type definities
    ├── index.ts                    # Barrel export
    ├── entities.ts                 # Domain types (Project, Scene, etc.)
    └── graph.ts                    # Graph types (BranchData, EdgeData)
```

### Folder Filosofie

| Folder | Verantwoordelijkheid | Regel |
|--------|---------------------|-------|
| `app/` | Routing + orchestratie | Geen business logic, alleen state + component compositie |
| `components/` | Presentational UI | Alleen props + JSX + styling, geen data fetching |
| `lib/` | Business logic | Alle Supabase queries, mutations, utilities |
| `types/` | Type definities | Single source of truth, geen logic |

### Bestandsgrootte Richtlijnen

- **Max ~150 regels per bestand** (richtlijn, niet strikt)
- Als een bestand groter wordt → splits logisch op
- Niet splitsen in `file_1.ts`, `file_2.ts` maar op verantwoordelijkheid

---

## 4. ARCHITECTUUR PATRONEN

### 4.1 Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  page.tsx   │────▶│ projectLoader.ts │────▶│  Supabase   │
│ (orchestr.) │     │    (reads)       │     │     DB      │
└─────────────┘     └──────────────────┘     └─────────────┘
       │
       │ mutations
       ▼
┌──────────────────┐
│  decisions.ts    │────▶ Supabase DB
│ (accept/fork)    │
└──────────────────┘
```

### 4.2 Component Hiërarchie

```
page.tsx (orchestrator)
├── ProjectHeader (presentational)
├── SceneTimeline (presentational)
├── PendingContributions (presentational)
│   └── ContributionCard (presentational)
├── LineageTree (data-fetching, eigen queries)
├── DecisionLog (data-fetching, eigen queries)
└── ContributionReview (modal, presentational)
```

### 4.3 Separation of Concerns

| Layer | Bestand | Mag wel | Mag niet |
|-------|---------|---------|----------|
| Page | `page.tsx` | State, useEffect, component compositie | Directe Supabase queries |
| Loader | `projectLoader.ts` | Supabase reads, data mapping | Mutations, UI logic |
| Decisions | `decisions.ts` | Supabase writes, decision_events | UI logic, reads |
| Components | `*.tsx` | Props, JSX, event handlers | Supabase calls |
| Types | `types/*.ts` | Type definities | Logic, imports van lib |

---

## 5. KEY BESTANDEN & FUNCTIES

### `src/lib/projectLoader.ts`

Centrale data loader voor project pagina.

```typescript
type ProjectPageData = {
  project: Project;
  scenes: Scene[];
  contributions: Contribution[];
  branch: BranchData | null;
  forkedFrom: ForkOrigin | null;
  forkCount: number;
  isDirector: boolean;
};

async function loadProjectData(
  supabase: SupabaseClient,
  projectId: string,
  userId: string | null
): Promise<ProjectPageData | null>
```

**Gebruik:**
```typescript
const data = await loadProjectData(supabase, params.id, user?.id);
if (!data) { router.push('/projects'); return; }
```

### `src/lib/decisions.ts`

Mutations voor contribution beslissingen.

```typescript
type AcceptResult = { success: boolean; sceneId?: string; error?: string };
type ForkResult = { success: boolean; newProjectId?: string; error?: string };

async function acceptContribution(...): Promise<AcceptResult>  // Client-side
async function forkContribution(...): Promise<ForkResult>      // Via RPC
```

**Accept:** Client-side mutation (director adds scene + edge).
**Fork:** Server-side RPC voor atomische operatie (zie hieronder).

### `public.fork_contribution(p_contribution_id UUID)` (Supabase RPC)

Server-side functie voor fork operaties. **SECURITY DEFINER** - bypasst RLS.

```sql
-- Input: contribution UUID
-- Output: new project UUID (of EXCEPTION bij fout)
-- Auth: alleen director van source project
-- Atomiciteit: volledige rollback bij elke fout
```

**Waarom RPC ipv client-side:**
- Fork maakt project met `director_id = contributor` (niet caller)
- RLS zou dit blokkeren (`auth.uid() != director_id`)
- RPC draait met elevated permissions
- Atomisch: geen half-geforkede projecten

**Stappen in RPC:**
1. Lock contribution (`FOR UPDATE`)
2. Valideer: exists, status = pending
3. Auth check: caller = director
4. Create project, branch, cut
5. Copy scenes + edges
6. Add contribution als laatste scene
7. Update contribution status
8. Log decision_event

### `src/lib/graph.ts`

Graph traversal utilities voor scene ordering.

| Functie | Doel |
|---------|------|
| `getDefaultBranch()` | Haalt default branch van project |
| `getBranchEdges()` | Haalt alle edges van een branch |
| `buildSceneOrder()` | Bouwt geordende array van scene IDs |
| `findLastSceneId()` | Vindt laatste scene (geen outgoing edge) |
| `createEdge()` | Maakt nieuwe edge |
| `createDefaultBranch()` | Maakt "Main" branch |
| `createDefaultCut()` | Maakt default cut |

### `src/types/`

Centrale type definities. **Altijd importeren via `@/types`**.

```typescript
// entities.ts
type ProfileRef = { username: string };
type Project = { id: string; title: string; ... };
type Scene = { id: string; title: string; ... };
type Contribution = { id: string; title: string; ... };
type ForkOrigin = { forked_from_project_id: string; ... };

// graph.ts
type BranchData = { id: string; name: string; ... };
type EdgeData = { id: string; from_scene_id: string | null; ... };
```

---

## 6. DATABASE SCHEMA

### Core Tables

| Table | Doel |
|-------|------|
| `profiles` | User profielen (linked to auth.users) |
| `projects` | Film projecten + fork lineage |
| `scenes` | Scenes binnen project |
| `contributions` | Pending contributions |
| `branches` | Named storylines |
| `scene_edges` | Graph connections tussen scenes |
| `cuts` | Presentation layer (reserved) |
| `decision_events` | Audit trail |

### Belangrijke Relaties

```
projects.director_id → profiles.id
projects.forked_by → profiles.id        # LET OP: 2 FK's naar profiles!
scenes.contributor_id → profiles.id
contributions.contributor_id → profiles.id
scene_edges.branch_id → branches.id
```

### FK Ambiguity Oplossing

Bij meerdere FK's naar dezelfde tabel, **altijd expliciet specificeren**:

```typescript
// ✅ CORRECT
.select('*, profiles!director_id(username)')

// ❌ FOUT - PostgREST weet niet welke FK
.select('*, profiles(username)')
```

---

## 7. DEVELOPMENT WORKFLOW

### Lokale Setup

```bash
git clone https://github.com/MinakamiMario/MakeMoviesAI.git
cd MakeMoviesAI
npm install
cp .env.example .env.local
# Vul NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_ANON_KEY in
npm run dev
```

### Voor Elke Wijziging

1. **`npm run build`** - TypeScript check (belangrijker dan `npm run dev`)
2. **Smoke test** - Browse projects, open project, test accept/fork
3. **Check console** - Geen FK ambiguity errors, geen undefined access

### Commit Conventie

```
type(scope): korte beschrijving

- Detail 1
- Detail 2
```

Types: `feat`, `fix`, `refactor`, `docs`, `chore`

Voorbeelden:
```
refactor(project): extract presentational components
fix(decisions): add safety guards to handleFork
feat(timeline): add branch switcher
```

### Refactor Regels

1. **Types-first**: Definieer interfaces voordat je implementeert
2. **Kleine commits**: Eén verantwoordelijkheid per commit
3. **Geen halve refactors**: Pas af als alle consumers gemigreerd zijn
4. **Build check**: Elke commit moet `npm run build` passeren

---

## 8. VEELVOORKOMENDE TAKEN

### Nieuwe Component Toevoegen

1. Maak `src/components/NieuweComponent.tsx`
2. Maak `src/components/NieuweComponent.module.css`
3. Importeer types uit `@/types`
4. Geen Supabase calls in component

### Nieuwe Data Toevoegen aan Project Page

1. Extend `ProjectPageData` type in `projectLoader.ts`
2. Voeg query toe aan `loadProjectData()`
3. Voeg state toe aan `page.tsx`
4. Geef door als prop aan component

### Nieuwe Mutation Toevoegen

1. Definieer result type in `decisions.ts`
2. Implementeer functie met error handling
3. Log naar `decision_events` indien relevant
4. Return `{ success, error }` patroon

### Type Toevoegen

1. Voeg toe aan `src/types/entities.ts` of `graph.ts`
2. Export via `src/types/index.ts`
3. Importeer via `@/types`

---

## 9. KNOWN ISSUES & GOTCHAS

### TypeScript Set Iteration

```typescript
// ✅ CORRECT
for (const item of Array.from(mySet)) { }

// ❌ FOUT (TS config issue)
for (const item of mySet) { }
```

### Supabase Single vs Array

```typescript
// .single() returned object of null
const { data } = await supabase.from('projects').select().eq('id', id).single();
// data: Project | null

// Zonder .single() returned array
const { data } = await supabase.from('projects').select().eq('id', id);
// data: Project[] | null
```

### CSS Module Import

```typescript
// ✅ CORRECT
import styles from './Component.module.css';

// ❌ FOUT
import './Component.css';
```

---

## 10. ROADMAP

### ✅ Phase 1: Core Polish (Voltooid)
- [x] Types centralisatie (`src/types/`)
- [x] JSX extraction (ProjectHeader, SceneTimeline, PendingContributions)
- [x] Data centralisatie (`projectLoader.ts`, `decisions.ts`)
- [x] Database cleanup (forks tabel, test projecten)

### 🔄 Phase 1.5: Stabiliteit (Huidig)
- [ ] RLS sanity check (graph tabellen)
- [ ] Error boundaries + user-friendly errors
- [ ] Loading/empty states per component

### Phase 2: UI Polish
- [ ] Consistent button states (loading, disabled)
- [ ] Skeleton loaders
- [ ] Toast notifications
- [ ] Mobile responsive

### Phase 3: Branching UI
- [ ] Branch switcher in timeline
- [ ] Create branch vanaf scene
- [ ] Visual diff tussen branches

### Phase 4: Collaboration
- [ ] Comments op scenes
- [ ] Notifications
- [ ] Role-based permissions

---

## 11. SUPABASE CONFIGURATIE

### Project Details
- **Project ID:** dicdmlcrhnunhgltiabg
- **Region:** eu-west-1
- **Dashboard:** https://supabase.com/dashboard/project/dicdmlcrhnunhgltiabg

### RLS Policies Overzicht

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| projects | everyone | authenticated | director | director |
| scenes | everyone | authenticated | director | director |
| contributions | everyone | authenticated | contributor | - |
| branches | authenticated | director | director | director |
| scene_edges | authenticated | director | director | director |
| cuts | authenticated | director | director | director |
| decision_events | authenticated | actor | - | - |

**Let op:** `decision_events` is append-only (geen UPDATE/DELETE).

### RPC Functions

| Function | Auth | Permissions |
|----------|------|-------------|
| `fork_contribution(uuid)` | authenticated | SECURITY DEFINER (bypasst RLS) |

**fork_contribution:** Alleen callable door director van source project. Interne auth check via `projects.director_id = auth.uid()`.

---

## 12. TESTING CHECKLIST

### Na Elke Refactor

- [ ] `npm run build` slaagt
- [ ] Browse `/projects` laadt
- [ ] Project detail laadt met scenes
- [ ] Contribution indienen werkt
- [ ] Accept contribution werkt
- [ ] Fork contribution werkt
- [ ] Decision log toont events
- [ ] Lineage tree toont forks

### Console Errors (Mogen Niet Voorkomen)

- `Could not embed because more than one relationship` → FK ambiguity
- `Cannot read property 'username' of null` → Null check missing
- `profiles is not a function` → Verkeerde query syntax

---

## APPENDIX A: Migraties

| Datum | Naam | Wijziging |
|-------|------|-----------|
| 29-12-2024 | `create_graph_schema` | branches, scene_edges, cuts tabellen |
| 29-12-2024 | `backfill_graph_data` | Data migratie naar graph model |
| 30-12-2024 | `drop_deprecated_forks_table` | Verwijder oude forks tabel |
| 30-12-2024 | `add_fork_contribution_rpc` | Server-side fork RPC met SECURITY DEFINER |

---

## APPENDIX B: Changelog

### 30-12-2024 (Middag)
- **Fork RPC**: Server-side `fork_contribution()` met SECURITY DEFINER
- **RLS fix**: Fork werkte niet door `director_id != auth.uid()` conflict
- **decisions.ts**: Fork logic verplaatst naar server (201 → 113 regels)

### 30-12-2024 (Avond)
- **Data centralisatie**: `projectLoader.ts` + `decisions.ts`
- **page.tsx**: 340 → 179 regels (-47%)
- **Guards**: Safety checks in handleAccept/handleFork

### 30-12-2024 (Middag)
- **JSX extraction**: ProjectHeader, SceneTimeline, PendingContributions
- **page.tsx**: 388 → 316 regels

### 30-12-2024 (Ochtend)
- **Types centralisatie**: `src/types/` folder
- **Database cleanup**: 4 test projecten, forks tabel

### 29-12-2024
- **Graph schema**: branches, scene_edges, cuts
- **Fork lineage**: Columns toegevoegd aan projects
- **Decision tracking**: decision_events tabel

---

## APPENDIX C: Contacten & Resources

- **Repository:** https://github.com/MinakamiMario/MakeMoviesAI
- **Live:** https://app.makemoviesai.com
- **Supabase:** Project ID `dicdmlcrhnunhgltiabg`
- **Vercel:** Auto-deploy vanuit `main` branch

---

*Document laatst bijgewerkt: 30 december 2024, 12:45*
