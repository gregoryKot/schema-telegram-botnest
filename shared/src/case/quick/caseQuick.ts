/**
 * «Что случилось» в три шага (сайт, простой клиент, этап 4): момент → что
 * внутри → что хотелось сделать → итог. Чистые функции потока; состояние —
 * useCaseQuickFlow.ts. Старый поток из десяти шагов (useCaseFlowState,
 * caseFlowTypes) остался за мини-аппом и не меняется.
 *
 * Режим человек не выбирает «из каталога» — его предлагает pickCandidateMode
 * по воротам чувств и первому порыву, а человек соглашается («Сохранить») или
 * идёт в «Не похоже — другие режимы». Согласие и есть запись в дневник и
 * карточку режима: отдельного шага «критерий» нет.
 */
import { FEEL_GATES } from '../../mode/modeFeelGates';
import { MODE_DESC } from '../../mode/modePickerDesc';
import { getModeCard } from '../../mode/modeCards';
import { getModeById } from '../../schemaTherapy/schemaTherapyData';
import type { ModeEntrySaveData } from '../../mode/modeDiarySteps';
import type { CaseChip } from '../caseBodyChips';
import { IMPULSE_SECOND_DOOR } from '../caseImpulses';
import type { CaseCardBody } from '../caseFlowTypes';
import type { CaseGateId } from '../caseTypes';

export type CaseQuickStep =
  'scene' | 'feel' | 'steady' | 'impulse' | 'result' | 'modes' | 'done';

export interface CaseQuickFields {
  scene: string;
  gateId: CaseGateId | null;
  bodyChipIds: string[];
  bodyOwn: string;
  impulseChipIds: string[];
  impulseOwn: string;
  /** Режим, выбранный руками («Не похоже»). Пусто — берём предложенный. */
  modeId: string;
}

export const INITIAL_QUICK_FIELDS: CaseQuickFields = {
  scene: '',
  gateId: null,
  bodyChipIds: [],
  bodyOwn: '',
  impulseChipIds: [],
  impulseOwn: '',
  modeId: '',
};

/** Что хост даёт потоку: запись дневника, карточка режима, выходы. */
export interface CaseQuickProps {
  onSave: (data: ModeEntrySaveData) => Promise<void>;
  onSaveCard: (body: CaseCardBody) => Promise<void>;
  onOpenMap: () => void;
  onClose: () => void;
}

/** Ворота «спокойно, хорошо»: разбирать нечего — это «ровный день». */
export const STEADY_GATE_ID: CaseGateId = 'ok';
/** Режим записи «ровного дня» (id из MODE_GROUPS, группа здоровых). */
export const STEADY_MODE_ID = 'healthy_adult';

const BODY_LIMIT = 2;
const IMPULSE_LIMIT = 3;
const CARD_TRIGGER_LIMIT = 60;
export { BODY_LIMIT, IMPULSE_LIMIT };

/**
 * Режим-кандидат. Первый порыв, у которого есть соответствие
 * (IMPULSE_SECOND_DOOR), сильнее ворот: действие точнее называет часть, чем
 * общее чувство. Нет соответствия («Своё…», «Согласиться…») — первый режим
 * ворот. Ворота неизвестны — ворота «пусто или не пойму».
 */
export function pickCandidateMode(
  gateId: CaseGateId | null,
  impulseIds: string[],
): string {
  for (const id of impulseIds) {
    const mode = IMPULSE_SECOND_DOOR[id];
    if (mode) return mode;
  }
  const gate =
    FEEL_GATES.find((g) => g.id === gateId) ??
    FEEL_GATES.find((g) => g.id === 'unknown')!;
  return gate.leaves[0].modeId;
}

/** Подпись ворот на экране и в записи («Страшно, тревожно»). */
export function gateTitle(gateId: CaseGateId | null): string {
  return FEEL_GATES.find((g) => g.id === gateId)?.title ?? '';
}

