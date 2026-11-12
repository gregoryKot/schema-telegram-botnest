import type { ReactNode } from 'react';

// Слово с дефисом в тексте самого человека («по-человечески», «кто-то») не рвётся на дефисе, но знаки остаются
// его: слово целиком — в span без переноса, а не U+2011, как в glue() для наших строк. Неразрывный дефис в тексте
// человека ломал бы копирование и поиск («кто-то» не находится, g3 r5 — поэтому glueSpaces дефисы не трогает).
// Те же слова, что держит keepHyphens в typo.ts: «по-…» и частицы -то/-либо/-нибудь/-ка. Записки «Тёплых слов»:
// «Забыть — по-/человечески» рвалось на 768 (ревью g6).
const HYPHEN_WORD = /([а-яё]+(?:-[а-яё]+)+)/i;
const KEEP = /^по-|-(?:то|либо|нибудь|ка)$/i;

export function keepHyphenWords(text: string): ReactNode {
  const parts = text.split(new RegExp(HYPHEN_WORD.source, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((p, i) =>
    i % 2 === 1 && KEEP.test(p) ? (
      <span key={i} style={{ whiteSpace: 'nowrap' }}>
        {p}
      </span>
    ) : (
      p
    ),
  );
}
