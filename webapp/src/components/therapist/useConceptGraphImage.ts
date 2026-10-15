import { useCallback, useState, type RefObject } from 'react';
import { toPng } from 'html-to-image';
import { reportClientError } from '../../api';

export const CONCEPT_IMAGE_FILENAME = 'концептуализация.png';

/** Управление схемы (data-export-skip в shared/conceptGraph) в картинку не идёт. */
const skipExportNode = (n: Node) =>
  !(n instanceof HTMLElement && n.dataset.exportSkip !== undefined);

/**
 * «Скачать картинкой»: снимок DOM-узла схемы случая в PNG. Только сайт — в
 * WebView Telegram скачивание файла ненадёжно (осознанное решение, мини-апп
 * картинку не скачивает). html-to-image уже в бандле сайта (экспорт карты
 * режимов), отдельным чанком его не выделить — поэтому статический импорт.
 *
 * Фон — реальный фон страницы (body), иначе прозрачные клетки на тёмной теме
 * превращаются в чёрный квадрат с чёрным текстом.
 */
export function useConceptGraphImage(target: RefObject<HTMLElement | null>) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = useCallback(async () => {
    const node = target.current;
    if (!node) return;
    setBusy(true);
    setFailed(false);
    try {
      const url = await toPng(node, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        pixelRatio: 2,
        filter: skipExportNode,
      });
      const a = document.createElement('a');
      a.download = CONCEPT_IMAGE_FILENAME;
      a.href = url;
      a.click();
    } catch (e) {
      setFailed(true);
      reportClientError({
        message: `concept graph image failed: ${e instanceof Error ? e.message : 'unknown'}`,
        section: 'therapist.conceptGraph',
      });
    } finally {
      setBusy(false);
    }
  }, [target]);

  return { busy, failed, download };
}
