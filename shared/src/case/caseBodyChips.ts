/**
 * Телесные приметы «Разбор случая» — чипы шага 4, мультивыбор до двух на
 * каждых из восьми ворот FEEL_GATES (shared/src/mode/modeFeelGates.ts). Тап
 * вместо печати снижает порог входа так же, как рамки сцены (caseFrames.ts):
 * узнать готовую метку легче, чем ответить на открытый вопрос «что было в
 * теле» — особенно для СДВГ-аудитории.
 *
 * Ворота 'unknown' новых формулировок не получают: они собраны из
 * MODE_UNKNOWN_GROUP.leaves (shared/src/mode/modeBodyCues.ts) — это уже
 * выверенные телесные приметы состояния «пусто, не знаю, что чувствую»,
 * плодить третью копию запрещает правило №11 CLAUDE.md. Остальные семь
 * ворот — новый телесный контент без названий эмоций: эмоцию человек уже
 * назвал воротами, здесь — только тело.
 *
 * У каждых ворот последним чипом — «Своё…»: набор примет никогда не
 * покрывает всё, и без честного выхода человек либо подгонит метку, либо
 * застрянет на шаге.
 */
import { MODE_UNKNOWN_GROUP } from '../mode/modeBodyCues';
import type { CaseGateId, Tr } from './caseTypes';

export interface CaseChip {
  id: string;
  label: string;
}

const ownChip = (gateId: string): CaseChip => ({
  id: `${gateId}_own`,
  label: 'Своё…',
});

const UNKNOWN_CHIPS: CaseChip[] = [
  ...MODE_UNKNOWN_GROUP.leaves.map((leaf) => ({
    id: `unknown_${leaf.modeId}`,
    label: leaf.label,
  })),
  ownChip('unknown'),
];

export const CASE_BODY_CHIPS: Record<CaseGateId, CaseChip[]> = {
  fear: [
    { id: 'fear_heartbeat', label: 'Сердце колотится' },
    { id: 'fear_shallow_breath', label: 'Дышу поверхностно' },
    { id: 'fear_cold_hands', label: 'Руки холодные' },
    { id: 'fear_stomach', label: 'Живот скручивает' },
    { id: 'fear_tense', label: 'Мышцы напряжены, будто к прыжку' },
    ownChip('fear'),
  ],
  sad: [
    { id: 'sad_throat', label: 'Ком в горле' },
    { id: 'sad_chest', label: 'Тяжесть в груди' },
    { id: 'sad_tears', label: 'Слёзы подступают' },
    { id: 'sad_shoulders', label: 'Плечи опущены' },
    { id: 'sad_breath', label: 'Дыхание медленное и неглубокое' },
    ownChip('sad'),
  ],
  anger: [
    { id: 'anger_jaw', label: 'Сжаты челюсти' },
    { id: 'anger_heat', label: 'Жар по телу' },
    { id: 'anger_fists', label: 'Кулаки сжимаются' },
    { id: 'anger_heartbeat', label: 'Сердце бьётся часто и сильно' },
    { id: 'anger_breath', label: 'Дыхание резкое, через нос' },
    ownChip('anger'),
  ],
  shame: [
    { id: 'shame_face', label: 'Горит лицо' },
    { id: 'shame_shrink', label: 'Хочется сжаться, пропасть из виду' },
    { id: 'shame_gaze', label: 'Взгляд вниз, не поднять глаза' },
    { id: 'shame_palms', label: 'Ладони потеют' },
    { id: 'shame_knot', label: 'В животе сжимается узел' },
    ownChip('shame'),
  ],
  drained: [
    { id: 'drained_shoulders', label: 'Тяжесть в плечах' },
    { id: 'drained_voice', label: 'Голос стал плоским' },
    { id: 'drained_eyelids', label: 'Веки тяжёлые' },
    { id: 'drained_wrapped', label: 'Тело будто в вате' },
    { id: 'drained_slow', label: 'Движения замедлены' },
    ownChip('drained'),
  ],
  unknown: UNKNOWN_CHIPS,
  above: [
    { id: 'above_energy', label: 'Энергия через край' },
    { id: 'above_voice', label: 'Голос громче обычного' },
    { id: 'above_speech', label: 'Речь ускоряется' },
    { id: 'above_chin', label: 'Подбородок приподнят' },
    { id: 'above_spring', label: 'Тело будто на пружинах' },
    ownChip('above'),
  ],
  ok: [
    { id: 'ok_breath', label: 'Дыхание ровное' },
    { id: 'ok_shoulders', label: 'Плечи расслаблены' },
    { id: 'ok_warmth', label: 'Тепло в груди' },
    { id: 'ok_soft', label: 'Тело мягкое, без зажимов' },
    { id: 'ok_gaze', label: 'Взгляд свободно скользит по комнате' },
    ownChip('ok'),
  ],
};

/**
 * Микро-отдача сразу после первого выбранного чипа. Текст нейтрален, без
 * обращения — _tr держит сигнатуру наравне с остальными build* модуля.
 */
export const buildBodyPayoff = (_tr: Tr): string =>
  'Это уже примета — по ней часть узнаётся раньше, чем начнётся.';
