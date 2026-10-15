---
name: azure-ai-foundry
description: >
  Replaces any existing AI provider (OpenAI, Anthropic, etc.) in a Next.js app with an Azure AI
  Foundry agent. Handles credential collection, client setup, chat route replacement, and frontend
  migration from streaming to fetch-based chat. Covers all known failure modes so the integration
  works first time. Trigger when the user says "switch to Azure", "use Azure AI Foundry",
  "integrate Azure agent", or "replace OpenAI with Azure".
---

## Purpose

Replace the existing AI provider with an Azure AI Foundry agent. Collect credentials, audit the codebase, and make all required changes across the backend client, API route, and frontend chat components.

---

## Step 0 — Collect credentials before writing any code

Use `AskUserQuestion` to get both values. Do not write a single file until you have them.

### AZURE_API_KEY
Direct the user to: Azure AI Foundry portal → open their project → Settings (left sidebar) → API keys → copy the key value.

### AZURE_AGENT_ENDPOINT
Direct the user to: Azure AI Foundry portal → open their project → Agents (left sidebar) → open their agent → copy the Endpoint field.

The correct endpoint comes from the Agents section, ends with `/responses`, and contains `services.ai.azure.com` in the domain — not `openai.azure.com`. Warn the user explicitly: do not use the Azure OpenAI resource URL, do not use the project inference URL, and do not append anything to the endpoint they copy from the portal.

---

## Step 1 — Audit the existing codebase

Read and identify before changing anything:
- Which file is the chat API route and what AI client it currently uses
- Whether the frontend uses the Vercel AI SDK streaming hook (`useChat` from `ai/react`)
- What AI-related environment variables currently exist in `.env.local`
- Whether the `openai` npm package is already installed

---

## Step 2 — Add credentials to `.env.local`

Append both values to the project's `.env.local`. Neither value goes anywhere else — not in `.env`, not committed to source control.

---

## Step 3 — Create the Azure client file

Create `lib/azure.ts` as a singleton that initialises an OpenAI-compatible client pointed at the Azure agent endpoint. The client uses the `openai` npm package (not `@ai-sdk/openai`). Install it if not present.

Critical implementation details:
- The `AZURE_AGENT_ENDPOINT` value from the portal ends with `/responses`. The OpenAI SDK appends `/responses` automatically when you call the responses API. Strip the trailing `/responses` from the URL before passing it as `baseURL`, otherwise every request doubles the path and returns 405.
- Pass the API key in both the standard field and as a custom `api-key` request header — Azure requires both.
- Set the API version query parameter. Before hardcoding a value, check the official Azure AI Foundry documentation or the Azure SDK changelog for the latest supported `api-version` on the agent responses endpoint. As of mid-2025 the working value was `2025-05-15-preview` — but preview versions rotate. If the request returns a "API version not supported" error, the version is stale: look up the current one in the Azure AI Foundry REST API reference and update it. Never guess a version — use what the docs confirm.

---

## Step 4 — Rewrite the chat API route

Replace the existing route entirely. Key rules for calling the Azure agent:

- Set `export const runtime = 'nodejs'` and `export const maxDuration = 60` at the top of the route file. Azure agent calls can take 20–30 seconds. Without the Node.js runtime declaration the route runs on the Edge runtime which has a shorter timeout and will cut the request off.
- Use `openai.responses.create`, not `chat.completions.create`. The agent endpoint speaks the Responses API.
- Do not pass a `model` field. The agent has a model configured in Azure AI Foundry — passing one causes a rejection error. However, the OpenAI SDK TypeScript types require `model` on `responses.create`. To resolve this conflict, cast `openai.responses` to `any` before calling `.create()` — this bypasses the type check without changing runtime behaviour.
- Do not pass an `instructions` or `system` field. The agent has its own system prompt defined in the portal — passing instructions causes a "not allowed when agent is specified" error.
- Send only an `input` array with a single user message. Bundle all context — contract text, extracted key terms, and the user's question — into that one message. The agent reads it all.
- Return plain JSON with the assistant's reply and the persisted message IDs. Do not return a stream.
- Wrap all database writes (session creation, message saving) in try/catch. If the chat tables do not exist in the schema, the request should still succeed and return the AI response — null IDs are acceptable.
- Surface the real Azure error message in the response JSON when the call fails. Never silently return a generic fallback — the actual error text is needed to diagnose credential and endpoint problems.
- Do not declare variables to hold the Azure error outside the catch block. Declare and use the error only inside the catch scope to keep TypeScript strict mode happy.

