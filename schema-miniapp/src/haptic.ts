const hf = () => window.Telegram?.WebApp?.HapticFeedback;

export const haptic = {
  tap: () => hf()?.impactOccurred('light'),
  select: () => hf()?.selectionChanged(),
  success: () => hf()?.notificationOccurred('success'),
  warning: () => hf()?.notificationOccurred('warning'),
  error: () => hf()?.notificationOccurred('error'),
};
