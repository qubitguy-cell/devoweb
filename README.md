# Daily Bread

Daily Bread is a static devotional web app for quiet reading, prayer, community conversation, and journaling. It combines a local content layer with optional Vercel Gemini AI and Supabase-powered account, chat, and file-sharing features.

## Overview

This project keeps the experience lightweight and deployable on a static host such as Vercel:

- `index.html`: daily devotional reading, date tracking, and reading streaks
- `prayer-room.html`: prayer prompts, breathing guidance, and personal prayer archive
- `chat.html`: AI companion experience using `/api/gemini`
- `sign-in.html`: email/password sign-in, sign-up, and password reset
- `account.html`: authenticated profile details and editable community identity
- `community.html`: authenticated community chat using Supabase Realtime
- `library.html`: public journal library with authenticated upload and download access

Daily content is stored in `assets/database.json`. Reading progress, prayer notes, and theme choices live in the browser via `localStorage`.

## Features

- Wallpaper mode with a blurred, readability-shaded background, dark mode, and white mode
- Daily devotionals and verse-based reading flow
- Prayer room with breathing cue and saved prayer entries
- Gemini AI companion with a server-side API key
- Supabase login flow with email authentication
- Account profile with editable email, display name, uploaded avatar, short bio, scholar listing, and sign-in dates
- Community chat for signed-in members
- Counseling directory, private requests, and notifications
- Journal library for public PDF viewing, authenticated uploads, and owner editing/deletion

## Deployment and local development

This project is designed for static hosting, but some features require HTTP access.

1. Install the Vercel CLI if needed.
2. Run `vercel dev` from the project root for local testing.
3. Open the site via `http://localhost:3000` or a deployed Vercel URL.
4. Do not open the site only through `file://`; browser fetches and serverless routes will not work properly.

## Gemini setup

1. Create a Gemini API key in Google AI Studio.
2. In Vercel, add `GEMINI_API_KEY` as an environment variable for the project.
3. Optionally set `GEMINI_MODEL`; the default is `gemini-2.5-flash`.
4. Redeploy after changing environment variables.

The browser calls `/api/gemini`, so the API key stays server-side. The companion requires this route and does not substitute scripted replies if the key or Gemini service is unavailable. Run the app through `vercel dev` locally and set `GEMINI_API_KEY` in the Vercel environment.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/).
2. In **Project Settings > API**, copy the Project URL and publishable key into `assets/supabase-config.js`.
3. In **Authentication > Providers**, enable Email.
4. In **Authentication > URL Configuration**, add your Vercel URL to the allowed redirect URLs.
5. For a new project, open **SQL Editor** and run `supabase-schema.sql` once.
6. When updating an existing project, run only the new policy statements at the end of `supabase-schema.sql` (the block beginning with `drop policy if exists "Members can update their own community messages"`). Do not paste over or reset existing tables.

The schema creates:

- `community_messages` table
- `journals` table
- public Storage bucket for PDFs
- Row-level security policies
- Realtime support for community messages
- Owner-only deletion policies for community messages, published journals, journal PDFs, and notifications
- Participant-only deletion policy for private counseling requests
- Owner-only update policies for community messages and published journal details

Email/password sign-up, sign-in, and password reset live in `sign-in.html`.

For account deletion on Vercel, configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` as server environment variables. The service-role key is used only by `/api/delete-account` and must never be added to browser code. Redeploy after adding the variables. Users can edit their display name, profile, scholar listing, avatar, and email from Account; Supabase may require email confirmation. Private prayer entries are stored in the browser and can be individually deleted there.

## Journal library rules

The `library.html` page lists public PDFs stored in Supabase Storage and indexed in the `journals` table.

- Anyone can view or download public files.
- Signed-in users can upload PDFs up to 15 MB.
- File type, uploader ownership, size, and metadata checks are enforced in `supabase-schema.sql`.
- Only upload files you have permission to share.

## Security notes

- Never expose a `service_role` key in the browser.
- Keep secrets in Vercel environment variables, not client code.
- Use HTTPS in production and verify redirect URLs in Supabase.

## Repository note

Original repository: **devoweb**, a devotional web app for meditation and reflection.
