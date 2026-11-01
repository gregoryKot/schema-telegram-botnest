// Разметка юридических документов: политика (`pages/PrivacyPage.tsx`) и
// оферта (`pages/OfferPage.tsx`). До 2026-11 у каждой страницы была своя копия
// этих компонентов, и обе страницы были шире экрана телефона: таблица
// реквизитов держала колонку подписи в 220px, а длинные неразрывные значения
// (почта, адреса, имена файлов cookie) раздвигали сетку — при 390px
// `scrollWidth` был 482. Поэтому колонка подписи сжимается до доли ширины, а
// обе ячейки переносят слово где угодно (`minWidth: 0` + `overflowWrap`);
// заголовок и поля страницы тоже ужимаются на узком экране. Замер в настоящем
// браузере — `e2e-browser/public-pages.spec.ts`.
import type { CSSProperties, ReactNode } from 'react';
import { TABLE_ROW_COLUMNS } from './legalStyles';

export function Doc({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 40, marginTop: 48 }}>{children}</div>;
}

export function Chapter({ n, title, id, children }: { n: string; title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id}>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 400, color: 'var(--text)', margin: '0 0 20px', letterSpacing: '-.01em', paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <span style={{ color: 'var(--accent)', marginRight: 10, fontSize: 14, fontFamily: 'inherit', fontStyle: 'normal' }}>{n}.</span>{title}
      </h2>
      <div className="u-col12">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.8, margin: 0 }}>{children}</p>;
}

export function Ul({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7 }}>{item}</li>
      ))}
    </ul>
  );
}

const cellWrap: CSSProperties = { minWidth: 0, overflowWrap: 'anywhere' };

export function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-12)', overflow: 'hidden' }}>
      {rows.map(([label, value], i) => (
        <div key={i} data-testid="legal-table-row" style={{
          display: 'grid', gridTemplateColumns: TABLE_ROW_COLUMNS,
          borderBottom: i < rows.length - 1 ? '1px solid var(--line)' : 'none',
        }}>
          <div style={{ ...cellWrap, padding: '12px 16px', background: 'rgba(var(--fg-rgb),.03)', fontSize: 13, fontWeight: 600, color: 'var(--text-faint)', borderRight: '1px solid var(--line)' }}>{label}</div>
          <div style={{ ...cellWrap, padding: '12px 16px', fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
