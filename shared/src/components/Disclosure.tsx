import { useState, type CSSProperties, type ReactNode } from 'react';

/** Классы вида: общий ds-fold сайта (DS_FOLD) или свои (аккордеон карты схем); без них — инлайн-вид. */
export interface DisclosureClasses {
  root: string;
  btn: string;
  label: string;
  chev: string;
  body: string;
}

/** Раскрывашка сайта — ds-fold (webapp/src/styles/cabinet.css): карточка, заголовок капителью, шеврон. */
export const DS_FOLD: DisclosureClasses = {
  root: 'ds-fold',
  btn: 'ds-fold-btn',
  label: 'ds-label',
  chev: 'ds-fold-chev',
  body: 'ds-fold-body',
};

const INLINE_BTN: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-6)',
  minHeight: 44,
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-sub)',
  fontSize: 13,
  fontWeight: 600,
};

/**
 * Раскрывашка — одна механика на все места (№3): кнопка-заголовок (≥44, aria-expanded,
 * видна всегда, не только по :hover) и содержимое под ней; закрытое не монтируется.
 * `defaultOpen` — только начальное состояние, дальше решает человек; `open` с `onToggle` —
 * раскрытие снаружи (справочник держит открытым один домен).
 */
export function Disclosure({
  title,
  lead,
  sub,
  defaultOpen = false,
  open: openProp,
  onToggle,
  classes,
  className,
  style,
  children,
}: {
  /** Подпись кнопки: строка или разметка (название с подписью из данных у карты схем). */
  title: ReactNode;
  /** До подписи — знак домена или группы. */
  lead?: ReactNode;
  /** После подписи — вторая строка заголовка («Зачем это?» → «Рефлексия помогает»). */
  sub?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: () => void;
  classes?: DisclosureClasses;
  /** Свой вид поверх classes.root (sd-why — тихая строка без карточки). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const root = [classes?.root, className].filter(Boolean).join(' ');
  return (
    <div className={root || undefined} style={style}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle ?? (() => setOwn((v) => !v))}
        className={classes?.btn}
        style={classes ? undefined : INLINE_BTN}
      >
        {lead}
        <span className={classes?.label}>{title}</span>
        {sub}
        <span className={classes?.chev} aria-hidden="true">
          {classes ? null : open ? '▴' : '▾'}
        </span>
      </button>
      {open && <div className={classes?.body}>{children}</div>}
    </div>
  );
}
