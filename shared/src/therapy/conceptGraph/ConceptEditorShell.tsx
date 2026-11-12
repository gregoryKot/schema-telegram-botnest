import { useEffect, useRef, type ReactNode } from 'react';
import type { SheetLook } from '../../theme/entityLook';
import { hueVar } from './conceptChipStyle';
import { ConceptSign } from './conceptPaper';

/**
 * Оболочка редактора режима или схемы — «лист-герой + форма»: бумага группы
 * режима или домена схемы — только шапка (знак, название, «Готово»), поля ниже
 * одной белой карточкой (форма целиком на насыщенном листе давала ~500px
 * сплошного цвета, ревью g11 r1). Открывается инлайн под диаграммой (не оверлей — ему не нужна
 * ни история браузера, ни реестр «Назад»), а фигура может стоять высоко над
 * ним — редактор подъезжает к глазам. В картинку схемы не идёт.
 */
export function ConceptEditorShell({
  look,
  label,
  title,
  sub,
  onClose,
  onRemove,
  removeLabel,
  children,
}: {
  /** Бумага и знак; неизвестная группа или домен — солома без знака. */
  look: SheetLook | null;
  /** Имя области для ридера. */
  label: string;
  title: string;
  sub?: string;
  onClose: () => void;
  /** «Убрать …»: снимает фигуру и закрывает редактор. */
  onRemove: () => void;
  removeLabel: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);
  return (
    <section
      ref={ref}
      data-export-skip
      aria-label={label}
      className="cg-editor"
    >
      <div className="pp-paper cg-editor-head" style={hueVar(look?.hue ?? 70)}>
        <ConceptSign sign={look?.sign} size="square" />
        <div className="cg-editor-title">
          <div className="cg-editor-name">{title}</div>
          {sub && <div className="cg-editor-sub">{sub}</div>}
        </div>
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm"
          onClick={onClose}
        >
          Готово
        </button>
      </div>
      <div className="cg-editor-body">
        {children}
        <button
          type="button"
          className="ds-btn ds-btn--secondary ds-btn--sm cg-remove"
          onClick={() => {
            onRemove();
            onClose();
          }}
        >
          {removeLabel}
        </button>
      </div>
    </section>
  );
}
