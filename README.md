# 🎮 Game Arena — 1v1 Mobile & Telegram Mini App

A fast, modern dual-game web arena featuring **Barricade (Quoridor 9×9)** and **Tic Tac Toe (3×3 Online)**. Designed specifically for **Telegram Mini Apps**, mobile phones, and desktop browsers with **zero accounts**, **zero database**, and uniform **5px corner** styling.

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
     • 🤖 AI Bot + 👥 Pass & Play                   • 🌐 Real-time Online Sync
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
- 🤖 **Single Player vs AI**: Play solo against an intelligent A* pathfinder bot (Easy, Medium, Hard).
- 👥 **Pass & Play (2 Players)**: Take turns on the same mobile phone screen.

---

### Game 2: ✕○ Tic Tac Toe (3×3 Online)

A lightning-fast 1v1 multiplayer game synchronized across devices over peer-to-peer WebSocket MQTT relays:
- ⚖️ **Fair Alternating Turns**: Round 1 Host (**X**) starts, Round 2 Guest (**O**) starts, Round 3 Host (**X**) starts. Eliminates the first-mover advantage!
- 🏆 **Live Scoreboard**: Persistent win/tie tracking across consecutive rematches.
- 🔗 **Room Codes**: Share a 5-character code or 1-tap link to play from anywhere with no account required.
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

# 2. Run automated test suite (all 11 tests pass)
npm test

# 3. Start local dev server
npm run dev
```

Built with **Vue 3** and **Vite**. Deployed on **Vercel**.
