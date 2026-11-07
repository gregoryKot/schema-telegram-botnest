import type { ReactNode } from 'react';
import { guideTextStyle } from './guideStyles';

/**
 * Раздел листа подсказок (режим, техника): подпись и содержимое. Пустой
 * раздел не рисуется — у режима бывают не все четыре канала работы.
 */
export function GuideSection({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  if (!children && !text?.trim()) return null;
  return (
    <section aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <h3 className="ds-label" style={{ margin: 0 }}>{title}</h3>
      {text?.trim() ? <p style={guideTextStyle}>{text}</p> : null}
      {children}
    </section>
  );
}

/** «Источники»: метки книг в квадратных скобках, мелко и серым. */
export function GuideSources({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <GuideSection title="Источники">
      <p className="ds-sub" style={{ margin: 0 }}>{text}</p>
    </GuideSection>
  );
}
