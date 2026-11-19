import { citedSources, sourceLine } from '../../../../../shared/src/schemaTherapy/guide/sources';
import { GuideSection } from './GuideSection';

/** «Источники» внизу листа, мелко и серым: ссылки и расшифровка меток по полке книг (sources.ts). */
export function GuideSources({ text }: { text: string }) {
  if (!text.trim()) return null;
  const lines = citedSources(text).map(sourceLine).filter((l): l is string => l !== null);
  return (
    <div className="gd-sources">
      <GuideSection title="Источники">
        <p className="ds-sub">{text}</p>
        {lines.length ? (
          <ul className="gd-books">{lines.map((l) => <li key={l} className="ds-sub">{l}</li>)}</ul>
        ) : (
          <p className="ds-sub">Метки в квадратных скобках в тексте — эти книги.</p>
        )}
      </GuideSection>
    </div>
  );
}
