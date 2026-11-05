# Tic Tac Toe — play with a friend

A tiny online tic-tac-toe game. One player creates a match with a code (for example `1234`),
sends that code to a friend, and the friend enters the same code to join the same board.

- **Frontend:** Vue 3 + Vite
- **API:** one serverless function (`api/game.js`), works locally and on Vercel
- **Storage:** Upstash Redis over REST in production (in-memory fallback for local dev)
- **Bonus:** works as a Telegram Mini App (the Telegram WebApp script is already loaded)

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually <http://localhost:5173>). Open it in two browser windows
(or one normal + one incognito, so each gets its own player id), create a match in the
first window, then enter the same code in the second.

No database is needed locally — rooms are kept in memory by the dev server.

## How it works

| Step | What happens |
| --- | --- |
| Player 1 enters code `1234` | `POST /api/game?action=join` creates the room, player 1 gets **X** |
| Player 2 enters `1234` | Same call fills the open seat, player 2 gets **O**, the round starts |
| Moves | `POST /api/game?action=move` validates the player, the turn, and the square |
| Board updates | Both clients poll `GET /api/game?action=state` every 1.5s (only while waiting) |
| Rematch | `POST /api/game?action=rematch`; the board resets when both players accept |
| Leaving | `POST /api/game?action=leave` frees the seat for a new opponent |

Player identity is a random id stored in `localStorage`. The room only stores each
player's id and display name — the opponent's id is never exposed to the browser.

## Deploy to Vercel

### 1. Push the code

The repo for this project is <https://github.com/NgoytryLyhuor/tic-tac-toe>.

### 2. Import the repo in Vercel

In <https://vercel.com/new>, import the repository. Vercel detects Vite automatically:

- Build command: `npm run build`
- Output directory: `dist`
- The `api/` folder becomes serverless functions automatically.

### 3. Add shared storage (required for real two-device play)

Serverless functions do not share memory, so two players can land on different instances.
Add a free Redis database:

1. Create a database at <https://upstash.com> (free tier).
2. Open the database → **REST API** and copy the URL and token.
3. In Vercel → Project → **Settings → Environment Variables**, add:

   ```text
   UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
   UPSTASH_REDIS_REST_TOKEN=xxxxxxxx
   ```

4. Redeploy.

> If you skip this, the app still runs, but rooms are per-instance and the home screen
> shows a warning banner. Local development never needs Redis.

Redis keys are `ttt:room:<CODE>` and expire after 24 hours of inactivity.

### 4. Play

Open the deployment URL, create a match, and send the code (or the invite link that is
copied from the game screen) to your friend.

## Telegram Mini App (optional)

1. In Telegram, talk to **@BotFather** → `/newbot` to create a bot.
2. `/newapp` → choose the bot → provide the Vercel URL (must be **https**), a title,
   and a short name such as `play`.
3. `/setmenubutton` → attach the same Web App URL.
4. Open `https://t.me/<your-bot>/play`.

The app already calls `Telegram.WebApp.ready()` / `expand()`, uses the Telegram name as a
default player name, and uses haptic feedback where supported. Opening the site in a
normal browser works exactly the same.

## API reference

All endpoints live in `api/game.js`:

| Method | URL | Body | Purpose |
| --- | --- | --- | --- |
| GET | `/api/game?action=health` | – | `{ storage: "redis" \| "memory" }` |
| GET | `/api/game?action=state&code=1234&playerId=…` | – | current room |
| POST | `/api/game?action=join` | `{ code, playerId, name }` | create or join a room |
| POST | `/api/game?action=move` | `{ code, playerId, cell }` | play a square (0–8) |
| POST | `/api/game?action=rematch` | `{ code, playerId }` | vote for a rematch |
| POST | `/api/game?action=leave` | `{ code, playerId }` | free your seat |

## Project structure

```text
api/
  game.js       # the single HTTP handler (Vercel function + local dev middleware)
  _logic.js     # board rules, win detection, room helpers
  _store.js     # Redis REST client with in-memory fallback
src/
  App.vue       # screen routing, polling, actions
  components/   # Home, Lobby, Game screens
  lib/          # API client, player identity, Telegram helper
  style.css     # dark glassmorphism theme
```

## Scripts

```bash
npm run dev      # local dev server with the real API handler
npm run build    # production build
npm run preview  # preview the built SPA (no API — use dev or Vercel)
```
