---
name: frontend-setup
description: >
  Scaffolds a complete Next.js 14 (App Router) project with TypeScript by writing all necessary
  files, creates a styled landing page, and runs the app end to end.
  Use this skill whenever the user asks to:
  - Set up a Next.js project or folder structure
  - Create a Next.js app for a lesson or class session
  - Bootstrap a Next.js environment with all dependencies
  - Get a Next.js landing page up and running
  - Start a new Next.js project (even casually, e.g. "let's set up Next.js" or "new Next app")
  Trigger this skill immediately when the user mentions Next.js setup or starting
  a Next.js project — even if they say it casually like "let's set up Next".
---

# Next.js Setup Skill

Your job is to scaffold a complete Next.js 14 (App Router) project end to end
by writing all files manually, then guiding the user to start the dev server.

**Default stack: Next.js 14 + TypeScript.** If the PRD specifies a different tech stack, confirm with the user before using it. Never switch stacks silently.

Do every step in order. Do not skip any step.

---

## Step 1 — Check the PRD / Engineering Doc for stack overrides

Before asking the user anything, read `docs/engineering/engineering-doc.md` if it exists. Look for:
- Framework preference (Next.js version, Remix, Vite, etc.)
- Language preference (TypeScript vs JavaScript)
- Any additional dependencies called out (UI library, state management, etc.)

Then follow this decision tree:

**If the PRD specifies a different tech stack** (e.g. JavaScript instead of TypeScript, Vite instead of Next.js, a different framework):
- Use `AskUserQuestion` to confirm with the user before proceeding:
  - **Question:** "The PRD specifies [X]. Would you like to use that, or stick with the default (Next.js 14 + TypeScript)?"
  - **Options:** "Use [X] from the PRD" / "Use the default (Next.js 14 + TypeScript)"
- Use whichever option the user picks and apply it throughout all steps below.

**If the PRD is silent or does not exist:**
- Use the defaults: **Next.js 14, TypeScript**. No need to ask the user anything about the stack.

---

## Step 2 — Ask the user about the project folder

Use the `AskUserQuestion` tool to ask the user:

**Question:** "Where would you like to set up the Next.js project?"
**Header:** "Project folder"
**Options:**
- **Create a new folder** — Scaffold a fresh `nextjs-app` folder (recommended for a clean start)
- **Use an existing folder** — Work inside a folder the user already has; ask them to type the folder path

If they choose **Create a new folder**: proceed with `nextjs-app` as the project directory inside the outputs folder.

If they choose **Use an existing folder**: ask them to provide the path, then use that path as the project root. Still write all the same files into it (overwriting any that already exist).

---

## Step 3 — Set up the project folder

Based on the user's answer from Step 2:
- **New folder**: Create `nextjs-app/` and `nextjs-app/app/` inside the outputs directory.
- **Existing folder**: Use the path they provided; create an `app/` subfolder inside it if it doesn't exist.

---

## Step 4 — Write `package.json`

```json
{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  }
}
```

---

## Step 5 — Write `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## Step 6 — Write `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

---

## Step 7 — Write `app/layout.tsx`

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Built with Next.js 14 App Router',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
```

---

## Step 8 — Write `app/globals.css`

Include hover classes here so `page.tsx` never needs JS event handlers (which crash in Server Components).

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.btn-primary {
  padding: 0.75rem 2rem;
  border-radius: 999px;
  background: #00c6ff;
  color: #0f0c29;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  display: inline-block;
  transition: transform 0.2s;
}
.btn-primary:hover { transform: scale(1.05); }

.btn-ghost {
  padding: 0.75rem 2rem;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: #ffffff;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  display: inline-block;
  transition: border-color 0.2s;
}
.btn-ghost:hover { border-color: rgba(255, 255, 255, 0.9); }
```

---

## Step 9 — Write `app/page.tsx` (the landing page)

> **IMPORTANT — Server Component rule:** `app/page.tsx` is a React Server Component by default in Next.js 14.
> Never use `onMouseOver`, `onMouseOut`, `onClick`, or any other JS event handler props on elements here.
> Those props are only valid in Client Components (`'use client'`).
> Use CSS classes from `globals.css` for all hover and interactive effects instead.

```tsx
import './globals.css'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
      color: '#ffffff',
      textAlign: 'center',
      padding: '2rem',
    }}>
      <h1 style={{
        fontSize: '3.5rem',
        fontWeight: 800,
        marginBottom: '1rem',
        background: 'linear-gradient(90deg, #00c6ff, #a78bfa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        Hello, Next.js
      </h1>
      <p style={{
        fontSize: '1.25rem',
        color: '#a8b2d8',
        maxWidth: '520px',
        lineHeight: 1.8,
        marginBottom: '2rem',
      }}>
        Your Next.js 14 app is up and running with the App Router and TypeScript. Let's build something amazing.
      </p>
      <a
        href="https://nextjs.org/docs"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
      >
        Read the Docs
      </a>
    </main>
  )
}
```

---

## Step 10 — Show the final folder structure

Tell the user what was created:

```
nextjs-app/
├── next.config.mjs
├── package.json
├── tsconfig.json
└── app/
    ├── layout.tsx      ← root layout (metadata, html/body tags)
    ├── globals.css     ← global styles
    └── page.tsx        ← your landing page
```

---

## Step 11 — Run the app (end to end)

Run it in the background:

```bash
cd <project-path> && nohup npm install && npm run dev -- --port 3000 > /tmp/nextjs-app.log 2>&1 &
sleep 8 && cat /tmp/nextjs-app.log
```

**If the server starts successfully**, tell the user:
> Your Next.js app is live at **http://localhost:3000** — open it in your browser!

**If npm is blocked or the server fails**, give the user these commands to run in their own terminal:

```bash
cd nextjs-app
npm install && npm run dev
```

Then tell them:
> Once it starts, open **http://localhost:3000** in your browser to see the landing page.

---

## Notes

- **TypeScript is hardcoded.** All files always use `.tsx` / `.ts`. Never use `.jsx` or `.js` regardless of what the PRD or user requests.
- If the project folder already exists, delete it and start fresh.
- Replace `<project-path>` with the actual absolute path to the project directory.
- Port 3000 is Next.js's default. If it's in use, try 3001.
- This scaffold uses the **App Router** (`app/` directory), which is the modern default since Next.js 13+. Do NOT use the old `pages/` directory unless the user explicitly asks.
- Do NOT explain every file in detail — just confirm each one was written, then move on.
- **NEVER use JS event handler props (`onMouseOver`, `onMouseOut`, `onClick`, etc.) in `app/page.tsx` or any other Server Component.** Next.js App Router files are Server Components by default — passing event handlers to them throws a build error: _"Event handlers cannot be passed to Client Component props."_ Always use CSS classes from `globals.css` for hover and interactive effects in Server Components. Only add `'use client'` at the top of a file when the component genuinely needs React state, effects, or browser event handlers.
