import { computed, ref } from 'vue'

const STORAGE_LANG_KEY = 'minigames.lang'

function getInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY)
    if (saved === 'km' || saved === 'en') return saved
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (navigator.language.toLowerCase().startsWith('km')) return 'km'
    }
  } catch {}
  return 'en'
}

export const currentLang = ref(getInitialLang())

export function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'km') return
  currentLang.value = lang
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang)
    document.documentElement.lang = lang
  } catch {}
}

export function toggleLanguage() {
  const next = currentLang.value === 'en' ? 'km' : 'en'
  setLanguage(next)
  return next
}

export const messages = {
  en: {
    // Top Nav
    nav_games: 'Games',
    nav_barricade: 'Barricade',
    nav_ttt: 'Tic Tac Toe',
    nav_lang_label: 'ខ្មែរ',
    nav_sound_on: 'Sound On',
    nav_sound_off: 'Muted',

    // Game Hub
    hub_eyebrow: 'Online & Offline Arena',
    hub_title: 'Choose a Game',
    hub_lede: 'Play solo vs computer or 2 players with friends.',
    hub_tag_new_strategy: 'NEW • STRATEGY',
    hub_tag_classic_3x3: 'CLASSIC • 3X3',
    hub_barricade_title: 'Barricade (Quoridor)',
    hub_barricade_desc: 'Race across the 9×9 grid to reach the goal. Place 10 wooden barricades to block rivals!',
    hub_ttt_title: 'Tic Tac Toe',
    hub_ttt_desc: 'Classic 3×3 in a row. Play live online with friends via room codes or challenge smart AI!',
    chip_solo_ai: '🤖 vs Computer',
    chip_pvp: '👥 2 Players',
    chip_walls: '🧱 10 Walls',
    chip_room_codes: '🌐 Room Codes',
    chip_3_diff: '🧠 3 AI Levels',
    chip_pass: '📱 Pass & Play',
    btn_play_barricade: 'Play Barricade',
    btn_play_ttt: 'Play Tic Tac Toe',
    footer_note: 'Zero accounts or DB · Mobile & Telegram Mini App Ready',

    // Barricade Setup
    barricade_title: 'Barricade (Quoridor)',
    barricade_lede: 'Race your pawn to the opposite side. Place walls to trap your opponent!',
    tab_vs_computer: 'vs Computer',
    tab_pvp: '2 Players (PvP)',
    subtab_online: 'Online (2 Phones)',
    subtab_pass: 'Pass & Play',
    ai_diff_label: 'AI Difficulty',
    diff_easy: 'Easy',
    diff_medium: 'Medium ⭐',
    diff_hard: 'Hard ⚔️',
    diff_help: 'Smart pathfinding bot that builds barricades and shortcuts.',
    btn_play_ai: 'Play Solo vs AI',
    match_code_label: 'Match Code',
    match_code_placeholder: 'e.g. WALL8',
    match_code_hint: 'Share this code with your friend on their phone.',
    nickname_label: 'Your Nickname',
    nickname_placeholder: 'Your Name',
    btn_start_online: 'Start / Join Online Match',
    step_1: '1. Pick code',
    step_2: '2. Friend enters code',
    step_3: '3. Play live!',
    pass_desc: 'Take turns moving pawns and placing 10 wooden barricades on this same device. No internet required!',
    btn_start_pass: 'Start Pass & Play Match',
    btn_back_hub: '← Back to Games Hub',

    // Barricade In-Game
    btn_mode: '← Mode',
    btn_leave: '← Leave',
    btn_restart: 'Restart',
    btn_share: 'Share',
    btn_move: 'Move',
    btn_wall: 'Wall',
    btn_horiz: 'Horiz',
    btn_vert: 'Vert',
    round_badge: 'R',
    you_label: 'You',
    red_label: 'Red',
    blue_label: 'Blue',
    ai_label: 'AI Bot',
    turn_active: 'Turn Active',
    waiting: 'Waiting',
    winner_badge: 'Winner 🏆',
    finished_badge: 'Finished',
    your_turn_move: 'Your Turn — Tap green square to move',
    your_turn_wall: '🧱 Wall Mode: Tap golden dot to drop wall',
    ai_thinking: '🤖 AI is planning next move…',
    opp_thinking: "{name}'s turn — Waiting for opponent…",
    red_turn_pass: "Red's Turn — Tap green square to move",
    blue_turn_pass: "Blue's Turn — Tap green square to move",
    win_victory: '🏆 Victory! You reached the goal!',
    win_ai: '🤖 AI Won this round!',
    win_opp: 'Opponent reached the goal!',
    win_red: '🏆 Red Player Won!',
    win_blue: '🏆 Blue Player Won!',
    btn_rematch: '🔄 Request Rematch',
    btn_waiting_rematch: '⏳ Waiting for opponent rematch…',
    btn_play_again: '🔄 Play Again',
    rematch_note: 'Starter automatically alternates each round for fairness!',
    walls_title: 'Walls Left',

    // Barricade Lobby
    lobby_title: 'Waiting for Opponent',
    lobby_lede: 'Ask your friend to open the game and enter this code on their phone:',
    btn_share_link: '📤 Share Invite Link',
    btn_copy_code: '📋 Copy Code',
    btn_copied_code: '✓ Code Copied',
    btn_copy_link: '🔗 Copy Link',
    btn_copied_link: '✓ Link Copied',
    waiting_phone2: 'Waiting for Player 2 to join on phone 2…',
    btn_cancel_code: '← Cancel / Change Code',

    // Toast Notifications
    toast_code_min: 'Please enter a match code with at least 3 characters.',
    toast_no_walls: 'No walls remaining!',
    toast_block_all: 'Cannot block all paths to goal!',
    toast_illegal_move: 'Illegal move.',

    // Tic Tac Toe Screens
    ttt_home_eyebrow: 'Fast, Free, No Accounts',
    ttt_home_title: 'Online Tic Tac Toe',
    ttt_home_lede: 'Enter a match code, share with a friend, and play live in real-time.',
    ttt_room_code: 'Match Code',
    ttt_random_code: 'Random Code',
    ttt_share_hint: 'Pick any memorable word, or tap 🎲 for a random code.',
    ttt_your_name: 'Your Nickname',
    ttt_name_placeholder: 'e.g. Alex',
    ttt_btn_join: 'Start or Join Match',
    ttt_mode_online: 'Online PvP',
    ttt_mode_ai: 'vs Computer',
    ttt_mode_pass: 'Pass & Play',
    ttt_ai_easy: 'Easy',
    ttt_ai_medium: 'Medium ⭐',
    ttt_ai_master: 'Master 🧠',
    ttt_btn_solo: 'Play Solo vs AI',
    ttt_btn_pass: 'Play Pass & Play',
    ttt_connecting: 'Connecting to match…',
    ttt_connecting_sub: 'Linking up over secure peer-to-peer relay',
    ttt_lobby_share_btn: 'Share Invite Link',
    ttt_waiting_status: 'Waiting for opponent to join…',
    ttt_btn_change_code: '← Change Code / Play Solo',
    ttt_turn_mine: 'Your Turn',
    ttt_turn_opp: "Opponent's Turn",
    ttt_turn_x: "Player X's Turn",
    ttt_turn_o: "Player O's Turn",
    ttt_you_won: '🎉 You Won!',
    ttt_draw: '🤝 Draw Round!',
    ttt_opp_won: 'Opponent Won!',
    ttt_round: 'Round',
  },

  km: {
    // Top Nav
    nav_games: 'ហ្គេម',
    nav_barricade: 'បារីខេត',
    nav_ttt: 'ការ៉ូ 3x3',
    nav_lang_label: 'EN',
    nav_sound_on: 'បើកសំឡេង',
    nav_sound_off: 'បិទសំឡេង',

    // Game Hub
    hub_eyebrow: 'សង្វៀនអនឡាញ & ក្រៅបណ្តាញ',
    hub_title: 'ជ្រើសរើសហ្គេម',
    hub_lede: 'លេងម្នាក់ឯងជាមួយកុំព្យូទ័រ ឬ ២ នាក់ជាមួយមិត្តភក្តិ។',
    hub_tag_new_strategy: 'ថ្មី • យុទ្ធសាស្ត្រ',
    hub_tag_classic_3x3: 'បុរាណ • 3X3',
    hub_barricade_title: 'បារីខេត (Quoridor)',
    hub_barricade_desc: 'ដើរឆ្លងកាត់ក្រឡា 9×9 ទៅកាន់គោលដៅ។ ដាក់របាំងឈើ ១០ ដើម្បីរារាំងគូប្រកួត!',
    hub_ttt_title: 'ហ្គេមការ៉ូ (Tic Tac Toe)',
    hub_ttt_desc: 'ហ្គេម 3×3 បុរាណ។ បង្កើតបន្ទប់លេងអនឡាញជាមួយមិត្តភក្តិ ឬប្រកួតជាមួយ AI វៃឆ្លាត!',
    chip_solo_ai: '🤖 លេងទល់ AI',
    chip_pvp: '👥 ២ នាក់',
    chip_walls: '🧱 របាំង ១០',
    chip_room_codes: '🌐 កូដបន្ទប់',
    chip_3_diff: '🧠 កម្រិត AI ៣',
    chip_pass: '📱 ទូរស័ព្ទមួយ',
    btn_play_barricade: 'លេង Barricade',
    btn_play_ttt: 'លេង Tic Tac Toe',
    footer_note: 'មិនបាច់ចុះឈ្មោះ · គាំទ្រលើទូរស័ព្ទ & Telegram Mini App',

    // Barricade Setup
    barricade_title: 'បារីខេត (Quoridor)',
    barricade_lede: 'ដើរទៅដល់ត្រើយម្ខាងទៀតមុន។ ដាក់របាំងឈើដើម្បីរារាំងគូប្រកួត!',
    tab_vs_computer: 'លេងជាមួយកុំព្យូទ័រ',
    tab_pvp: 'លេង ២ នាក់ (PvP)',
    subtab_online: 'អនឡាញ (ទូរស័ព្ទ ២)',
    subtab_pass: 'ទូរស័ព្ទតែមួយ',
    ai_diff_label: 'កម្រិតលំបាក AI',
    diff_easy: 'ងាយ',
    diff_medium: 'មធ្យម ⭐',
    diff_hard: 'ពិបាក ⚔️',
    diff_help: 'AI វៃឆ្លាតចេះដើរផ្លូវកាត់ និងដាក់របាំងស្ទាក់ផ្លូវ។',
    btn_play_ai: 'លេងទល់នឹង AI',
    match_code_label: 'លេខកូដបន្ទប់',
    match_code_placeholder: 'ឧ. WALL8',
    match_code_hint: 'ផ្ញើលេខកូដនេះទៅមិត្តភក្តិរបស់អ្នកដើម្បីចូលលេង។',
    nickname_label: 'ឈ្មោះរបស់អ្នក',
    nickname_placeholder: 'វាយឈ្មោះរបស់អ្នក',
    btn_start_online: 'ចាប់ផ្តើម / ចូលរួមអនឡាញ',
    step_1: '១. យកកូដ',
    step_2: '២. មិត្តភក្តិវាយកូដ',
    step_3: '៣. លេងភ្លាមៗ!',
    pass_desc: 'ផ្លាស់វេនគ្នាដើរកូនអុក និងដាក់របាំងឈើ ១០ លើទូរស័ព្ទតែមួយ។ មិនបាច់ប្រើអ៊ីនធឺណិតទេ!',
    btn_start_pass: 'ចាប់ផ្តើមលេង ២ នាក់',
    btn_back_hub: '← ត្រឡប់ទៅមឺនុយដើម',

    // Barricade In-Game
    btn_mode: '← របៀប',
    btn_leave: '← ចាកចេញ',
    btn_restart: 'លេងឡើងវិញ',
    btn_share: 'ចែករំលែក',
    btn_move: 'ដើរ',
    btn_wall: 'របាំង',
    btn_horiz: 'ផ្ដេក',
    btn_vert: 'បញ្ឈរ',
    round_badge: 'ជុំ',
    you_label: 'អ្នក',
    red_label: 'ក្រហម',
    blue_label: 'ខៀវ',
    ai_label: 'AI Bot',
    turn_active: 'ដល់វេន',
    waiting: 'រង់ចាំ',
    winner_badge: 'ឈ្នះ 🏆',
    finished_badge: 'ចប់',
    your_turn_move: 'វេនរបស់អ្នក — ចុចក្រឡាបៃតងដើម្បីដើរ',
    your_turn_wall: '🧱 របៀបរបាំង៖ ចុចលើចំណុចមាសដើម្បីទម្លាក់',
    ai_thinking: '🤖 AI កំពុងគិតរកផ្លូវដើរ…',
    opp_thinking: 'វេនរបស់ {name} — កំពុងរង់ចាំ…',
    red_turn_pass: 'វេនពណ៌ក្រហម — ចុចក្រឡាបៃតងដើម្បីដើរ',
    blue_turn_pass: 'វេនពណ៌ខៀវ — ចុចក្រឡាបៃតងដើម្បីដើរ',
    win_victory: '🏆 ជ័យជម្នះ! អ្នកបានទៅដល់គោលដៅ!',
    win_ai: '🤖 AI បានឈ្នះជុំនេះ!',
    win_opp: 'គូប្រកួតបានទៅដល់គោលដៅមុន!',
    win_red: '🏆 ខាងក្រហមបានឈ្នះ!',
    win_blue: '🏆 ខាងខៀវបានឈ្នះ!',
    btn_rematch: '🔄 ស្នើសុំលេងម្តងទៀត',
    btn_waiting_rematch: '⏳ កំពុងរង់ចាំគូប្រកួត…',
    btn_play_again: '🔄 លេងម្តងទៀត',
    rematch_note: 'អ្នកដើរមុននឹងឆ្លាស់គ្នាដោយស្វ័យប្រវត្តិតាមជុំនីមួយៗ!',
    walls_title: 'របាំងនៅសល់',

    // Barricade Lobby
    lobby_title: 'កំពុងរង់ចាំគូប្រកួត',
    lobby_lede: 'ប្រាប់មិត្តភក្តិឱ្យបើកហ្គេម ហើយវាយលេខកូដនេះលើទូរស័ព្ទរបស់គេ៖',
    btn_share_link: '📤 ចែករំលែកតំណភ្ជាប់',
    btn_copy_code: '📋 ចម្លងលេខកូដ',
    btn_copied_code: '✓ បានចម្លងកូដ',
    btn_copy_link: '🔗 ចម្លងតំណ',
    btn_copied_link: '✓ បានចម្លងតំណ',
    waiting_phone2: 'កំពុងរង់ចាំអ្នកលេងទី ២ ចូលរួមលើទូរស័ព្ទទី ២…',
    btn_cancel_code: '← បោះបង់ / ប្តូរលេខកូដ',

    // Toast Notifications
    toast_code_min: 'សូមវាយលេខកូដយ៉ាងតិច ៣ តួអក្សរ។',
    toast_no_walls: 'អស់របាំងឈើហើយ!',
    toast_block_all: 'មិនអាចបិទផ្លូវទាំងអស់ទៅកាន់គោលដៅទេ!',
    toast_illegal_move: 'មិនអាចដើរក្រឡានេះបានទេ។',

    // Tic Tac Toe Screens
    ttt_home_eyebrow: 'រហ័ស ឥតគិតថ្លៃ មិនបាច់ចុះឈ្មោះ',
    ttt_home_title: 'ហ្គេមការ៉ូអនឡាញ (Tic Tac Toe)',
    ttt_home_lede: 'វាយលេខកូដ ចែករំលែកទៅមិត្តភក្តិ ហើយលេងភ្លាមៗតាមទូរស័ព្ទ។',
    ttt_room_code: 'លេខកូដបន្ទប់',
    ttt_random_code: 'កូដចៃដន្យ',
    ttt_share_hint: 'វាយពាក្យងាយចាំ ឬចុច 🎲 ដើម្បីបង្កើតកូដ។',
    ttt_your_name: 'ឈ្មោះហៅក្រៅ',
    ttt_name_placeholder: 'ឧ. ពិសិដ្ឋ',
    ttt_btn_join: 'ចាប់ផ្តើម ឬ ចូលរួមបន្ទប់',
    ttt_mode_online: 'អនឡាញ PvP',
    ttt_mode_ai: 'លេងជាមួយ AI',
    ttt_mode_pass: 'ទូរស័ព្ទតែមួយ',
    ttt_ai_easy: 'ងាយ',
    ttt_ai_medium: 'មធ្យម ⭐',
    ttt_ai_master: 'កំពូលឆ្លាត 🧠',
    ttt_btn_solo: 'លេងទល់នឹង AI',
    ttt_btn_pass: 'លេងទូរស័ព្ទតែមួយ',
    ttt_connecting: 'កំពុងភ្ជាប់ទៅបន្ទប់ប្រកួត…',
    ttt_connecting_sub: 'កំពុងភ្ជាប់បណ្តាញ peer-to-peer សុវត្ថិភាពខ្ពស់',
    ttt_lobby_share_btn: 'ចែករំលែកតំណភ្ជាប់',
    ttt_waiting_status: 'កំពុងរង់ចាំគូប្រកួតចូលរួម…',
    ttt_btn_change_code: '← ប្តូរកូដ / លេងម្នាក់ឯង',
    ttt_turn_mine: 'វេនរបស់អ្នក',
    ttt_turn_opp: 'វេនគូប្រកួត',
    ttt_turn_x: 'វេនខាង X',
    ttt_turn_o: 'វេនខាង O',
    ttt_you_won: '🎉 អ្នកបានឈ្នះ!',
    ttt_draw: '🤝 ស្មើគ្នា!',
    ttt_opp_won: 'គូប្រកួតបានឈ្នះ!',
    ttt_round: 'ជុំទី',
  },
}

export function t(key, params = {}) {
  const lang = currentLang.value
  const dict = messages[lang] || messages.en
  let str = dict[key] || messages.en[key] || key
  for (const [k, v] of Object.entries(params)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return str
}

export function useI18n() {
  return {
    lang: currentLang,
    t,
    setLanguage,
    toggleLanguage,
  }
}
