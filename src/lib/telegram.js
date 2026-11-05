/**
 * Safe wrapper around Telegram's WebApp object with mobile vibration fallback.
 * The script is always loaded from index.html, but the app is fully usable
 * in any mobile browser or desktop.
 */
export function initTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null

  function fallbackVibrate(style) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        if (style === 'success') navigator.vibrate([25, 40, 30])
        else if (style === 'warning' || style === 'error') navigator.vibrate([50, 40, 50])
        else navigator.vibrate(18)
      }
    } catch {
      /* ignore */
    }
  }

  if (!tg) {
    return {
      available: false,
      user: null,
      haptic: (style = 'light') => fallbackVibrate(style),
    }
  }

  try {
    tg.ready?.()
    tg.expand?.()
    // Telegram v6.0 does not support setHeaderColor. Only call if version >= 6.1
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
      tg.setHeaderColor?.('#0b1020')
      tg.setBackgroundColor?.('#0b1020')
    }
  } catch {
    /* older Telegram clients */
  }

  const user = tg.initDataUnsafe?.user || null

  return {
    available: true,
    user,
    haptic: (style = 'light') => {
      try {
        if (style === 'success' || style === 'warning' || style === 'error') {
          tg.HapticFeedback?.notificationOccurred?.(style)
        } else {
          tg.HapticFeedback?.impactOccurred?.(style)
        }
      } catch {
        /* fallback */
      }
      fallbackVibrate(style)
    },
  }
}
