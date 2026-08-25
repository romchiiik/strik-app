// Тонкая обёртка над Telegram WebApp SDK.
// Если приложение открыто не внутри Telegram (например, просто в браузере при разработке),
// все методы просто ничего не делают — это не ломает локальную разработку.

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.(tg.colorScheme === "dark" ? "#161310" : "#f7f7fa");
}

export function getTelegramColorScheme() {
  return tg?.colorScheme; // "light" | "dark" | undefined
}

export function onThemeChanged(cb) {
  if (!tg) return () => {};
  tg.onEvent("themeChanged", cb);
  return () => tg.offEvent("themeChanged", cb);
}

export function haptic(style = "light") {
  if (!tg?.HapticFeedback) return;
  if (style === "success" || style === "error" || style === "warning") {
    tg.HapticFeedback.notificationOccurred(style);
  } else {
    tg.HapticFeedback.impactOccurred(style);
  }
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user;
}

export async function biometricAuth() {
  // BiometricManager (Bot API 7.2+). Возвращает true/false/undefined (если недоступно).
  const bm = tg?.BiometricManager;
  if (!bm) return undefined;
  return new Promise((resolve) => {
    bm.init(() => {
      if (!bm.isBiometricAvailable) return resolve(undefined);
      bm.authenticate({ reason: "Подтвердите действие" }, (success) => resolve(success));
    });
  });
}

export function isInsideTelegram() {
  return Boolean(tg);
}

// Нативный алерт Telegram (не блокирует поток, как браузерный window.alert,
// и выглядит частью интерфейса, а не системным диалогом). Вне Telegram —
// обычный window.alert как запасной вариант.
export function showAlert(message) {
  if (tg?.showAlert) {
    tg.showAlert(message);
  } else if (typeof window !== "undefined") {
    window.alert(message);
  }
}
