# ⚔️ Tic Tac Toe — 1v1 Real-Time Multiplayer

A fast, modern online 1v1 Tic-Tac-Toe game designed for mobile and desktop. Play with friends anywhere in real-time with **zero account creation**, **zero database**, and **100% peer-to-peer relay sync**.

---

## 🎮 Play Live (Easy to Remember Links)

- **Primary Short URL:** [https://ttt-mini.vercel.app](https://ttt-mini.vercel.app)
- **Alternative PvP URL:** [https://ttt-pvp.vercel.app](https://ttt-pvp.vercel.app)
- **Personal Alias:** [https://lyhuor-ttt.vercel.app](https://lyhuor-ttt.vercel.app)
- **GitHub Repository:** [https://github.com/NgoytryLyhuor/tic-tac-toe](https://github.com/NgoytryLyhuor/tic-tac-toe)

---

## ⚡ How the Game Works

The game operates over **secure WebSocket MQTT relays** without requiring any traditional backend, database, or server storage. The match code acts as a private, real-time sync topic (`tictactoe-mini/v1/room/<CODE>`).

```text
[ Player 1: Host (X) ]  <--->  [ Public MQTT Secure WebSocket Relay ]  <--->  [ Player 2: Guest (O) ]
(Authoritative State)                    (QoS 1 Message Sync)                  (Optimistic UI + Retry)
```

### 👑 Roles & Architecture

#### 1. Host (Player X)
- **Creation**: The first player to enter a match code (e.g. `PLAY7`) probes the relay. If nobody is hosting, they become the authoritative **Host** and play as **X**.
- **State Authority**: The host holds the single source of truth for:
  - `room.board`: 9-cell board state
  - `room.turn`: Active player's turn (`'X'` or `'O'`)
  - `room.starter`: Player who makes the first move in this round
  - `room.round`: Current round number (Round 1, 2, 3...)
  - `room.scores`: Match record (`{ X: wins, O: wins, draws: ties }`)
  - `room.version`: Monotonically increasing state version
- **Validation**: All moves and rematch requests are validated by the host to eliminate turn races or board desync.
- **Session Persistence**: The host token and active room state are cached in `sessionStorage` (`saveHostSession`). If the host refreshes their browser page, they seamlessly reconnect to the same match with zero downtime and without kicking the guest.
- **Heartbeat**: Broadcasts authoritative state every 2 seconds and on every move.

#### 2. Guest (Player O)
- **Joining**: The second player to enter the same code hears the host's probe, announces itself with a `hello` packet, and is seated as **O**.
- **Seat Fingerprint**: The guest is assigned a hashed fingerprint (`seatO`), allowing the guest to refresh their browser tab and immediately reclaim their seat without losing their spot.
- **Optimistic UI**: When the guest taps a valid empty cell, the mark displays immediately with zero perceived latency. The guest queues a pending move and retries every 1.5s until the host's version confirms it.
- **Deduplication**: Each action has a unique `actionId`. The host recognizes duplicates and safely re-acknowledges them without duplicating turns.

#### 3. ⚖️ Fair Alternating Starter Rule
Traditional Tic-Tac-Toe heavily favors the first player (X). To make matches 100% fair across rounds:
- **Round 1:** Host (**X**) starts first.
- **Round 2:** Guest (**O**) starts first on the clean board.
- **Round 3:** Host (**X**) starts first.
- **Round 4:** Guest (**O**) starts first.
- Both players see explicit round announcements: `Round 2 • Guest (O) started first` and `Next round: You start first!`.

#### 4. 🏆 Live Scoreboard & Rematches
- Tracks cumulative **Player X Wins**, **Player O Wins**, and **Ties (Draws)** across consecutive games.
- Scores persist across rematches until either player taps **Leave Room**.
- Rematch requests update optimistically: as soon as you tap **Play Again**, your status updates to *"Waiting for opponent..."* or *"Opponent wants a rematch!"*.

#### 5. 🛡️ Mobile App Backgrounding / Refresh Protection
- In mobile browsers and Telegram Mini App, switching apps (e.g. switching to WhatsApp or Telegram to send an invite link) triggers browser `pagehide`.
- Destructive room closing on `pagehide` is disabled. The room only closes when a player explicitly taps the **Leave Room** button.
- If a player loses internet connection, the watchdog heartbeat alerts both players (`Reconnecting…`), and automatically resumes once the network restores.

---

## 🎨 UI / UX Features

- **Sharp 5px Corners**: Clean, modern aesthetic with a uniform `5px` corner radius across cards, tiles, inputs, buttons, and badges.
- **Compact Mobile-First Layout**: Redesigned to fit completely within mobile viewports (even with browser URL bars or Telegram Mini App frames) with **zero vertical scrolling required**.
- **Self-Contained Web Audio Synthesizer**: Pure Web Audio API sounds for moves, victory fanfare, draw/loss chords, and button clicks with **0 external downloads**. Includes a one-tap mute toggle button (`🔊 / 🔇`) in the header.
- **Haptic Vibration**: Physical tactile feedback on moves and wins (`navigator.vibrate` + Telegram Mini App `HapticFeedback`).
- **One-Tap Share & Random Code**:
  - `🎲 Random` button on the Home screen to roll instant 5-character match pins.
  - Native **Web Share API** (`navigator.share`) on mobile to send invite links directly to WhatsApp, Telegram, or SMS, with 1-tap clipboard fallback.
- **Animated SVG Marks & Strike Line**:
  - Pop-in SVG cross (`✕`) and circle (`○`) with vibrant neon glow.
  - Dynamic animated SVG strike-through beam connecting the 3 winning squares.

---

## 🛠️ Project Structure

```text
tic-tac-toe/
├── index.html                   # Mobile-optimized viewport, Telegram WebApp script
├── package.json                 # Scripts: dev, build, preview, test
├── vite.config.js               # Vite build config with Vue plugin
├── test/
│   ├── gameLogic.test.js        # Unit tests for fair turns, score counters, win detection
│   ├── host-refresh.test.js     # Tests host session persistence in sessionStorage
│   └── e2e-session.test.js      # End-to-end 2-player MQTT network simulation
└── src/
    ├── App.vue                  # Main app shell, sound management, Web Share & routing
    ├── style.css                # 5px corner radius system, compact mobile styles, cyber-glass theme
    ├── components/
    │   ├── HomeScreen.vue       # Match code entry, random code generator, 3-step guide
    │   ├── LobbyScreen.vue      # Waiting room with radar beacon, copy/share buttons
    │   └── GameScreen.vue       # Scoreboard, turn banner, 3x3 board, SVG strike line, rematch
    └── lib/
        ├── gameLogic.js         # Core rules, alternating starter logic, win calculations
        ├── gameSession.js       # P2P MQTT client, host/guest protocol, retry/dedup engine
        ├── player.js            # Player IDs and host session storage
        ├── sound.js             # Web Audio API sound synthesizer & mute toggle
        └── telegram.js          # Telegram Mini App wrapper with version safety guards
```

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run unit and E2E tests
npm test

# 3. Start local development server
npm run dev
```

Open the printed URL (typically `http://localhost:5173`) in two browser tabs (or one normal and one incognito tab). Enter the same match code in both windows to play 1v1.

---

## 🤖 Running as a Telegram Mini App

1. Message **@BotFather** on Telegram and run `/newbot` to create your bot.
2. Run `/newapp`, select your bot, and enter your live URL: `https://ttt-mini.vercel.app`.
3. Provide a title (e.g. `Tic Tac Toe`) and short name (e.g. `play`).
4. Set the menu button via `/setmenubutton` pointing to `https://ttt-mini.vercel.app`.
5. Launch your game instantly directly inside Telegram!

---

## 🌐 Public MQTT WebSocket Relays

The game connects to these free public relays in priority order:

1. `wss://broker.emqx.io:8084/mqtt`
2. `wss://broker.hivemq.com:8884/mqtt`
3. `wss://mqtt-dashboard.com:8884/mqtt`
