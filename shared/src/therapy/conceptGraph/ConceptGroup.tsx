import type { ReactNode } from 'react';
import type { SheetLook } from '../../theme/entityLook';
import { useConceptPaper } from './conceptPaper';

/**
 * Группа чипов выбора (домен схем, группа режимов): на сайте — тихая группа
 * (SignGroup `plain`): шапка со знаком, как у клиента, и чипы на поверхности
 * карточки, без цветного листа на каждую группу; цвет несут выбранные чипы.
 * Без заголовка (схемы режима одним рядом) или без сайта — только ряд чипов.
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
      <paper.Group look={look} title={title} rowsClassName="cg-pick-rows" plain>
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
