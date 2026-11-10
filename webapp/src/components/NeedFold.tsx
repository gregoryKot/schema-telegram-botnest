import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  /** Вторая строка заголовка рядом с подписью («Зачем это?» → «Рефлексия помогает»). */
  sub?: ReactNode;
  /** Открыта при первом показе (заметка к дню на компьютере); по умолчанию свёрнута. */
  defaultOpen?: boolean;
  /** Свой вид поверх ds-fold (sd-why — тихая строка без карточки). */
  className?: string;
  children: ReactNode;
}

/** Раскрывающийся блок — общий ds-fold (cabinet.css): карточка с заголовком-кнопкой капителью
 *  и шевроном, тело рендерится только открытым. Лист потребности, концептуализация (#906),
 *  «Зачем это?» у заметки к дню (NoteWhy). Одна механика раскрытия на все места. */
export function NeedFold({ title, sub, defaultOpen = false, className, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={'ds-fold' + (className ? ' ' + className : '')}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="ds-fold-btn" aria-expanded={open}>
        <span className="ds-label">{title}</span>{sub}<span className="ds-fold-chev" aria-hidden="true" />
      </button>
      {open && <div className="ds-fold-body">{children}</div>}
    </div>
  );
}
