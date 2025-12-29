# MakeMoviesAI - Project Handover Document

**Datum:** 29 december 2024
**Repository:** https://github.com/MinakamiMario/MakeMoviesAI
**Live URL:** https://app.makemoviesai.com
**Supabase Project:** dicdmlcrhnunhgltiabg (eu-west-1)

---

## 1. VISIE & CONCEPT

### Wat is MakeMoviesAI?

MakeMoviesAI is een **collaboratief filmmaking platform** waar meerdere mensen samen aan een film kunnen werken. Het unieke aan dit platform is hoe het omgaat met **creatieve conflicten**: in plaats van dat afgewezen bijdragen verdwijnen, worden ze omgezet in **forks** - nieuwe projecten met eigen eigenaarschap.

### Core Value Proposition (voor acquirers)

Het platform demonstreert drie kernconcepten die interessant zijn voor AI/media bedrijven:

1. **Fork-based conflict resolution**: Afgewezen werk verdwijnt niet, maar wordt een alternatieve storyline
2. **Explicit decision states**: Elke creatieve beslissing is traceerbaar (accept/fork)
3. **Traceable lineage**: Volledige herkomst van elk project en elke scene

### GitHub-model voor Films

Net zoals GitHub branching gebruikt voor code:
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

### Project Structuur

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/page.tsx              # Auth
│   ├── signup/page.tsx             # Auth
│   ├── dashboard/page.tsx          # User's projects
│   └── projects/
│       ├── page.tsx                # Browse all projects
│       ├── new/page.tsx            # Create project
│       └── [id]/
│           ├── page.tsx            # Project detail (MAIN FILE)
│           ├── add-scene/page.tsx  # Director adds scene
│           └── contribute/page.tsx # Contributor submits
├── components/
│   ├── ContributionCard.tsx        # Collapsed contribution preview
│   ├── ContributionReview.tsx      # Modal for accept/fork decision
│   ├── DecisionLog.tsx             # Audit trail of decisions
│   ├── LineageTree.tsx             # Fork visualization
│   └── MediaUpload.tsx             # File upload component
└── lib/
    ├── supabase/
    │   ├── client.ts               # Browser client
    │   └── server.ts               # Server client
    └── graph.ts                    # Branch/edge utility functions
```

---

## 3. DATABASE ARCHITECTUUR

### Core Tables

#### `profiles`
Gebruikersprofielen (gekoppeld aan Supabase Auth).
```sql
- id (uuid, PK, references auth.users)
- username (text, unique)
- created_at (timestamptz)
```

#### `projects`
Filmprojecten.
```sql
- id (uuid, PK)
- title (text)
- description (text)
- director_id (uuid, FK profiles) -- eigenaar
- created_at (timestamptz)
-- Fork lineage columns:
- forked_from_project_id (uuid, FK projects)
- forked_at_branch_id (uuid, FK branches)
- forked_at_scene_id (uuid, FK scenes)
- forked_from_contribution_id (uuid, FK contributions)
- forked_by (uuid, FK profiles)
```

#### `scenes`
Scenes binnen een project.
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- title (text)
- description (text)
- media_url (text) -- Supabase Storage URL
- scene_order (int) -- legacy, nu via edges
- contributor_id (uuid, FK profiles)
- created_at (timestamptz)
```

#### `contributions`
Ingediende bijdragen (pending review).
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- title (text)
- description (text)
- media_url (text)
- contributor_id (uuid, FK profiles)
- parent_scene_id (uuid, FK scenes) -- waar dit op aansluit
- status (text: 'pending', 'accepted', 'forked')
- created_at (timestamptz)
```

### Graph Tables (Branching Architectuur)

#### `branches`
Named storylines binnen een project.
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- name (text, default 'Main')
- description (text)
- is_default (boolean) -- exact 1 per project
- is_archived (boolean)
- forked_from_branch_id (uuid, FK branches) -- in-project branching
- fork_point_scene_id (uuid, FK scenes)
- created_by (uuid, FK profiles)
- created_at (timestamptz)

-- Constraint: UNIQUE (project_id) WHERE is_default = true
```

