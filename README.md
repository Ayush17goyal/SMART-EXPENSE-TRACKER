# Pocketwise

Pocketwise is a student financial intelligence platform. It explains spending changes, models month-end pressure, identifies unusual and recurring expenses, answers bounded questions from actual records, and lets students test decisions in a financial digital twin.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Choose **Explore the demo** for a complete synthetic story, or **Start on this device** for private IndexedDB storage.

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Cloud setup

The app works without cloud services. To enable invite-only accounts:

1. Create development and pilot Supabase projects.
2. Review and apply `supabase/migrations/202610010001_initial.sql`.
3. Add invited, lowercase email addresses to `pilot_invites` before users register.
4. Deploy the `finance` Edge Function and set `APP_ORIGIN`.
5. Optionally set server-only `OPENAI_API_KEY` and `OPENAI_MODEL`. Never expose these as `VITE_*` variables.
6. Copy `.env.example` to `.env.local` and set the public project URL and anonymous key.

The OpenAI path sends only the user's question and an already calculated answer, sets `store: false`, cannot query the database, and falls back to deterministic wording. AI consent is off by default.

## Data and security model

- INR is represented as integer paise; financial calculations never use an LLM.
- Device mode remains in the browser and includes versioned backup/restore.
- Cloud data is scoped by Supabase Auth and row-level security.
- Writes use optimistic revision checks.
- Raw prompts and transactions are not logged by the application.
- The deployment includes CSP, clickjacking, MIME-sniffing, referrer, and permissions headers.
- Before a real pilot, verify hosting regions and contracts, restore a backup in a staging project, run the Supabase security advisor, document provider backup retention, and complete an India privacy/legal review.

## Demo

Open the synthetic demo, inspect the month-end pressure and its evidence, then open Explore and ask “Can I afford to spend ₹2,000 this weekend?” Change the purchase in the digital twin and compare 1, 3, 6, and 12-month effects. Confirm a recurring candidate or create a goal in Plan. No API key is needed.
