/**
 * Подсказка «разобрать связанный режим» после сохранения записи дневника
 * режимов. В одной ситуации часто работают несколько режимов сразу (Критик
 * наехал → Ребёнку больно → копинг вышел защищать) — предлагаем новую
 * запись про ту же ситуацию, но про соседний режим в этой цепочке.
 *
 * Семью исходного режима определяем через findTestGroupByModeId (те же 8
 * семей, что и в тесте «по чувству», modeTest.ts) — второй классификации не
 * заводим (правило №11: одна механика, один источник семей).
 *
 * Маппинг семья → следующий шаг цепочки (клинически — кто чаще всего стоит
 * рядом за функцией режима):
 * - hurt/anger (детские) — за детской болью часто стоит голос Критика;
 * - avoid/surrender/control/grandiose (копинги) — копинг обычно защищает
 *   Ребёнка, спрашиваем, кто прятался за ним;
 * - critic — спрашиваем, что почувствовал Ребёнок от слов Критика;
 * - ok (здоровые режимы) и неизвестный modeId — цепочку не предлагаем.
 */
import { findTestGroupByModeId } from './modeTest';

type Tr = (ty: string, vy: string) => string;

export interface ModeChainSuggestion {
  question: string;
  hint: string;
  candidateIds: string[];
}

export interface ModeChainCandidate<M> {
  id: string;
  mode: M;
}

/**
 * candidateIds → реальные объекты режима (для рендера emoji+имя), с фильтром
 * несуществующих id. Общая для обоих фронтов (правило №3) — иначе в каждом
 * ModeChainSuggestion повторяется один и тот же map+filter.
 */
export function resolveModeChainCandidates<M>(
  candidateIds: string[],
  getModeById: (id: string) => M | undefined,
): ModeChainCandidate<M>[] {
  return candidateIds
    .map((id): ModeChainCandidate<M> | null => {
      const mode = getModeById(id);
      return mode ? { id, mode } : null;
    })
    .filter((c): c is ModeChainCandidate<M> => c !== null);
}

const CHILD_FAMILIES = new Set(['hurt', 'anger']);
const COPING_FAMILIES = new Set(['avoid', 'surrender', 'control', 'grandiose']);

// Новая запись будет про ту же ситуацию — меняется только режим (форма
// сохраняет values.situation при рестарте). Строка нейтральная, обращения к
// пользователю нет — разводить по ты/вы не нужно (правило ты/вы в CLAUDE.md).
const CHAIN_HINT =
  'Новая запись будет про ту же ситуацию — сохранится описание, изменится только режим.';

export interface ModeChainVm<M> {
  question: string;
  hint: string;
  candidates: ModeChainCandidate<M>[];
}

/** Пропсы ModeChainSuggestion — общие для webapp/miniapp (одна копия типа). */
export interface ModeChainSuggestionProps {
  modeId: string;
  onPick: (toModeId: string | null) => void;
}

/**
 * View-model для ModeChainSuggestion (webapp + miniapp, правило №3): считает
 * подсказку и резолвит кандидатов одним вызовом — компонент только рендерит.
 */
export function modeChainVm<M>(
  modeId: string,
  tr: Tr,
  getModeById: (id: string) => M | undefined,
): ModeChainVm<M> | null {
  const suggestion = buildModeChainSuggestion(modeId, tr);
  if (!suggestion) return null;
  return {
    question: suggestion.question,
    hint: suggestion.hint,
    candidates: resolveModeChainCandidates(
      suggestion.candidateIds,
      getModeById,
    ),
  };
}

export function buildModeChainSuggestion(
  modeId: string,
  tr: Tr,
): ModeChainSuggestion | null {
  const group = findTestGroupByModeId(modeId);
  if (!group) return null;

  if (CHILD_FAMILIES.has(group.id)) {
    return {
      question: tr(
        'Ребёнку сейчас больно. Перед этим часто звучит голос Критика — как думаешь, он говорил что-то?',
        'Ребёнку сейчас больно. Перед этим часто звучит голос Критика — как думаете, он говорил что-то?',
      ),
      hint: CHAIN_HINT,
      candidateIds: ['demanding_critic', 'punitive_critic', 'guilt_critic'],
    };
  }

  if (COPING_FAMILIES.has(group.id)) {
    return {
      question: tr(
        'Этот режим обычно выходит, чтобы защитить Ребёнка. Как думаешь, кто прятался за ним?',
        'Этот режим обычно выходит, чтобы защитить Ребёнка. Как думаете, кто прятался за ним?',
      ),
      hint: CHAIN_HINT,
      candidateIds: ['vulnerable_child', 'angry_child', 'lonely_child'],
    };
  }

  if (group.id === 'critic') {
    return {
      question: tr(
        'А что почувствовал Ребёнок, когда Критик так говорил? Попробуй вспомнить.',
        'А что почувствовал Ребёнок, когда Критик так говорил? Попробуйте вспомнить.',
      ),
      hint: CHAIN_HINT,
      candidateIds: ['vulnerable_child', 'humiliated_child', 'angry_child'],
    };
  }

  return null; // семья 'ok' — здоровые режимы, цепочку не предлагаем
}
