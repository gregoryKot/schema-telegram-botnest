// Какой знак у листа подсказок терапевту (docs/design/PAPER_2026-11.md, «Язык
// знаков»): режим — знак его группы, техника — свой знак (пять техник берут
// мотив языка, который им точно подходит: стулья — Talk, письма — Sheets,
// осознанность — Breath, самосострадание — Heart, когнитивная работа — Pebbles), схема — знак домена (DomainArt), раздел «Для терапевта» — свой знак (PRACTICE_NOTE_SIGN).
// Чистые функции; рисунки — реестр SignArt.tsx (режимы — GuideSignsModes.tsx, техники — GuideSignsTechniques.tsx,
// «Для терапевта» — GuideSignsPractice.tsx). Тип техники — только тип: тексты подсказок грузятся отдельным чанком (guideLoader), и сюда они не тянутся.
import { MODE_GROUP_SIGN, modeGroupLook, modeLook } from '../../../../shared/src/theme/entityLook';
import { PATH_SIGN_KEYS } from '../../../../shared/src/theme/pathSignKeys';
import { TECHNIQUE_OWN_SIGN_KEYS } from '../../../../shared/src/theme/techniqueSignKeys';
import { YOUNG_PRACTICE_NOTE_SIGN } from './practiceSignsYoung';
import { ARNTZ_PRACTICE_NOTE_SIGN } from './practiceSignsArntz';
import { FARRELL_PRACTICE_NOTE_SIGN } from './practiceSignsFarrell';
import { BEHARY_PRACTICE_NOTE_SIGN } from './practiceSignsBehary';
import { getModeById, getSchemaById, SCHEMA_DOMAINS } from '../../schemaTherapyData';

/** Все знаки листов: по группе режимов, общий знак режимов, по технике, по разделу «Для терапевта».
 *  Подмножество ключей реестра SIGN_KEYS (сверка — guideSignsModel.test.tsx). */
export const GUIDE_SIGNS = [
  'child_care', 'yield', 'shelter', 'shield', 'looming', 'together', 'cluster',
  'pattern_steps', 'rescript', 'horizon', 'talk', 'talk_past', 'flashcard', 'sheets',
  'breath', 'heart_frame', 'scales', 'spotlight', 'heart', 'grown', 'pebbles',
  'ribbon', 'chatter', 'check', 'layers', 'beads', 'limits', 'flare', 'cup', 'join',
  'pause', 'haven', 'leaf', 'coping_avoidance', 'coping_overcompensation', 'roots', 'strokes', 'grounded', 'wheel', 'need_attachment',
  ...TECHNIQUE_OWN_SIGN_KEYS,
  ...PATH_SIGN_KEYS,
] as const;

export type GuideSign = (typeof GUIDE_SIGNS)[number];

/**
 * Знак группы режимов — круги, потому что режим — часть, которая у руля; знак говорит,
 * что с этой частью делают в терапии. Цвет главного круга — оттенок группы на карте
 * режимов (MODE_GROUP_HUE): детские — глина, копинги — сланец, критики — слива,
 * здоровые — мох. Таблица живёт в shared (entityLook.ts): её же берут клиент и канва
 * шаринга — терапевт и клиент говорят на одном языке.
 */
export { MODE_GROUP_SIGN };

export { TECHNIQUE_SIGN } from './techniqueSigns';

