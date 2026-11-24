import { Disclosure, DS_FOLD } from '../../../../../shared/src/components/Disclosure';
import { citedSources, sourceLine } from '../../../../../shared/src/schemaTherapy/guide/sources';
import { pluralRu } from '../../../../../shared/src/utils/pluralRu';
import { GuideSection } from './GuideSection';

/**
 * «Источники» листа: ссылки и расшифровка меток по полке книг (sources.ts). На вкладке «Теория» (`open`) — разделом
 * на виду; у листа без вкладок — свёрнутой строкой «Источники · N книг» внизу: нужны для сверки, не на сессии.
 */
export function GuideSources({ text, open }: { text: string; open?: boolean }) {
  if (!text.trim()) return null;
  const lines = citedSources(text).map(sourceLine).filter((l): l is string => l !== null);
  const body = (
    <>
      <p className="ds-sub">{text}</p>
      {lines.length ? <ul className="gd-books">{lines.map((l) => <li key={l} className="ds-sub">{l}</li>)}</ul>
        : <p className="ds-sub">Метки книг в тексте — эти книги.</p>}
    </>
  );
  if (open) return <div className="gd-sources"><GuideSection title="Источники">{body}</GuideSection></div>;
  const title = lines.length ? `Источники · ${lines.length} ${pluralRu(lines.length, 'книга', 'книги', 'книг')}` : 'Источники';
  return (
    <div className="gd-more gd-sources">
      <Disclosure classes={DS_FOLD} title={title}>{body}</Disclosure>
    </div>
  );
}