#### `scene_edges`
Graph-based scene connections (vervangt lineaire scene_order).
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- branch_id (uuid, FK branches)
- from_scene_id (uuid, FK scenes, NULL = start)
- to_scene_id (uuid, FK scenes)
- created_by (uuid, FK profiles)
- created_at (timestamptz)

-- Constraints:
-- UNIQUE (branch_id, from_scene_id) -- max 1 outgoing per node
-- UNIQUE (branch_id, to_scene_id)   -- max 1 incoming (linear)
-- UNIQUE (branch_id) WHERE from_scene_id IS NULL -- 1 start per branch
-- CHECK (from_scene_id IS NULL OR from_scene_id <> to_scene_id) -- no self-loop
```

#### `cuts`
Presentation layer (reserved for future).
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- name (text, default 'Default')
- is_default (boolean)
- created_by (uuid, FK profiles)
- created_at (timestamptz)
```

#### `decision_events`
Audit trail van alle accept/fork beslissingen.
```sql
- id (uuid, PK)
- project_id (uuid, FK projects)
- actor_id (uuid, FK profiles)
- event_type (enum: 'accept_contribution', 'fork_contribution')
- contribution_id (uuid, FK contributions)
- result_scene_id (uuid, FK scenes) -- bij accept
- result_new_project_id (uuid, FK projects) -- bij fork
- metadata (jsonb) -- extra context
- created_at (timestamptz)
```

### Legacy Tables (Te Deprecaten)

#### `forks` (DEPRECATED)
Oude fork tracking - data is gemigreerd naar `projects` kolommen.
```sql
- original_project_id
- new_project_id
- forked_by
- forked_from_contribution_id
- created_at
```
**Status:** Kan verwijderd worden nadat bevestigd is dat alle data in `projects` staat.

#### `media_assets`
Media tracking - mogelijk redundant met Supabase Storage.

---

## 4. KERNFUNCTIONALITEIT

### User Flows

#### Flow 1: Project Aanmaken
1. User gaat naar `/projects/new`
2. Vult titel + beschrijving in
3. Systeem maakt:
   - Project record
   - Default "Main" branch (is_default=true)
   - Default cut (reserved)
4. Redirect naar project detail

#### Flow 2: Scene Toevoegen (Director)
1. Director klikt "+ Add scene" op `/projects/[id]`
2. Upload media + titel/beschrijving
3. Systeem maakt:
   - Scene record
   - Edge van laatste scene (of NULL) naar nieuwe scene
4. Timeline toont nieuwe scene

#### Flow 3: Contribution Indienen (Contributor)
1. Non-director ziet "+ Submit a contribution"
2. Upload media + titel/beschrijving
3. Systeem maakt contribution met:
   - `parent_scene_id` = laatste scene in default branch
   - `status` = 'pending'
4. Director ziet contribution in "Pending Contributions"

#### Flow 4: Accept Contribution
1. Director klikt op contribution card
2. Modal toont: parent scene → proposed scene
3. Director klikt "Accept"
4. Systeem:
   - Maakt scene van contribution
   - Maakt edge naar nieuwe scene
   - Update contribution status → 'accepted'
   - Logt decision_event (accept_contribution)

#### Flow 5: Fork Contribution
1. Director klikt op contribution card
2. Modal toont context + impact uitleg
3. Director klikt "Fork"
4. Systeem maakt:
   - Nieuw project met fork lineage
   - Default branch + cut voor nieuw project
   - Kopieert alle bestaande scenes + edges
   - Voegt contribution toe als laatste scene
   - Update contribution status → 'forked'
   - Logt decision_event (fork_contribution)
5. Contributor wordt director van nieuw project

---

## 5. KEY COMPONENTS

### `src/lib/graph.ts`
Utility functies voor graph operations:
- `getDefaultBranch(supabase, projectId)` - Haalt default branch op
- `getBranchEdges(supabase, branchId)` - Haalt alle edges van branch
- `buildSceneOrder(edges)` - Traverseert linked list naar ordered array
- `findLastSceneId(edges)` - Vindt scene zonder outgoing edge
- `createEdge(...)` - Maakt nieuwe edge
- `createDefaultBranch(...)` - Maakt Main branch
- `createDefaultCut(...)` - Maakt Default cut

