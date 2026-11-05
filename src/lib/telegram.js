/**
 * Safe wrapper around Telegram's WebApp object.
 * The script is always loaded from index.html, but the app is fully usable
 * in a normal browser too (initData is simply empty there).
 */
export function initTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

  if (!tg) {
    return { available: false, user: null, haptic: () => {} }
  }

  try {
    tg.ready()
    tg.expand()
    tg.setHeaderColor?.('#0b1020')
    tg.setBackgroundColor?.('#0b1020')
  } catch {
    /* older Telegram clients */
  }

  const user = tg.initDataUnsafe?.user || null

  return {
    available: true,
    user,
    haptic: (style = 'light') => {
      try {
        tg.HapticFeedback?.impactOccurred(style)
      } catch {
        /* unsupported */
      }
    },
  }
}
