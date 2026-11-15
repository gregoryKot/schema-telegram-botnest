// Hex цвета группы режимов — для canvas и SVG листа «Схема — это что?» (schemaInfoSheet),
// куда CSS-переменная не приходит. Тон — MODE_GROUP_HUE; сверка — modeGroupColor.test.ts.
import { MODE_GROUP_HUE, toneHex } from './entityHue';

/** Группа режимов → hex; три копинга делят один тон (MODE_GROUP_HUE). */
export const MODE_GROUP_COLOR = {
  child: { hex: toneHex(MODE_GROUP_HUE.child) },
  coping: { hex: toneHex(MODE_GROUP_HUE.coping_avoidance) },
  critic: { hex: toneHex(MODE_GROUP_HUE.critic) },
  healthy: { hex: toneHex(MODE_GROUP_HUE.healthy) },
} as const;
