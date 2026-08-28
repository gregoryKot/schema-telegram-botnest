/**
 * Черновик потока «Разбор случая» — по образцу shared/src/utils/drafts.ts
 * (best-effort try/catch, тот же формат ключа), но БЕЗ завязки на DiaryType.
 *
 * 'case' сознательно не добавлен в shared DiaryType/DRAFT_KEYS
 * (shared/src/types.ts, shared/src/utils/drafts.ts): это Record<DiaryType, …>
 * в файлах вне caseFlow — расширение задело бы TYPE_COLORS/SHARE_META в
 * webapp/src/sections/DiarySection.tsx и webapp/src/components/diary/
 * DiaryEmptyExplainer.tsx, которые ТЗ этой задачи трогать не позволяет.
 * Ключ хранилища следует той же схеме именования, что и DRAFT_KEYS.
 *
 * Отказ хранилища здесь НЕ глотается молча: в черновике лежат три минуты
 * работы человека, и «Дописать потом» обещает, что они не пропадут. Молчащая
 * авария невидимее необработанной — тот же урок, что стоил пяти суток
 * сломанного входа (правило №14). Поэтому каждый сбой уходит в console.error:
 * приватный режим и переполненное хранилище — реальные сценарии, а не
 * теоретические.
 */
import type { CaseFlowFields, CaseFlowStep } from './caseFlowTypes';

const DRAFT_KEY = 'diary_draft_case';

export interface CaseDraftPayload extends CaseFlowFields {
  step: CaseFlowStep;
}

export function saveCaseDraft(data: CaseDraftPayload): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    // Черновик не сохранился — человек потеряет разбор, если сейчас выйдет.
    console.error('case draft save failed', e);
  }
}

export function loadCaseDraft(): CaseDraftPayload | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as CaseDraftPayload) : null;
  } catch (e) {
    // Битый или недоступный черновик — начинаем разбор с чистого листа, но
    // молчать об этом нельзя: так теряется уже начатая работа.
    console.error('case draft load failed', e);
    return null;
  }
}

export function clearCaseDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    // Не удалился — на следующем входе всплывёт черновик уже сохранённого
    // разбора и собьёт с толку.
    console.error('case draft clear failed', e);
  }
}