### `src/app/projects/[id]/page.tsx`
Hoofdbestand (~425 regels). Bevat:
- Project loading via graph (niet scene_order)
- Contribution review modal
- handleAccept / handleFork logic
- Timeline rendering
- LineageTree + DecisionLog integratie

**Let op FK specificatie in queries:**
```typescript
// CORRECT - expliciet FK bij meerdere relaties
.select('*, profiles!director_id(username)')
.select('*, profiles!contributor_id(username)')

// FOUT - ambiguous bij meerdere FK's naar profiles
.select('*, profiles(username)')
```

### `src/components/ContributionReview.tsx`
Modal voor contribution review:
- Toont parent scene context
- Toont proposed contribution
- Impact uitleg (accept vs fork)
- Accept/Fork buttons (alleen voor director)

### `src/components/DecisionLog.tsx`
Audit trail component:
- Toont chronologische lijst van beslissingen
- Badge: Accepted (groen) / Forked (blauw)
- Link naar geforkt project

### `src/components/LineageTree.tsx`
Fork visualisatie:
- Parent project (indien fork)
- Current project (highlighted)
- Child forks

---

## 6. BELANGRIJKE TECHNISCHE BESLISSINGEN

### Waarom Graph Model (scene_edges) ipv Lineaire scene_order?

**Probleem:** Lineaire `scene_order` ondersteunt geen branching binnen een project.

**Oplossing:** Graph-based model met `scene_edges` tabel:
- Elke edge verbindt twee scenes
- `from_scene_id = NULL` betekent start van branch
- Traversal via linked list
- Constraints garanderen lineariteit binnen branch

**Trade-off:** Complexere queries, maar schaalt naar echte branching.

### Waarom Branch ≠ Fork als Aparte Concepten?

| Concept | Scope | Ownership | Use Case |
|---------|-------|-----------|----------|
| Branch | Binnen project | Zelfde director | "Happy Ending" vs "Dark Ending" |
| Fork | Nieuw project | Nieuwe director | Afgewezen contribution krijgt eigen leven |

Dit is cruciaal voor:
- Juridische helderheid (wie bezit wat)
- UX clarity (contributor wordt director na fork)
- Acquisition story (clean ownership model)

### Waarom Explicit FK in Supabase Queries?

Na toevoegen van `forked_by` FK naar `profiles` ontstonden 2 relaties:
- `projects.director_id → profiles.id`
- `projects.forked_by → profiles.id`

PostgREST weet dan niet welke te gebruiken. Oplossing:
```typescript
.select('*, profiles!director_id(username)')
```

### Waarom `cuts` Tabel Nu Al (Terwijl Niet Gebruikt)?

**Anticipatie:** Later wil je "cuts" = presentaties van branches. Als je nu alleen `is_default` op branches zet, ga je dat later misbruiken.

**Clean model:**
- Branch = storyline (data)
- Cut = presentatie/selectie (view)

---

## 7. HUIDIGE STATUS

### Wat Werkt ✅

| Feature | Status |
|---------|--------|
| User auth (signup/login) | ✅ |
| Project CRUD | ✅ |
| Scene toevoegen (director) | ✅ |
| Media upload (video/image) | ✅ |
| Contribution indienen | ✅ |
| Contribution review modal | ✅ |
| Accept contribution | ✅ |
| Fork contribution | ✅ |
| Decision audit log | ✅ |
| Lineage tree | ✅ |
| Graph-based timeline | ✅ |
| Branch/cut schema | ✅ |

### Wat Nog Niet Werkt / TODO 🔧

| Feature | Status | Notes |
|---------|--------|-------|
| In-project branching UI | ❌ | Schema klaar, UI niet |
| Branch switcher | ❌ | Alleen default branch wordt getoond |
| Cuts (presentation layer) | ❌ | Tabel bestaat, geen UI |
| Parent scene selector bij contribute | ❌ | Nu altijd laatste scene |
| Permissions/roles | ❌ | Nu alleen director vs contributor |
| Notifications | ❌ | |
| Comments/discussion | ❌ | |
| Search/filter projects | ❌ | |
| User profile pages | ❌ | |

