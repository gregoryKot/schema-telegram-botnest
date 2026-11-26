// Кнопка «Экспорт концепта» карточки клиента — одна механика на оба
// фронтенда (правило №3): текст из buildConceptExport, системный шаринг, где
// он есть, иначе буфер. Пустой концепт — `exportEmpty`: площадка делает
// кнопку недоступной с подсказкой CONCEPT_EXPORT_EMPTY, а не молчит на тапе.
// `report` — отчёт площадки наверх (reportClientError у каждой свой).
import { isShareAbort } from '../share/shareOutcome';
import { useCopyToClipboard } from '../utils/useCopyToClipboard';
import {
  buildConceptExport,
  isConceptEmpty,
  type ConceptExportInput,
} from './conceptExport';

export function useConceptExport(
  input: ConceptExportInput,
  report: (message: string) => void,
) {
  const { copied, copy } = useCopyToClipboard({
    onError: () => report('concept export clipboard write failed'),
  });
  const exportEmpty = isConceptEmpty(
    { ...input.concept, ...input.localConcept },
    input.activeSchemaIds,
    input.activeModeIds,
  );

  async function handleExport() {
    const text = buildConceptExport(input);
    if (!text) return;
    let shared = false;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        shared = true;
      }
    } catch (e) {
      // Отмена шторки (AbortError) — штатный путь: текст ниже уходит в буфер.
      if (!isShareAbort(e)) report(`concept export share failed: ${String(e)}`);
    }
    if (!shared) await copy(text);
  }

  return { exportCopied: copied, exportEmpty, handleExport };
}
