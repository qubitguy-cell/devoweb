# Daily Bread

An evolution of the original devotional web for meditation project.

Static devotional pages with a Vercel Gemini proxy and Supabase-powered accounts, community chat, and PDF journal library. There is no build step; browser modules load Supabase JS from a CDN.

## Gemini companion

1. Create a Gemini API key in Google AI Studio.
2. In Vercel, add `GEMINI_API_KEY` as an environment variable for the project. Optionally set `GEMINI_MODEL` to another supported Gemini model; the default is `gemini-2.5-flash`.
3. Redeploy after adding or changing environment variables. The browser calls `/api/gemini`; the key stays on the server.

For local Vercel development, install the Vercel CLI and run `vercel dev` from this folder. Opening the HTML directly with `file://` will not support JSON fetches or serverless routes.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com/).
2. In **Project Settings > API**, copy the Project URL and publishable key (or legacy `anon` key) into `assets/supabase-config.js`. These are public browser credentials; never use a `service_role` key in this site.
3. In **Authentication > Providers**, enable Email. Under **Authentication > URL Configuration**, add your Vercel URL to the allowed redirect URLs. Configure email confirmation as you prefer.
4. Open **SQL Editor**, paste and run `supabase-schema.sql`. It creates the `community_messages` and `journals` tables, row-level security policies, the public `journals` Storage bucket, and upload/download policies. It also enables Realtime for community messages.
5. Deploy the project to Vercel over HTTPS. For local testing, use `vercel dev`; opening pages with `file://` does not support API and module requests.

Email/password signup, sign-in, and password reset are on `sign-in.html`. If email confirmation is enabled, members must confirm using the Supabase email before signing in.

## Gemini companion

Set `GEMINI_API_KEY` in Vercel project environment variables. Optionally set `GEMINI_MODEL`; the default is `gemini-2.5-flash`. Redeploy after changing environment variables. The browser calls `/api/gemini`, so the Gemini key remains server-side.

## Journal library

The `library.html` route lists public PDFs stored in Supabase Storage and indexed in the `journals` table. Anyone can view/download shared files; signed-in users can upload PDFs up to 15 MB. The SQL setup validates uploader ownership, file type, size, and metadata limits. Only share PDFs you have permission to distribute and that contain no sensitive information.

## Navigation and themes

All pages share a collapsible top-right menu and a light/dark theme toggle. The chosen theme is saved in localStorage on the current browser.

## Pages

- `index.html`: daily devotional, reading streak, and read state.
- `prayer-room.html`: preset prayers, breathing guide, and local prayer archive.
- `chat.html`: Gemini companion with local JSON keyword responses as an offline fallback.
- `sign-in.html`: email/password account creation, sign-in, and password reset.
- `community.html`: realtime group chat for authenticated members.
- `library.html`: public PDF journal library with authenticated uploads.

The community table is readable only to authenticated members; messages store a display name, not an email. The library and its files are public to anyone who can open the site. Upload permissions and file limits are enforced in `supabase-schema.sql`.

Daily content lives in `assets/database.json`. Streaks, read state, and personal prayer entries live in the visitor's browser localStorage.