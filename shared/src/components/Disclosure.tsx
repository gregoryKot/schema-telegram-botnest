import { useState, type ReactNode } from 'react';

/** Классы вида сайта (ds-fold); без них — инлайн-вид мини-аппа. */
export interface DisclosureClasses {
  root: string;
  btn: string;
  label: string;
  chev: string;
  body: string;
}

/**
 * Раскрывашка: кнопка-заголовок (≥44, aria-expanded, видна всегда, не только
 * по :hover) и содержимое под ней. `defaultOpen` — только начальное состояние:
 * дальше решает человек. Закрытое содержимое не монтируется.
 */
export function Disclosure({
  title,
  defaultOpen = false,
  children,
  classes,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  classes?: DisclosureClasses;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (classes) {
    return (
      <div className={classes.root}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={classes.btn}
        >
          <span className={classes.label}>{title}</span>
          <span className={classes.chev} aria-hidden="true" />
        </button>
        {open && <div className={classes.body}>{children}</div>}
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
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
        }}
      >
        <span>{title}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}
