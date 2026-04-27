# Consensus — Frontend

> Next.js web client for the AI-powered business acquisition intelligence platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI Library | React 19 |
| Styling | Tailwind CSS 4 |
| Component Kit | Radix UI + shadcn/ui |
| Icons | Lucide React |
| Animations | Motion (Framer Motion) |
| Charts | Recharts |
| Auth | Supabase Auth (`@supabase/supabase-js`) |
| Markdown | react-markdown + remark-gfm |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** (ships with Node)
- A running [Consensus backend](../backend) instance
- Supabase project credentials

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` (or `.env.local`) file in this directory:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Run the dev server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create an optimized production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint across the codebase |
| `npm run clean` | Clear the `.next` build cache |

---

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (providers, global styles)
│   ├── page.tsx            # Dashboard overview (/)
│   ├── globals.css         # Global styles & Tailwind config
│   ├── chat/
│   │   └── page.tsx        # General AI chat
│   ├── deal/
│   │   ├── page.tsx        # Deal feed (browse, filter, search)
│   │   └── [id]/
│   │       └── page.tsx    # Deal detail (financials, evaluation, chat)
│   ├── login/
│   │   └── page.tsx        # Login page
│   ├── signup/
│   │   └── page.tsx        # Sign-up page
│   └── profile/
│       └── page.tsx        # User profile
│
├── components/             # Shared React components
│   ├── AuthProvider.tsx    # Auth context & session management
│   ├── DealCacheProvider.tsx # Client-side deal list caching
│   ├── DealChatBox.tsx     # Deal-scoped AI chat widget
│   ├── PageShell.tsx       # App shell (sidebar, header, navigation)
│   ├── ThemeProvider.tsx   # Dark/light theme context
│   ├── deal-chat.css       # Deal chat widget styles
│   └── ui/                 # shadcn/ui primitives
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── table.tsx
│
├── hooks/
│   └── use-mobile.ts      # Responsive breakpoint hook
│
├── lib/
│   ├── supabase.ts         # Supabase client initialisation
│   └── utils.ts            # Shared utility functions (cn, etc.)
│
├── middleware.ts           # Auth guard — redirects unauthenticated users to /login
├── public/                 # Static assets
│   └── tuckers-arrow-logo.svg
│
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── postcss.config.mjs      # PostCSS / Tailwind pipeline
├── eslint.config.mjs       # ESLint configuration
├── components.json         # shadcn/ui configuration
└── package.json
```

---

## Pages

| Route | Description |
|---|---|
| `/` | **Dashboard** — KPI snapshot, criteria funnel, source yield, priority queue, SLA panel, and data quality metrics |
| `/deal` | **Deal Feed** — paginated browsing with filters (source, industry, geography, financial ranges), sorting, semantic search, and AI fit scores |
| `/deal/[id]` | **Deal Detail** — listing overview, financial breakdown, AI evaluation (fit score, pros/cons, summary), evaluation refresh, and deal-scoped AI chat |
| `/chat` | **AI Chat** — streaming general-purpose assistant |
| `/login` | **Login** — Supabase email/password authentication |
| `/signup` | **Sign Up** — new account registration |
| `/profile` | **Profile** — user profile management |

---

## Authentication

Authentication is handled via **Supabase Auth**. The `middleware.ts` auth guard protects all routes except `/login` and `/signup` — unauthenticated users are redirected to the login page with a `?redirect=` param to restore their original destination after sign-in.

The `AuthProvider` component wraps the entire app and manages session state, user resolution, login, signup, and logout flows.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Base URL of the Consensus backend API |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |

---

## Connecting to the Backend

The frontend communicates with the [Consensus backend](../backend) via REST APIs. All API calls are prefixed with the value of `NEXT_PUBLIC_API_URL`.

For local development, run the backend on port `8000`:

```bash
# In the backend directory
python3 -m uvicorn api.main:app --reload
```

Then set `NEXT_PUBLIC_API_URL=http://localhost:8000` in your frontend `.env`.

