/**
 * Телесные приметы «Разбор случая» — чипы шага 4, мультивыбор до двух на
 * каждых из восьми ворот FEEL_GATES (shared/src/mode/modeFeelGates.ts). Тап
 * вместо печати снижает порог входа так же, как рамки сцены (caseFrames.ts):
 * узнать готовую метку легче, чем ответить на открытый вопрос «что было в
 * теле» — особенно для СДВГ-аудитории.
 *
 * Названий эмоций в чипах нет: эмоцию человек уже назвал воротами, здесь —
 * только тело.
 *
 * Ни на одних воротах чипы не повторяют подписи листьев выбора части: список,
 * показанный дважды подряд, читается как сбой, а не как второй вопрос. Для
 * ворот «пусто» это правило неочевидно — там сами листья написаны на языке
 * тела, — и закреплено тестом на все восемь ворот сразу.
 *
 * У каждых ворот последним чипом — «Своё…»: набор примет никогда не
 * покрывает всё, и без честного выхода человек либо подгонит метку, либо
 * застрянет на шаге.
 */
import type { CaseGateId, Tr } from './caseTypes';

export interface CaseChip {
  id: string;
  label: string;
}

const ownChip = (gateId: string): CaseChip => ({
  id: `${gateId}_own`,
  label: 'Своё…',
});

/**
 * Ворота «пусто или не пойму» — единственные, где шаг выбора части уже
 * говорит на языке тела: там листья и есть телесные маркеры («пусто и ровно,
 * как в вате», «ком в горле»). Поэтому собирать телесные чипы из тех же
 * листьев нельзя — человек получил бы один и тот же список дважды подряд и
 * решил, что приложение не запомнило его ответ.
 *
 * Свои чипы этих ворот отвечают на другой вопрос: не «как это назвать», а
 * «по чему это заметно раньше всего». Названий чувств здесь нет по той же
 * причине, по которой человек выбрал именно эти ворота, — назвать нечего.
 */
const UNKNOWN_CHIPS: CaseChip[] = [
  { id: 'unknown_body_far', label: 'Тело будто не моё' },
  { id: 'unknown_gaze', label: 'Взгляд расфокусирован' },
  { id: 'unknown_voice', label: 'Голос стал ровным и тихим' },
  { id: 'unknown_auto', label: 'Руки делают всё на автомате' },
  { id: 'unknown_needs', label: 'Не замечаю, голоден или устал' },
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
