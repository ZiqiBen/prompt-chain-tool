# Pattern / Prompt Studio

A separate Next.js prompt chain tool for the public Pattern application and its admin area.

## Features

- Google sign-in; every page, mutation, and run endpoint checks `profiles.is_superadmin`.
- Create, read, edit, and delete prompt chains and their steps.
- Move steps up/down with atomic, per-chain database transactions.
- Run the actual ordered workflow with Gemini. The previous output becomes the next step's context.
- Optional PNG/JPEG/WebP input under 3 MB, sent to the first step only.
- Live step progress, persisted intermediate outputs, final text, copy, and text download.
- View generated media for one chain or across all chains. Run snapshots survive later edits and chain deletion.
- Light, dark, and system appearance, stored locally and updated when the system theme changes.

## Local setup

Use Node.js 24. Run `npm ci`, copy `.env.example` to `.env.local`, and set the existing project's Supabase URL/public key and a server-only Gemini key. No service-role key is used.

Apply `supabase/studio.sql` in the Supabase SQL Editor after the existing admin migrations. It creates run-history tables, restricts data access, and installs transactional step operations. It does not change existing prompt content. `supabase/check.sql` verifies CRUD, reordering, and role enforcement in a transaction that is rolled back.

Enable Google sign-in in Supabase. Allow `http://localhost:3003/auth/callback`, the deployed production callback, and this project's commit deployment callbacks. Add each callback origin to the same Supabase project's redirect allowlist. Google itself uses the existing Supabase `/auth/v1/callback` URI.

Run `npm run dev -- --port 3003`. Sign in with an existing superadmin profile.

## Prompts

Available variables: `{{input}}`, `{{user_question}}`, `{{previous_output}}`, `{{step_1}}` (or another earlier step), and `{{preferred_language}}`. Original input and previous output are also automatically supplied. Forward/unknown references fail with an explanatory message. A chain supports up to 20 steps; each prompt/input supports up to 12,000 characters.

Generation uses the server's `GEMINI_MODEL` or `gemini-2.5-flash` by default. Steps can instead select an active Gemini entry from `llm_models`. Provider failures are reported and saved; no placeholder outputs are substituted. Images are sent transiently to Gemini and are not saved in the database.

## Checks

`npm test` exercises variable interpolation, actual step-to-step context, execution order, image handling, provider failures, and thought filtering. `npm run lint` and `npm run build` check the complete application.

## Vercel

Import this repository as its own Vercel project. Configure the variables in `.env.example` for Production and Preview. Disable Vercel deployment protection for grading; application authentication remains enabled. Submit the immutable deployment URL associated with the latest commit, together with the latest public-app and admin-app deployment URLs.
