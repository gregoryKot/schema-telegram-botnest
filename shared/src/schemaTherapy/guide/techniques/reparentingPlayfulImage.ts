import { limitedReparentingMoreFull as withPatterns } from './reparentingPatterns';
import { limitedReparentingCouples } from './reparentingCouples';
/** «Подробнее» к limited_reparenting с шутливым образом для защитного режима [Хис, гл. 1]: вынесено, чтобы файлы не росли. */
export const limitedReparentingMoreFull: string[] = [
  ...withPatterns,
  'Шутливый образ для защитного режима [Хис, гл. 1]. Колкий ответ клиента на вопрос о чувствах терапевт сначала останавливает паузой и вместе с ним называет, что произошло. Чтобы это не прозвучало критикой, режиму дают смешное имя — «дикобраз», который выставляет иглы, когда разговор подходит к чувствам. Смех снимает стыд, а образ помогает заметить, как тот же «дикобраз» отталкивает близких.',
].concat(limitedReparentingCouples);
