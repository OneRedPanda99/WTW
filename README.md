# WTW? — What to Watch

Swipe through movies and shows so WTW learns your taste, keep a watchlist, and (soon) find picks you and someone else will both like.

Built with Next.js 16, Supabase (database + email sign-in) and TMDB (movie data).

## How taste works

- **Ratings** (👎 didn't like / 👍 liked / ❤️ loved) are the only thing that shapes your taste profile.
- **Watchlist** items don't count. When you hit **Watched it** and rate one, it moves off the watchlist and into your ratings.
- **Haven't seen** on the swipe deck just hides the card. It has no effect on taste.

## Setup

### 1. TMDB API token
1. Make a free account at https://www.themoviedb.org/signup
2. Go to Settings → API, request a key (choose "Personal" / non-commercial)
3. Copy the **API Read Access Token** (the long one)

### 2. Supabase project
1. Sign up at https://supabase.com and create a new project (free tier)
2. **SQL Editor** → New query → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: add `http://localhost:3000/**`
4. **Project Settings → API** (or the **Connect** button): copy the Project URL and the anon / publishable key

### 3. Environment
Copy `.env.local.example` to `.env.local` and fill in the three values.

### 4. Run it
```bash
npm install
npm run dev
```
Open http://localhost:3000 and sign in with your email (open the link in the same browser).

## Pages

| Page | What it does |
|---|---|
| `/swipe` | Endless deck. Come back any time; it only shows titles you haven't answered. Keyboard: ← → ↑ ↓, W, Z |
| `/watchlist` | Things to watch. **Watched it** → rate → moves into your taste |
| `/search` | Find a specific title to rate or save |
| `/profile` | Your name, taste profile, and every rating (change or remove) |

## Notes

- Supabase's built-in email sender only allows a few sign-in emails per hour. That's fine for a handful of users. Add custom SMTP in Supabase if you hit the limit.
