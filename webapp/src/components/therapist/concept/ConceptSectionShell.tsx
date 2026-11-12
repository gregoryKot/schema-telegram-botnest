import type { ReactNode } from 'react';
import type { SignKey } from '../../../../../shared/src/theme/entityLook';
import { SignArt } from '../../art/SignArt';
import { sectionAnchor } from './conceptSections';

// Оболочка нумерованного раздела: номер капителью, знак раздела строчного размера (у «Стилей
// совладания» — три знака копингов вплотную), заголовок ds-h3 и подсказка.
export function ConceptSectionShell({ id, n, title, hint, signs, children }: {
  id: string; n: string; title: string;
  hint?: string;
  signs?: readonly SignKey[];
  children: ReactNode;
}) {
  return (
    <section id={sectionAnchor(id)} className="tcp-sec">
      <div className="tcp-sec-head">
        <span className="ds-label">{n}</span>
        {signs && <span className="tcp-sec-signs" aria-hidden="true">{signs.map((s) => <SignArt key={s} sign={s} size="row" />)}</span>}
        <div className="tcp-sec-text">
          <h3 className="ds-h3">{title}</h3>
          {hint && <div className="tcp-sec-hint">{hint}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

export interface FieldProps { value: string; onChange: (v: string) => void; placeholder: string }
