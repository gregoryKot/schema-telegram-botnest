import type { ReactNode } from 'react';
import type { SheetLook } from '../../theme/entityLook';
import { useConceptPaper } from './conceptPaper';

/**
 * Группа чипов выбора (домен схем, группа режимов): на сайте — лист бумаги
 * домена или группы со знаком в шапке (SignGroup, тот же вид, что у клиента),
 * внутри белое поле с чипами. Без заголовка (схемы режима одним рядом) или без
 * сайта — только ряд чипов, заголовок текстом.
 */
export function ConceptGroup({
  look,
  title,
  children,
}: {
  look: SheetLook | null;
  title?: string;
  children: ReactNode;
}) {
  const paper = useConceptPaper();
  if (paper && look && title) {
    return (
      <paper.Group look={look} title={title} rowsClassName="cg-pick-rows">
        {children}
      </paper.Group>
    );
  }
  return (
    <div>
      {title && <div className="cg-group-title">{title}</div>}
      <div className="cg-pick-rows cg-pick-rows--bare">{children}</div>
    </div>
  );
}
