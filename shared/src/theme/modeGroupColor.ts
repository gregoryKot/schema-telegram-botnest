// Цвет группы режимов двумя видами одного значения: css — токен tokens.css для DOM, hex — для
// canvas шаринга, куда CSS-переменная не приходит. Сверка токена с hex — modeGroupColor.test.ts.
import { MODE_GROUP_HUE, toneHex } from './entityHue';

/** Группа режимов → цвет; три копинга делят один тон (MODE_GROUP_HUE). */
export const MODE_GROUP_COLOR = {
  child: { css: 'var(--mode-child)', hex: toneHex(MODE_GROUP_HUE.child) },
  coping: {
    css: 'var(--mode-coping)',
    hex: toneHex(MODE_GROUP_HUE.coping_avoidance),
  },
  critic: { css: 'var(--mode-critic)', hex: toneHex(MODE_GROUP_HUE.critic) },
  healthy: { css: 'var(--mode-healthy)', hex: toneHex(MODE_GROUP_HUE.healthy) },
} as const;
