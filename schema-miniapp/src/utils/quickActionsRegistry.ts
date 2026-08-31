// Данные и сборка групп единого реестра быстрых действий. QUICK_ACTION_IDS/
// QuickActionId остаются в quickActions.ts (сверка с бэкендом держит
// фиксированный путь до того файла) — здесь только определения (label/sub/
// группа/поверхности) и сборка групп «плюса»; quickActions.ts реэкспортирует
// это, чтобы у потребителей остался один путь импорта: 'utils/quickActions'
// (файл упирается в свой бейслайн размера, правило №10 CLAUDE.md).
//
// Продуктовое решение (свод дублей шести упражнений, 2026-08): раньше
// belief_check/phrase_check/flashcard/safe_place/letter_to_self/warm_words
// жили ОДНОВРЕМЕННО в «плюсе» и в «Инструментах» — с двумя независимыми
// подписями и двумя независимыми настройками видимости, которые уже начали
// расходиться текстом. Теперь у каждого действия один дом: «плюс» — это
// «записать момент и успокоиться прямо сейчас» (дневник, трекер, три
// экстренные практики, разбор случая), «Инструменты» — упражнения и
// разделы, к которым возвращаются не в моменте острой необходимости, а
// спокойно разобраться.
import type { Tr } from '../../../shared/src/practices/quickPractices';
import type { FocusPractice } from './todayFocus';
import type { QuickActionId } from './quickActions';
import type { QuickActionSurface } from './quickActionPrefs';

export type QuickActionGroupId = 'case' | 'capture' | 'rate' | 'calm';

// Подпись, которую реестр не знает: она считается по данным пользователя
// (счётчик целей/практик/планов, пройдено ли колесо детства) в toolRows.ts.
// Держать здесь её застывшую копию нельзя — правка копии молча ни на что не
// влияет, а два места, обязанных совпадать, расходятся (правило №4 CLAUDE.md).
export const DYNAMIC_SUB = '';

export interface QuickActionDef {
  id: QuickActionId;
  label: string;
  // Функция — только у tracker (единственная подпись, зависящая от ты/вы).
  // DYNAMIC_SUB — подпись считается в toolRows.ts по данным пользователя.
  sub: string | ((tr: Tr) => string);
  // Группа «плюса» — только у действий с surfaces.includes('plus'); у
  // tools-only действий группировки нет (ToolsList — плоский список).
  group?: QuickActionGroupId;
  surfaces: QuickActionSurface[];
}

function def(
  id: QuickActionId,
  label: string,
  sub: QuickActionDef['sub'],
  surfaces: QuickActionSurface[],
  group?: QuickActionGroupId,
): QuickActionDef {
  return { id, label, sub, surfaces, group };
}

export const QUICK_ACTIONS: QuickActionDef[] = [
  def(
    'case',
    'Что это было',
    'Разобрать момент, который задел',
    ['plus'],
    'case',
  ),
  def('diary_schema', 'Схема', 'Когда сработал паттерн', ['plus'], 'capture'),
  def('diary_mode', 'Режим', 'Какой режим активировался', ['plus'], 'capture'),
  def(
    'diary_gratitude',
    'Благодарность',
    'Что было хорошего',
    ['plus'],
    'capture',
  ),
  def(
    'tracker',
    'Трекер потребностей',
    (tr) => tr('Оцени день по пяти шкалам', 'Оцените день по пяти шкалам'),
    ['plus'],
    'rate',
  ),
  def(
    'breathing',
    'Дыхание 4-4-6',
    'вдох короче выдоха — сигнал телу, что опасности нет',
    ['plus'],
    'calm',
  ),
  def(
    'grounding',
    'Заземление 5-4-3-2-1',
    'вернуться в тело и в комнату',
    ['plus'],
    'calm',
  ),
  def(
    'stop',
    'Техника «Стоп»',
    'пауза между импульсом и действием',
    ['plus'],
    'calm',
  ),
  def('belief_check', 'Проверка убеждений', 'Правда ли это?', ['tools']),
  def(
    'phrase_check',
    'Критик или забота?',
    'Проверить фразу внутреннего голоса',
    ['tools'],
  ),
  def('flashcard', 'Схема включилась', '5 шагов чтобы разобраться', ['tools']),
  def('safe_place', 'Безопасное место', 'Ресурс в тревожный момент', ['tools']),
  def('letter_to_self', 'Письмо себе', 'Уязвимому Ребёнку', ['tools']),
  def('warm_words', 'Тёплые слова', 'Слова поддержки себе', ['tools']),
  def('childhood_wheel', 'Колесо детства', DYNAMIC_SUB, ['tools']),
  def('tasks', 'Мои цели', DYNAMIC_SUB, ['tools']),
  def('practices', 'Практики', DYNAMIC_SUB, ['tools']),
  def('plans', 'Планы', DYNAMIC_SUB, ['tools']),
];

export function getQuickAction(id: QuickActionId): QuickActionDef {
  const found = QUICK_ACTIONS.find((a) => a.id === id);
  if (!found) throw new Error(`Неизвестное быстрое действие: ${id}`);
  return found;
}

export interface QuickAction {
  id: QuickActionId;
  label: string;
  sub: string;
}

export interface QuickActionGroup {
  id: QuickActionGroupId;
  title: string;
  actions: QuickAction[];
}

const PLUS_GROUPS: { id: QuickActionGroupId; title: string }[] = [
  { id: 'case', title: 'Разобраться' },
  { id: 'capture', title: 'Записать момент' },
  { id: 'rate', title: 'Оценить день' },
  { id: 'calm', title: 'Успокоиться' },
];

// Пункты поверхности «плюс», сгруппированные — группа и подписи берутся из
// QUICK_ACTIONS (surfaces включает 'plus'); группа без действий не рендерится
// (сейчас это исключает «Инструменты»-only действия целиком).
export function buildPlusActions(tr: Tr): QuickActionGroup[] {
  return PLUS_GROUPS.map(({ id, title }) => ({
    id,
    title,
    actions: QUICK_ACTIONS.filter(
      (a) => a.group === id && a.surfaces.includes('plus'),
    ).map((a) => ({
      id: a.id,
      label: a.label,
      sub: typeof a.sub === 'function' ? a.sub(tr) : a.sub,
    })),
  })).filter((g) => g.actions.length > 0);
}

// Явный маппинг «главное дело дня» (todayFocus.ts) → быстрое действие плюса.
// Оба реестра обязаны совпадать по смыслу (правило №4 CLAUDE.md) — сверка в
// quickActions.test.ts.
export const focusToQuickAction: Record<FocusPractice, QuickActionId> = {
  tracker: 'tracker',
  schema: 'diary_schema',
  mode: 'diary_mode',
  gratitude: 'diary_gratitude',
};
