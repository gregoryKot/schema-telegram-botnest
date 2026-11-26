// Тактильный отклик — единственная копия на оба фронтенда (правило №3).
// В Telegram это HapticFeedback, в установленном веб-приложении — вибрация,
// на сайте во вкладке и там, где ничего нет, — тишина.
import { getHost } from './index';

export const haptic = {
  tap: () => getHost().haptic.tap(),
  press: () => getHost().haptic.press(),
  select: () => getHost().haptic.select(),
  success: () => getHost().haptic.success(),
  warning: () => getHost().haptic.warning(),
  error: () => getHost().haptic.error(),
};
