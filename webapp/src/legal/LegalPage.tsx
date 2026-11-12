// Страница юридического документа (политика, оферта; они же на визитке ?site=personal): корень тянется на
// всю ширину flex-ряда #root (flex: 1 — без него страница липла к левому краю на 1280), колонка чтения по
// центру, шапка — «← На главную», редакция, заголовок, вводная часть. Текст документа страница передаёт
// как есть: оформление здесь и в styles/legal.css, слова — только в pages/PrivacyPage.tsx и OfferPage.tsx.
import type { ReactNode } from 'react';
import '../styles/legal.css';
import { column, backLink, eyebrow, h1, lead as leadSt } from './legalStyles';

export function LegalPage({ date, title, lead, children }: { date: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <div className="lg-root">
      <div className="lg-col" style={column}>
        <a href="/" style={backLink}>← На главную</a>

        <p style={eyebrow}>Редакция от {date}</p>
        <h1 style={h1}>{title}</h1>
        <p style={leadSt}>{lead}</p>
        {children}
      </div>
    </div>
  );
}
