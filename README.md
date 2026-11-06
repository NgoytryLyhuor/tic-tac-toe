# 🎮 Game Arena — 1v1 Mobile & Telegram Mini App

A fast, modern dual-game web arena featuring **Barricade (Quoridor 9×9)** and **Tic Tac Toe (3×3)**. Designed specifically for **Telegram Mini Apps**, mobile phones, and desktop browsers with **zero accounts**, **zero database**, and uniform **5px corner** styling.

Both games feature **2 distinct ways to play**:
1. 🤖 **Play with Computer (Solo)** — Play alone anytime against intelligent AI bots!
2. 👥 **Play with 2 People (PvP)** — Challenge friends via online room codes or pass-and-play on the same phone screen!

---

## 🚀 Play Live (Easy to Remember Links)

- 🔗 **Personal Alias:** [https://lyhuor-ttt.vercel.app](https://lyhuor-ttt.vercel.app)
- 🧱 **Short Link:** [https://ttt-mini.vercel.app](https://ttt-mini.vercel.app)
- ⚔️ **PvP Link:** [https://ttt-pvp.vercel.app](https://ttt-pvp.vercel.app)
- 📦 **GitHub Repo:** [https://github.com/NgoytryLyhuor/tic-tac-toe](https://github.com/NgoytryLyhuor/tic-tac-toe)

When you open any link, you are greeted with the **Game Hub** to pick which game to play!

---

## 🎯 The 2 Featured Games

```text
                                  [ GAME HUB ]
                                       |
                +----------------------+----------------------+
                |                                             |
     [ 🧱 Barricade (Quoridor) ]                     [ ✕○ Tic Tac Toe ]
     • 9×9 Strategy Grid                            • 3×3 Instant Duel
     • Move Pawn or Drop Walls                      • Fair Alternating Turns
     • 🤖 AI Bot (Easy, Med, Hard)                  • 🤖 AI Bot (Easy, Med, Master)
     • 👥 Pass & Play (Local 2P)                    • 👥 PvP: Online & Pass-and-Play
```

---

### Game 1: 🧱 Barricade (Quoridor 9×9)
*Inspired by the viral TikTok gameplay from `@barricade.gg`.*

A deep, tactical abstract strategy game with **zero luck and zero dice**:

#### 1. The Goal
- **Player 1 (Red)** starts at the bottom row (row 8, center). Target: **Any square on the top row (row 0)**.
- **Player 2 (Blue / Bot)** starts at the top row (row 0, center). Target: **Any square on the bottom row (row 8)**.
- First pawn to cross the board to the opponent's starting side wins!

#### 2. Turn Rules (Pick 1 of 2 Actions)
On your turn, you must choose strictly **one action**:
1. **Move your Pawn**: Move 1 square orthogonally (Up, Down, Left, or Right).
   - **Straight Jump**: When facing your opponent head-to-head with no wall between you, you can jump directly over them!
   - **Diagonal Jump**: If a wall or the board edge blocks the straight jump behind them, you can jump diagonally to their left or right.
2. **Place a Wall**: Drop a wall into any free 2-cell groove on the board (horizontal or vertical) to obstruct your opponent's path.
   - Each player has **10 walls** for the match.
   - Walls block *both* players and stay permanently on the board.
   - **Golden Rule (No Trapping)**: You can never completely seal off a player. A wall placement is strictly illegal if it eliminates all open paths to the goal for either player (validated via live BFS pathfinding).

#### 3. Game Modes
- 🤖 **Option 1: Play with Computer (Solo)**: Play alone with an intelligent A* pathfinder bot (Easy, Medium, Hard).
- 👥 **Option 2: Play with 2 People (PvP)**: Pass & Play taking turns on the same mobile phone screen.

---

### Game 2: ✕○ Tic Tac Toe (3×3)

A lightning-fast, fair 3×3 game playable alone or with friends:

#### 1. Game Modes
- 🤖 **Option 1: Play with Computer (Solo)**:
  - **Easy**: Relaxed, casual bot for quick fun.
  - **Medium**: Blocks your winning lines and seizes opportunities.
  - **Master**: Unbeatable Minimax algorithm!
- 👥 **Option 2: Play with 2 People (PvP)**:
  - **Online 1v1**: Share a 5-character match code or invite link. Connected over instant peer-to-peer WebSocket MQTT relays (zero accounts or database needed).
  - **Pass & Play (Local 2P)**: Play together on the same phone screen offline.

#### 2. Core Rules & Fair Play
- ⚖️ **Fair Alternating Turns**: Round 1 Host (**X**) starts, Round 2 Guest (**O**) starts, Round 3 Host (**X**) starts. Eliminates the first-mover advantage!
- 🏆 **Live Scoreboard**: Persistent win/tie tracking across consecutive rematches.
- 🛡️ **App Backgrounding Protection**: Switching to WhatsApp/Telegram to send match codes won't disconnect or close the room.

---

## 📱 Mobile & Telegram Mini App Features

- **5px Corners Everywhere**: Minimalist, clean modern aesthetic with `--radius: 5px` applied to all cards, cells, inputs, buttons, and HUD elements.
- **Zero Vertical Scrolling on Phones**: Compact layout engineered to fit 100% within mobile viewports (even with browser URL bars or Telegram in-app frames).
- **Web Audio API Sound Engine**: Pure synthesized sound effects for footsteps, wall drops, button clicks, and victory fanfare with zero audio downloads + a top mute toggle (`🔊 / 🔇`).
- **Haptic Feedback**: Physical tactile vibration on moves and wins (`navigator.vibrate` + Telegram `HapticFeedback`).

---

## 🤖 Running inside Telegram

1. Open Telegram and message **@BotFather**.
2. Run `/newapp`, pick your bot, and enter your live URL: `https://lyhuor-ttt.vercel.app`.
3. Provide a title (e.g. `Game Arena`) and short name (e.g. `play`).
4. Set the menu button with `/setmenubutton` pointing to `https://lyhuor-ttt.vercel.app`.
5. Tap the menu button inside Telegram to launch and play immediately!

---

## 🛠️ Local Development & Testing

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (all 16 tests pass)
npm test

# 3. Start local dev server
npm run dev

# 4. Production build
npm run build
```
