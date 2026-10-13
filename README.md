# Daily Bread

Daily Bread is a static devotional web app for quiet reading, prayer, community conversation, and journaling. It combines a local content layer with optional Vercel Gemini AI and Supabase-powered account, chat, and file-sharing features.

## Overview

This project keeps the experience lightweight and deployable on a static host such as Vercel:

- `index.html`: daily devotional reading, date tracking, and reading streaks
- `prayer-room.html`: prayer prompts, breathing guidance, and personal prayer archive
- `chat.html`: AI companion experience using `/api/gemini` with a local fallback
- `sign-in.html`: email/password sign-in, sign-up, and password reset
- `community.html`: authenticated community chat using Supabase Realtime
- `library.html`: public journal library with authenticated upload and download access

Daily content is stored in `assets/database.json`. Reading progress, prayer notes, and theme choices live in the browser via `localStorage`.

## Features

- Wallpaper mode with a blurred, readability-shaded background, dark mode, and white mode
- Daily devotionals and verse-based reading flow
- Prayer room with breathing cue and saved prayer entries
- Gemini AI companion with a server-side API key
- Supabase login flow with email authentication
- Community chat for signed-in members
- Journal library for public PDF viewing and authenticated uploads

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

The browser calls `/api/gemini`, so the API key stays server-side. The companion requires this route and does not substitute scripted replies if the key or Gemini service is unavailable.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/).
2. In **Project Settings > API**, copy the Project URL and publishable key into `assets/supabase-config.js`.
3. In **Authentication > Providers**, enable Email.
4. In **Authentication > URL Configuration**, add your Vercel URL to the allowed redirect URLs.
5. Open **SQL Editor** and paste/run `supabase-schema.sql`.

The schema creates:

- `community_messages` table
- `journals` table
- public Storage bucket for PDFs
- Row-level security policies
- Realtime support for community messages

Email/password sign-up, sign-in, and password reset live in `sign-in.html`.

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
