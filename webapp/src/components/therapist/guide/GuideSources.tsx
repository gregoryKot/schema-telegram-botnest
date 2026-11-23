import { Disclosure, DS_FOLD } from '../../../../../shared/src/components/Disclosure';
import { citedSources, sourceLine } from '../../../../../shared/src/schemaTherapy/guide/sources';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';

/** «Источники» внизу листа — свёрнутой строкой «Источники · N книг»: нужны для сверки, не на сессии (sources.ts). */
export function GuideSources({ text }: { text: string }) {
  if (!text.trim()) return null;
  const lines = citedSources(text).map(sourceLine).filter((l): l is string => l !== null);
  const title = lines.length ? `Источники · ${lines.length} ${pluralRu(lines.length, 'книга', 'книги', 'книг')}` : 'Источники';
  return (
    <div className="gd-more gd-sources">
      <Disclosure classes={DS_FOLD} title={title}>
        <p className="ds-sub">{text}</p>
        {lines.length ? <ul className="gd-books">{lines.map((l) => <li key={l} className="ds-sub">{l}</li>)}</ul>
          : <p className="ds-sub">Метки в квадратных скобках в тексте — эти книги.</p>}
      </Disclosure>
    </div>
  );
}
