// Текст строки общего поиска с подсвеченным совпадением (диапазоны — shared/src/search/highlight.ts).
import type { ReactNode } from 'react';
import { highlightRanges } from '../../../../shared/src/search/highlight';

export function Hit({ text, query }: { text: string; query: string }) {
  const parts: ReactNode[] = [];
  let at = 0;
  highlightRanges(text, query).forEach(([from, to]) => {
    parts.push(text.slice(at, from), <mark key={from} className="cmd-hit">{text.slice(from, to)}</mark>);
    at = to;
  });
  return <>{parts}{text.slice(at)}</>;
}