/**
 * Знак раздела «Для терапевта» (id из guide/practice.ts; сверка — тестом модели). Девять —
 * готовый мотив: тупик — Ribbon (зацепило и закрутилось), ошибки в методе — Check (сверить
 * себя по списку), схемы терапевта — Layers (свои слои), группа — Cluster (несколько кругов
 * вместе), намеренная практика — Beads (настройка: три уровня на одной нити), рамка метода —
 * Limits (рамка), суицидальные мысли — Heart (бережно, как кризисный вход «Мне плохо»),
 * влюблённость — HeartFrame (тепло и граница), онлайн-формат — Together (двое рядом). Два —
 * свои (GuideSignsPractice.tsx): «болтовня» — Chatter, злость — Flare. Шесть разделов оценки
 * (Кембридж, гл. 3–4) берут знак техники с тем же смыслом: первая сессия — ChildCare
 * (ограниченное родительство с первой встречи), режим по манере рассказа — Talk, жалоба → режим —
 * Spotlight (интервью с режимом), расспрос о детстве — TalkPast, концептуализация — Sheets
 * (письменная форма), стадии изменений — PatternSteps (шаги к перемене). Ход терапии и перемены
 * (гл. 1, 2, 5, 6, 8, 9): цели — Grown (рост Здорового Взрослого), данные — Scales (взвесить),
 * сессия — Shelter (начало с подстройки), самораскрытие — Breath (пауза и сверка с собой),
 * работа с чувствами — Rescript (через образ), дословная сцена — Pebbles (факты по одному),
 * блоки — Flashcard (одно из средств против блока). Финал и травма (гл. 12, 14): завершение —
 * Horizon (взгляд вперёд), сложная травма — Shield (защита, которой ребёнку не дали). Выгорание (гл. 18) — Cup знаков приложения (пусто, и это повод отдохнуть), приёмы группы (гл. 17) — Join (одна часть на всех).
 */
export const PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  angry_client: 'flare',
  case_conceptualization: 'sheets',
  change_blocks: 'flashcard',
  chatting: 'chatter',
  complaint_to_mode: 'spotlight',
  complex_trauma: 'shield',
  deliberate_practice: 'beads',
  ending_phase: 'horizon',
  evidence_limits: 'scales',
  exact_scene: 'pebbles',
  experiential_avoidance: 'rescript',
  first_session: 'child_care',
  frame_additions: 'limits',
  group_therapy: 'cluster',
  history_interview: 'talk_past',
  impasses: 'ribbon',
  method_errors: 'check',
  online_format: 'together',
  romance_and_partner: 'heart_frame',
  self_disclosure: 'breath',
  session_structure: 'shelter',
  stages_of_change: 'pattern_steps',
  story_as_mode_signal: 'talk',
  suicidal_thoughts: 'heart',
  group_techniques: 'join',
  therapist_schemas: 'layers',
  therapist_wellbeing: 'cup',
  therapy_aims: 'grown',
  ...YOUNG_PRACTICE_NOTE_SIGN, ...ARNTZ_PRACTICE_NOTE_SIGN, ...FARRELL_PRACTICE_NOTE_SIGN, ...BEHARY_PRACTICE_NOTE_SIGN,
};

/** Знак раздела «Для терапевта»; раздела нет в таблице — без знака (не выдумываем). */
export const practiceNoteSign = (noteId: string): GuideSign | null =>
  Object.hasOwn(PRACTICE_NOTE_SIGN, noteId) ? PRACTICE_NOTE_SIGN[noteId] : null;

/** Знак группы режимов по id (лист режима, заголовок группы в палитре холста); без группы — общий
 *  знак режимов. Таблица и защита от ключей прототипа — modeGroupLook (shared). */
export const modeGroupSign = (groupId: string | undefined): GuideSign => modeGroupLook(groupId).sign;

/** Знак режима — свой («Сердитый Ребёнок» — Flare, решение 6) или знак его группы; режим без группы
 *  (свой режим терапевта) — общий знак режимов. Таблица своих знаков — MODE_OWN_SIGN (shared). */
export const modeSign = (modeId: string): GuideSign => modeLook(modeId, getModeById(modeId)?.groupId).sign;

/** Номер домена схемы 1–5 для DomainArt; неизвестная схема — 0, картинки нет. */
export function schemaDomain(schemaId: string): number {
  const domainId = getSchemaById(schemaId)?.domainId;
  return SCHEMA_DOMAINS.findIndex((d) => d.id === domainId) + 1;
}
