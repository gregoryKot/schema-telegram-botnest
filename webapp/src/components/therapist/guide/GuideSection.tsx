import type { ReactNode } from 'react';

/**
 * Раздел листа подсказок (режим, техника): подпись и содержимое. Пустой
 * раздел не рисуется — у режима бывают не все четыре канала работы.
 */
export function GuideSection({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  if (!children && !text?.trim()) return null;
  return (
    <section aria-label={title} className="gd-section">
      <h3 className="ds-label gd-label">{title}</h3>
      {text?.trim() ? <p className="gd-text">{text}</p> : null}
      {children}
    </section>
  );
}

/** «Источники» внизу листа, мелко и серым: метки в квадратных скобках в тексте — эти книги. */
export function GuideSources({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="gd-sources">
      <GuideSection title="Источники">
        <p className="ds-sub">{text}</p>
        <p className="ds-sub">Метки в квадратных скобках в тексте — эти книги.</p>
      </GuideSection>
    </div>
  );
}