const isOwn = (id: string) => id.endsWith('_own');
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/**
 * Выбранные чипы одной строкой: свой текст стоит на месте «Своё…», пустое
 * «Своё…» пропускается, метки идут с маленькой буквы — это перечисление в
 * середине фразы, а не заголовки.
 */
export function chipsText(
  chips: CaseChip[],
  ids: string[],
  ownText: string,
): string {
  return ids
    .map((id) => {
      if (isOwn(id)) return ownText.trim();
      return chips.find((c) => c.id === id)?.label.trim() ?? '';
    })
    .filter(Boolean)
    .map(lowerFirst)
    .join(', ');
}

/** Сцена до границы слова — для поля «Приходит, когда» карточки режима. */
export function shortScene(scene: string, limit = CARD_TRIGGER_LIMIT): string {
  const text = scene.trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return (space > 0 ? cut.slice(0, space) : cut).trimEnd() + '…';
}

/** Режим, который уйдёт в запись: выбранный руками или предложенный. */
export function resolveModeId(f: CaseQuickFields): string {
  return f.modeId || pickCandidateMode(f.gateId, f.impulseChipIds);
}

/** Имя режима для заголовка: «Уязвимый Ребёнок» (оба слова с заглавной). */
export function quickModeName(modeId: string): string {
  return getModeById(modeId)?.name ?? modeId;
}

export interface QuickResultRow {
  label: string;
  text: string;
}

export interface QuickResultView {
  modeId: string;
  name: string;
  desc: string;
  /** «что ему нужно» без точки в конце; пусто, если карточки нет. */
  need: string;
  rows: QuickResultRow[];
}

export function buildQuickResult(
  fields: CaseQuickFields,
  bodyChips: CaseChip[],
  impulseChips: CaseChip[],
): QuickResultView {
  const modeId = resolveModeId(fields);
  const body = chipsText(bodyChips, fields.bodyChipIds, fields.bodyOwn);
  const inside = [gateTitle(fields.gateId), body].filter(Boolean).join(' · ');
  const impulse = chipsText(
    impulseChips,
    fields.impulseChipIds,
    fields.impulseOwn,
  );
  const rows: QuickResultRow[] = [
    { label: 'Момент', text: fields.scene.trim() },
    { label: 'Внутри', text: inside },
    { label: 'Хотелось', text: impulse },
  ].filter((r) => r.text);
  const need = getModeCard(modeId)?.need ?? '';
  return {
    modeId,
    name: quickModeName(modeId),
    desc: MODE_DESC[modeId] ?? '',
    need: lowerFirst(need.replace(/\.$/, '')),
    rows,
  };
}

/** Запись дневника режимов из разбора — с маркером fromCase. */
export function buildQuickSaveData(
  fields: CaseQuickFields,
  bodyChips: CaseChip[],
  impulseChips: CaseChip[],
): ModeEntrySaveData {
  const body = chipsText(bodyChips, fields.bodyChipIds, fields.bodyOwn);
  const impulse = chipsText(
    impulseChips,
    fields.impulseChipIds,
    fields.impulseOwn,
  );
  return {
    modeId: resolveModeId(fields),
    situation: fields.scene.trim(),
    feelings: gateTitle(fields.gateId) || undefined,
    bodyFeelings: body || undefined,
    actions: impulse || undefined,
    fromCase: true,
  };
}

/** «Ровный день»: запись без разбора, режим — Здоровый Взрослый. */
export function buildSteadySaveData(scene: string): ModeEntrySaveData {
  return {
    modeId: STEADY_MODE_ID,
    situation: scene.trim(),
    feelings: gateTitle(STEADY_GATE_ID),
    fromCase: true,
  };
}

/** Карточка режима из согласия с итогом (как toCardBody в старом потоке). */
export function buildQuickCardBody(
  fields: CaseQuickFields,
  bodyChips: CaseChip[],
  impulseChips: CaseChip[],
): CaseCardBody {
  const data = buildQuickSaveData(fields, bodyChips, impulseChips);
  return {
    modeId: data.modeId,
    triggers: shortScene(fields.scene) || undefined,
    feelings: data.bodyFeelings,
    behavior: data.actions,
  };
}
