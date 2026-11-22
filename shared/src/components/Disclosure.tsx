import { useId, useState, type CSSProperties, type ReactNode } from 'react';

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
 * Раскрывашка — одна механика на все места (№3): кнопка-заголовок (≥44, aria-expanded, не по :hover) и тело под ней.
 * `defaultOpen` — только начальное состояние; `open` с `onToggle` — раскрытие снаружи (справочник держит один домен).
 * `keepMounted` — закрытое тело в DOM под `hidden`, кнопка ссылается на него aria-controls («Выполнено» не перезапрашивается).
 */
export function Disclosure({
  title,
  lead,
  sub,
  defaultOpen = false,
  open: openProp,
  onToggle,
  keepMounted = false,
  chev,
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
  keepMounted?: boolean;
  /** Свой глиф в шевроне (SVG места); переворачивает CSS по aria-expanded, как ds-fold-chev. */
  chev?: ReactNode;
  classes?: DisclosureClasses;
  /** Свой вид поверх classes.root (sd-why — тихая строка без карточки). */
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const bodyId = useId();
  const open = openProp ?? own;
  const root = [classes?.root, className].filter(Boolean).join(' ');
  return (
    <div className={root || undefined} style={style}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={keepMounted ? bodyId : undefined}
        onClick={onToggle ?? (() => setOwn((v) => !v))}
        className={classes?.btn}
        style={classes ? undefined : INLINE_BTN}
      >
        {lead}
        <span className={classes?.label || undefined}>{title}</span>
        {sub}
        <span className={classes?.chev} aria-hidden="true">
          {classes ? chev : open ? '▴' : '▾'}
        </span>
      </button>
      {(open || keepMounted) && (
        <div id={bodyId} className={classes?.body} hidden={!open}>
          {children}
        </div>
      )}
    </div>
  );
}