### Bekende Issues 🐛

1. **4 projecten zonder branch**: Aangemaakt tussen migratie en nieuwe code. Fix: run backfill opnieuw of handmatig branches aanmaken.

2. **`forks` tabel deprecated**: Data staat nu in `projects` kolommen, maar oude tabel bestaat nog.

---

## 8. ROADMAP (Suggesties)

### Phase 1: Core Polish
- [ ] Fix projecten zonder branch (backfill)
- [ ] Drop `forks` tabel
- [ ] Parent scene selector bij contribute
- [ ] Error handling verbeteren
- [ ] Loading states

### Phase 2: Branching UI
- [ ] Branch switcher in timeline
- [ ] "Create branch" vanaf een scene
- [ ] Branch list/management
- [ ] Visual diff tussen branches

### Phase 3: Collaboration
- [ ] Comments op scenes
- [ ] Notifications (nieuwe contribution, accepted, forked)
- [ ] Contributor invites
- [ ] Role-based permissions

### Phase 4: Presentation
- [ ] Cuts implementeren
- [ ] "Watch" mode (film playback)
- [ ] Export naar video
- [ ] Public/private projects

### Phase 5: AI Integration
- [ ] AI scene suggestions
- [ ] Auto-tagging
- [ ] Script-to-scene
- [ ] Scene continuation generation

---

## 9. DEVELOPMENT SETUP

### Vereisten
- Node.js 18+
- npm of yarn
- Supabase account (of self-hosted)

### Local Development

```bash
# Clone repo
git clone https://github.com/MinakamiMario/MakeMoviesAI.git
cd MakeMoviesAI

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local
# Vul in:
# NEXT_PUBLIC_SUPABASE_URL=https://dicdmlcrhnunhgltiabg.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# Run dev server
npm run dev
```

### Supabase Access

- **Dashboard:** https://supabase.com/dashboard/project/dicdmlcrhnunhgltiabg
- **Region:** eu-west-1
- **Tables:** Zie sectie 3

### Deployment

Vercel auto-deploys vanuit `main` branch.

---

## 10. CODING CONVENTIONS

### File Organization
- Max ~150 regels per file (richtlijn)
- Components in `src/components/`
- Utility functions in `src/lib/`
- CSS Modules naast component

### Naming
- Components: PascalCase (`ContributionCard.tsx`)
- Utilities: camelCase (`graph.ts`)
- CSS: `Component.module.css`

### Supabase Queries
- Altijd explicit FK bij joins: `profiles!director_id`
- Type assertions waar nodig: `as ContributionData[]`
- Error handling bij mutations

### TypeScript
- Explicit types voor props en state
- `type` voor data shapes
- Avoid `any` waar mogelijk

---

## 11. CONTACT & RESOURCES

- **Repository:** https://github.com/MinakamiMario/MakeMoviesAI
- **Live:** https://app.makemoviesai.com
- **Supabase:** Project ID `dicdmlcrhnunhgltiabg`

---

## APPENDIX A: Migraties Uitgevoerd

### 1. `create_graph_schema` (29-12-2024)
- Created `cuts` table
- Created `branches` table
- Created `scene_edges` table
- Added fork columns to `projects`
- Created all constraints and indexes
- Created RLS policies

### 2. `backfill_graph_data` (29-12-2024)
- Created default "Main" branch per project
- Created scene_edges from scene_order
- Created default cut per project
- Backfilled fork lineage from `forks` table

---

## APPENDIX B: RLS Policies

Alle tabellen hebben Row Level Security enabled:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| projects | everyone | authenticated | director | director |
| scenes | everyone | authenticated | director | director |
| contributions | everyone | authenticated (own) | contributor | - |
| branches | authenticated | director | director | director |
| scene_edges | authenticated | director | director | director |
| cuts | authenticated | director | director | director |
| decision_events | authenticated | actor | - | - |

---

*Document gegenereerd: 29 december 2024*
