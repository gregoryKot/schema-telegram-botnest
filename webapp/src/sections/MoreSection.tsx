import { useState } from 'react';
import type { Section } from '../components/appShell/navigation';
import { JourneySheet } from '../components/JourneySheet';
import { WhySheet } from '../components/WhySheet';
import { useTherapyTarget } from '../components/therapy/useTherapyTarget';
import { useTherapyBridgeTexts } from '../components/therapy/useTherapyBridgeTexts';
import { ExternalLink } from '../host/ExternalLink';
import { trackHomeTile } from './today/trackHomeTile';
import '../styles/client-more.css';

interface Props {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
  onOpenAdvanced: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

interface Row { id: string; title: string; sub: string; onClick: () => void; href?: string }

function RowBody({ row }: { row: Row }) {
  return (
    <>
      <span className="cm-row-body">
        <span className="cm-row-title">{row.title}</span>
        <span className="cm-row-sub">{row.sub}</span>
      </span>
      <span className="cm-row-arrow" aria-hidden="true">→</span>
    </>
  );
}

// «Ещё»: всё, что не входит в три действия главной (docs/design/CLIENT_SIMPLE_2026-10.md).
// Разделы /schemas, /practice, /profile остаются на своих адресах — отсюда в них заходят.
export function MoreSection({ onNavigate, onOpenSchema, onOpenAdvanced, userRole, onOpenTherapistCabinet }: Props) {
  const [why, setWhy] = useState(false);
  const [journey, setJourney] = useState(false);
  const bridge = useTherapyBridgeTexts();
  const target = useTherapyTarget('more');
  // Терапевту строка «поговорить» не нужна. Подключён терапевт — сразу ссылка на него, иначе лист с записью к автору.
  const talkRow: Row[] = userRole === 'THERAPIST' || target.hidden
    ? []
    : target.write
      ? [{ id: 'talk', title: bridge.moreWriteTitle, sub: bridge.moreWriteSub, href: target.write.url, onClick: target.write.onClick }]
      : [{ id: 'talk', title: bridge.moreTalkTitle, sub: bridge.moreTalkSub, onClick: target.open }];

  const rows: Row[] = [
    { id: 'why', title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: () => { trackHomeTile('why'); setWhy(true); } },
    { id: 'schemas', title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => onNavigate('schemas') },
    { id: 'practice', title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => onNavigate('practice') },
    { id: 'journey', title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: () => setJourney(true) },
    ...talkRow,
    ...(userRole === 'THERAPIST' && onOpenTherapistCabinet
      ? [{ id: 'cabinet', title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: onOpenTherapistCabinet }]
      : []),
    { id: 'test', title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => onOpenSchema({ startTest: true }) },
    { id: 'settings', title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: onOpenAdvanced },
    { id: 'profile', title: 'Профиль', sub: 'Портрет, терапевт, ближайшая встреча', onClick: () => onNavigate('profile') },
  ];

  return (
    <div className="ds-page cm-page">
      <header>
        <div className="ds-eyebrow">Ещё</div>
        <h1 className="ds-h1 cm-h1">Всё остальное</h1>
      </header>

      <ul className="cm-list">
        {rows.map(r => (
          <li key={r.id}>
            {r.href ? (
              <ExternalLink className="cm-row" href={r.href} onClick={r.onClick}>
                <RowBody row={r} />
              </ExternalLink>
            ) : (
              <button type="button" className="cm-row" onClick={r.onClick}>
                <RowBody row={r} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <button type="button" className="cm-sos" onClick={() => onNavigate('practice')}>Мне очень плохо</button>

      {why && <WhySheet onClose={() => setWhy(false)} />}
      {target.sheet}
      {journey && <JourneySheet onClose={() => setJourney(false)} />}
    </div>
  );
}
