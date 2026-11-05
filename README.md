# Tic Tac Toe — play with a friend

A tiny online tic-tac-toe game. One player creates a match with a code (for example `1234`),
sends that code to a friend, and the friend enters the same code to join the same board.

**Live:** <https://tic-tac-toe-ivory-eta-13.vercel.app>
**Repo:** <https://github.com/NgoytryLyhuor/tic-tac-toe>

- **Frontend:** Vue 3 + Vite (static build)
- **Transport:** MQTT over secure WebSockets using free public brokers
- **Backend / database:** none — no server, no account, no storage to provision
- **Bonus:** works as a Telegram Mini App (the Telegram WebApp script is already loaded)

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually <http://localhost:5173>). Open it in two browser windows
(or one normal + one incognito, so each gets its own player id), create a match in the
first window, then enter the same code in the second.

The game talks to the same public relays in local development and in production.
Nothing needs to be configured.

## How it works

There is no game server. Both phones connect to a public MQTT broker, and the match code
is used as the shared channel, so the two browsers talk to each other directly through the
relay.

| Step | What happens |
| --- | --- |
| Player 1 enters code `1234` | Their browser listens for ~1.6s; if nobody is hosting that code, it becomes the **host** and plays **X** |
| Player 2 enters `1234` | Their browser hears the host's state, announces itself, and is seated as **O** |
| Moves | The host validates every move and owns the authoritative board |
| Board updates | The host broadcasts the full room state on every change and every 2s heartbeat |
| Rematch | Both players opt in; the host resets the board when both have accepted |
| Leaving | The host announces a close, or the guest's seat is freed for a new opponent |

Design details:

- The host is authoritative, so there are no conflicting boards or turn races.
- If two devices create the same code at the same moment, they compare random host tokens
  and the smaller token keeps hosting; the other device quietly becomes the guest.
- A guest can refresh without losing its seat: the published state carries a salted
  fingerprint of the guest's player id so the browser can confirm it is still seated.
- Published state never includes raw player ids.
- If the first broker is unreachable, the client falls back to the next one automatically.
  The invite link carries `?code=…&b=…` so both players use the same relay.

### Relays

These free public brokers are used in order:

1. `wss://broker.emqx.io:8084/mqtt`
2. `wss://broker.hivemq.com:8884/mqtt`
3. `wss://mqtt-dashboard.com:8884/mqtt`

Topics look like `tictactoe-mini/v1/room/<CODE>`. Public brokers are best-effort: great for
playing with friends, not for anything private or competitive. Match codes are guessable,
so treat them as public rooms.

## Deploy to Vercel

The repo is <https://github.com/NgoytryLyhuor/tic-tac-toe>. Vercel detects Vite:

- Build command: `npm run build`
- Output directory: `dist`

No environment variables, database, or integration are required. Pushing to `main`
triggers a deployment, or run `vercel --prod` from the project folder.

## Telegram Mini App (optional)

1. In Telegram, talk to **@BotFather** → `/newbot` to create a bot.
2. `/newapp` → choose the bot → provide the Vercel URL (must be **https**), a title,
   and a short name such as `play`.
3. `/setmenubutton` → attach the same Web App URL.
4. Open `https://t.me/<your-bot>/play`.

The app calls `Telegram.WebApp.ready()` / `expand()`, uses the Telegram name as a default
player name, and uses haptic feedback where supported. Opening the site in a normal browser
works exactly the same.

## Project structure

```text
src/
  App.vue                    # screen routing and session lifecycle
  components/
    HomeScreen.vue           # code + name entry
    LobbyScreen.vue          # waiting room, code and invite link
    GameScreen.vue           # board, result, rematch
  lib/
    gameLogic.js             # board rules, room shape, win detection
    gameSession.js           # MQTT host/guest protocol and relays
    player.js                # local player id, name, last session
    telegram.js              # Telegram WebApp wrapper
  style.css                  # dark glassmorphism theme
```

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```