---

## Step 5 — Migrate the frontend

The route now returns JSON instead of a stream, so `useChat` from `ai/react` will not work. Replace it with local React state and a plain `fetch` call.

Manage messages as local state in the component. On submit, optimistically append the user message, call the API, then append the assistant response when it arrives. Show a loading indicator while waiting.

When syncing loading state to a Zustand store, always select individual action functions using a selector function rather than subscribing to the full store object. Subscribing to the full store object creates an unstable reference that changes on every render, causing an infinite re-render loop.

---

## Step 6 — Clean up old AI dependencies

Remove any imports, routes, or hooks that used the previous provider. Keep the `openai` package — the Azure client depends on it.

---

## Step 7 — Test before reporting back to the user

Do not tell the user the integration is done until every check below passes. Fix any failure before moving on.

**TypeScript check** — Run `npx tsc --noEmit`. Zero errors required. Any error means something in the implementation is wrong — fix it before proceeding.

**No streaming remnants** — Search the entire codebase for `useChat`, `ai/react`, `streamText`, and `toDataStreamResponse`. None of these should appear in any chat-related component or route. If any are found, remove them.

**No unused error variables** — Confirm that no variable is declared outside a try/catch block solely to hold an Azure error. Error detail should be declared and used only inside the catch scope.

**Environment variables present** — Confirm both `AZURE_API_KEY` and `AZURE_AGENT_ENDPOINT` exist and are non-empty in `.env.local`. If either is blank the client will throw on the first request.

**Live API test** — With the dev server running, send a real POST request to the chat endpoint with a valid contract ID and a test message. Check the response contains `assistantMessage` with actual text from the agent — not the fallback string and not an error field. If you cannot make an authenticated request directly, instruct the user to open the chat panel in the browser, send one message, and report the response back before you declare success.

**Zustand selector check** — Confirm that every `useEffect` in chat components that references a store action uses an individual selector, not the full store object. The full store object in deps causes an infinite re-render loop that only surfaces at runtime, not in TypeScript.

Only after all six checks pass, proceed to the Completion step.

---

## Known errors and how to fix them

**"Missed model deployment"** — The endpoint being used is the Azure OpenAI resource URL, not the agent URL. Get the correct endpoint from Agents in the AI Foundry portal.

**405 Method Not Allowed** — The `AZURE_AGENT_ENDPOINT` already ends with `/responses` and the SDK appended it again. Strip the trailing `/responses` from the URL before using it as `baseURL`.

**"Not allowed when agent is specified"** — The request includes `instructions`, `model`, or `system` fields. The agent rejects any attempt to override its configuration. Remove all of them and put context into the `input` message only.

**401 Unauthorized** — The `api-key` custom header is missing. Ensure it is set in `defaultHeaders` on the client alongside the standard auth.

**"API version not supported"** — The `api-version` query parameter is outdated. Look up the current supported version in the Azure AI Foundry REST API reference and update it — do not guess or reuse the version from this skill verbatim, as preview versions change.

**"Missing required parameter: model"** — The wrong endpoint is being used. This error comes from the project inference URL, not the agent endpoint. Switch to the agent endpoint from the Agents section.

**TypeScript error on responses.create** — The OpenAI SDK types require a `model` field on `responses.create`, but Azure rejects it at runtime. Cast `openai.responses` to `any` before calling `.create()` to satisfy the compiler without affecting runtime behaviour.

**Route times out or fails on Edge runtime** — The Azure agent can take 20–30 seconds to respond. Ensure the route file declares `export const runtime = 'nodejs'` and `export const maxDuration = 60`, otherwise Next.js runs it on the Edge runtime which cuts the connection too early.

**Infinite React re-render** — The full Zustand store object is in a `useEffect` dependency array. Replace it with individual selectors for each action needed.

**null message IDs in response** — The chat sessions or chat messages tables do not exist in the database schema. This is not fatal — handle it gracefully and return null IDs without failing the request.

---

## Completion

When done, confirm: the Azure client file exists, the chat route is rewritten and TypeScript is clean, the frontend has no remaining `useChat` or `ai/react` imports, both env vars are in `.env.local`, and the dev server has been restarted.

Then tell the user:
> "Azure AI Foundry agent is wired up. Restart the dev server, open the chat panel, and send a message to verify the agent responds. If you get an error, the full error message will appear in the response JSON — share it and I'll fix it."
