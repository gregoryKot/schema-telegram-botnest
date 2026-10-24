import type { ReactNode } from 'react';
import { sectionAnchor } from './conceptSections';

// Оболочка нумерованного раздела: номер Literata, H3 и подсказка.
export function ConceptSectionShell({ id, n, title, hint, children }: {
  id: string;
  n: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section id={sectionAnchor(id)} className="tcp-sec">
      <div className="tcp-sec-head">
        <span className="tcp-sec-n">{n}</span>
        <div>
          <h3 className="tcp-sec-title">{title}</h3>
          {hint && <div className="tcp-sec-hint">{hint}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

export interface FieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}
