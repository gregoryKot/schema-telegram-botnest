import { useEffect, useMemo, useState } from 'react';
import type { Tr } from '../../../../shared/src/needs/types';
import { loadGuide, type Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import { buildReference } from '../../sections/guide/guideReferenceModel';
import { buildReferenceBody } from '../../sections/guide/guideReferenceBody';
import type { PaletteGuide } from './paletteRows';

/**
 * Тексты «Справочника» для общего поиска: тот же ленивый чанк, что у справочника (guideLoader), и только
 * в кабинете терапевта — клиенту чанк не грузится. Грузится или не загрузился — null: группы листов нет.
 */
export function usePaletteGuide(enabled: boolean, tr: Tr): PaletteGuide | null {
  const [texts, setTexts] = useState<Guide | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadGuide().then((m) => { if (alive) setTexts(m); }, () => { if (alive) setTexts(null); });
    return () => { alive = false; };
  }, [enabled]);
  return useMemo(
    () => (enabled && texts ? { ref: buildReference(texts, tr), body: buildReferenceBody(texts, tr) } : null),
    [enabled, texts, tr],
  );
}
