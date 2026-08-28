/**
 * Порывы «Разбор случая» — шаг 5, мультивыбор до трёх чипов. Один тап решает
 * две задачи разом: заполняет поле карточки режима «что тянет сделать» и
 * подсвечивает вероятную вторую дверь — режим, чьё повседневное действие
 * расходится с тем, что человек уже выбрал воротами чувств (тот же принцип
 * «поверхностное переживание ведёт в другую семью», что у SECOND_DOORS в
 * modeBodyCues.ts — только не через тело, а через действие).
 *
 * IMPULSE_SECOND_DOOR — не новая таксономия режимов, а прикладная эвристика
 * поверх уже существующей: дом режима остаётся тем, что задан
 * MODE_TEST_GROUPS/findTestGroupByModeId (правило №4 CLAUDE.md — денормали-
 * зованное соответствие проверяется тестом-сверкой, несуществующий modeId
 * уронит caseImpulses.test.ts).
 */
import type { CaseGateId, Tr } from './caseTypes';
import type { CaseChip } from './caseBodyChips';

export const CASE_IMPULSES: CaseChip[] = [
  { id: 'impulse_close', label: 'Свернуть разговор' },
  { id: 'impulse_phone', label: 'Уйти в телефон, в ленту' },
  { id: 'impulse_silence', label: 'Молчать и терпеть' },
  { id: 'impulse_perfect', label: 'Сделать идеально, лишь бы не придрались' },
  { id: 'impulse_sharp', label: 'Сказать резко' },
  { id: 'impulse_postpone', label: 'Отложить и не начинать' },
  { id: 'impulse_agree', label: 'Согласиться, лишь бы не спорить' },
  { id: 'impulse_own', label: 'Своё…' },
];

/**
 * Порыв → modeId вероятной второй двери. Ключ есть не для каждого чипа:
 * «Согласиться…» и «Своё…» не указывают на конкретный режим достаточно
 * уверенно, чтобы предполагать за человека, поэтому в реестре их нет.
 */
export const IMPULSE_SECOND_DOOR: Record<string, string> = {
  impulse_close: 'avoidant_protector',
  impulse_phone: 'detached_self_soother',
  impulse_silence: 'compliant_surrenderer',
  impulse_perfect: 'perfectionistic_oc',
  impulse_sharp: 'angry_child',
  impulse_postpone: 'undisciplined_child',
};

/**
 * Первое расхождение среди выбранных порывов — modeId, отличный от того, что
 * человек уже выбрал воротами; иначе null. gateId в сигнатуре зарезервирован
 * под будущий отбор (например, не предлагать дверь, которая и так видна
 * среди листьев текущих ворот) — сейчас не используется: спецификация шага
 * ограничивается одним условием (расхождение с выбранным режимом).
 */
export function suggestSecondDoor(
  _gateId: CaseGateId,
  impulseChipIds: string[],
  chosenModeId: string,
): string | null {
  for (const chipId of impulseChipIds) {
    const suggested = IMPULSE_SECOND_DOOR[chipId];
    if (suggested && suggested !== chosenModeId) return suggested;
  }
  return null;
}

/**
 * Заметка, показанная, когда suggestSecondDoor нашёл расхождение. Текст
 * нейтрален — _tr держит сигнатуру наравне с остальными build* модуля.
 */
export const buildSecondDoorNote = (_tr: Tr): string =>
  'Похоже, тут работали двое. Начнём с того, кто вышел вперёд.';
