// Какой знак у листа подсказок терапевту (docs/design/PAPER_2026-11.md, «Язык
// знаков»): режим — знак его группы, техника — свой знак (пять техник берут
// мотив языка, который им точно подходит: стулья — Talk, письма — Sheets,
// осознанность — Breath, самосострадание — Heart, когнитивная работа — Pebbles),
// схема — знак домена (DomainArt), раздел «Для терапевта» — свой знак (PRACTICE_NOTE_SIGN).
// Чистые функции; рисунки — реестр SignArt.tsx (группы режимов — GuideSignsModes.tsx, техники —
// GuideSignsTechniques.tsx, два знака «Для терапевта» — GuideSignsPractice.tsx). Тип техники —
// только тип: тексты подсказок грузятся отдельным чанком (guideLoader), и сюда они не тянутся.
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { MODE_GROUP_SIGN } from '../../../../shared/src/theme/entityLook';
import { getModeById, getSchemaById, SCHEMA_DOMAINS } from '../../schemaTherapyData';

/** Все знаки листов: по группе режимов, общий знак режимов, по технике, по разделу «Для терапевта».
 *  Подмножество ключей реестра SIGN_KEYS (сверка — guideSignsModel.test.tsx). */
export const GUIDE_SIGNS = [
  'child_care', 'yield', 'shelter', 'shield', 'looming', 'together', 'cluster',
  'pattern_steps', 'rescript', 'horizon', 'talk', 'talk_past', 'flashcard', 'sheets',
  'breath', 'heart_frame', 'scales', 'spotlight', 'heart', 'grown', 'pebbles',
  'ribbon', 'chatter', 'check', 'layers', 'beads', 'limits', 'flare',
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
type ModeGroupId = keyof typeof MODE_GROUP_SIGN;

/** Знак техники: у каждой свой, общих нет. */
export const TECHNIQUE_SIGN: Record<TechniqueId, GuideSign> = {
  imagery_rescripting: 'rescript',
  future_imagery: 'horizon',
  chairwork: 'talk',
  historical_role_play: 'talk_past',
  flashcards: 'flashcard',
  cognitive_work: 'pebbles',
  letters: 'sheets',
  pattern_breaking: 'pattern_steps',
  mindfulness: 'breath',
  empathic_confrontation: 'heart_frame',
  pros_cons: 'scales',
  mode_interview: 'spotlight',
  self_compassion: 'heart',
  healthy_adult_imagery: 'grown',
};

/**
 * Знак раздела «Для терапевта» (id из guide/practice.ts; сверка — тестом модели). Восемь —
 * готовый мотив: тупик — Ribbon (зацепило и закрутилось), ошибки в методе — Check (сверить
 * себя по списку), схемы терапевта — Layers (свои слои), группа — Cluster (несколько кругов
 * вместе), намеренная практика — Beads (настройка: три уровня на одной нити), рамка метода —
 * Limits (рамка), суицидальные мысли — Heart (бережно, как кризисный вход «Мне плохо»),
 * влюблённость — HeartFrame (тепло и граница: это и есть эмпатическая конфронтация). Два —
 * свои (GuideSignsPractice.tsx): «болтовня» — Chatter, злость — Flare.
 */
export const PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  angry_client: 'flare',
  chatting: 'chatter',
  deliberate_practice: 'beads',
  frame_additions: 'limits',
  group_therapy: 'cluster',
  impasses: 'ribbon',
  method_errors: 'check',
  romance_and_partner: 'heart_frame',
  suicidal_thoughts: 'heart',
  therapist_schemas: 'layers',
};

/** Знак раздела «Для терапевта»; раздела нет в таблице — без знака (не выдумываем). */
export const practiceNoteSign = (noteId: string): GuideSign | null =>
  Object.hasOwn(PRACTICE_NOTE_SIGN, noteId) ? PRACTICE_NOTE_SIGN[noteId] : null;

/** Знак группы режимов по id (лист режима, заголовок группы в палитре холста); без группы — общий знак режимов. */
export const modeGroupSign = (groupId: string | undefined): GuideSign =>
  (groupId && MODE_GROUP_SIGN[groupId as ModeGroupId]) || 'cluster';
/**
 * Режимы со своим знаком внутри группы: «Сердитый Ребёнок» — Flare (часть вспыхнула, рядом
 * ровный круг мха), иначе два детских режима различала бы только подпись. Заголовок группы
 * остаётся знаком группы (ChildCare). Решение 6, docs/design/APP_2026-11.md.
 */
const MODE_OWN_SIGN: Record<string, GuideSign> = { angry_child: 'flare' };

/** Знак режима — свой (MODE_OWN_SIGN) или знак его группы; режим без группы (свой режим терапевта) — общий знак режимов. */
export const modeSign = (modeId: string): GuideSign =>
  (Object.hasOwn(MODE_OWN_SIGN, modeId) ? MODE_OWN_SIGN[modeId] : null) ?? modeGroupSign(getModeById(modeId)?.groupId);

/** Номер домена схемы 1–5 для DomainArt; неизвестная схема — 0, картинки нет. */
export function schemaDomain(schemaId: string): number {
  const domainId = getSchemaById(schemaId)?.domainId;
  return SCHEMA_DOMAINS.findIndex((d) => d.id === domainId) + 1;
}
