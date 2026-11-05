import { useState, type ReactNode } from 'react';
import type { Section } from '../components/appShell/navigation';
import { JourneySheet } from '../components/JourneySheet';
import { WhySheet } from '../components/WhySheet';
import { useTherapyTarget } from '../components/therapy/useTherapyTarget';
import { useTherapyBridgeTexts } from '../components/therapy/useTherapyBridgeTexts';
import { ExternalLink } from '../host/ExternalLink';
import { trackHomeTile } from './today/trackHomeTile';
import '../styles/client-more.css';
import { Leaf, Talk, Beads, Heart } from '../components/art/PaperArtSigns';
import { Layers, Sheets, Breath, Pebbles } from '../components/art/PaperArt';

interface Props {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
  onOpenAdvanced: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

interface Row { id: string; title: string; sub: string; onClick: () => void; href?: string; art?: ReactNode }

const ROW_CLASS = 'ds-list-row ds-list-row--nav ds-list-row--hover';
function RowBody({ row }: { row: Row }) {
  return (
    <>
      {row.art && <span className="pp-row-art">{row.art}</span>}<span className="ds-list-body"><span className="ds-list-title">{row.title}</span><span className="ds-list-sub">{row.sub}</span></span>
      <span className="ds-chev" aria-hidden="true" />
    </>
  );
}

// «Ещё»: всё, что не входит в три действия главной (docs/design/CLIENT_SIMPLE_2026-10.md).
// Разделы /schemas, /practice, /profile остаются на своих адресах — отсюда в них заходят. Кризисный вход «Мне очень плохо» — ds-card--crisis (#906).
export function MoreSection({ onNavigate, onOpenSchema, onOpenAdvanced, userRole, onOpenTherapistCabinet }: Props) {
  const [why, setWhy] = useState(false);
  const [journey, setJourney] = useState(false);
  const bridge = useTherapyBridgeTexts();
  const target = useTherapyTarget('more');
  // Терапевту строка «поговорить» не нужна. Подключён терапевт — сразу ссылка на него, иначе лист с записью к автору.
  const talkRow: Row[] = userRole === 'THERAPIST' || target.hidden
    ? []
    : target.write
      ? [{ id: 'talk', art: <Talk size="row" />, title: bridge.moreWriteTitle, sub: bridge.moreWriteSub, href: target.write.url, onClick: target.write.onClick }]
      : [{ id: 'talk', art: <Talk size="row" />, title: bridge.moreTalkTitle, sub: bridge.moreTalkSub, onClick: target.open }];

  const rows: Row[] = [
    { id: 'why', art: <Leaf size="row" />, title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: () => { trackHomeTile('why'); setWhy(true); } },
    { id: 'schemas', art: <Layers size="row" />, title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => onNavigate('schemas') },
    { id: 'practice', art: <Breath size="row" />, title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => onNavigate('practice') },
    { id: 'journey', art: <Sheets size="row" />, title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: () => setJourney(true) },
    ...talkRow,
    ...(userRole === 'THERAPIST' && onOpenTherapistCabinet
      ? [{ id: 'cabinet', title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: onOpenTherapistCabinet }]
      : []),
    { id: 'test', art: <Layers size="row" />, title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => onOpenSchema({ startTest: true }) },
    { id: 'settings', art: <Beads size="row" />, title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: onOpenAdvanced },
    { id: 'profile', art: <Pebbles size="row" />, title: 'Профиль', sub: 'Портрет, терапевт, ближайшая встреча', onClick: () => onNavigate('profile') },
  ];

  return (
    <div className="ds-page cm-page">
      <header className="pp-block cm-head">
        <div className="ds-eyebrow">Ещё</div>
        <h1 className="ds-h1">Всё остальное</h1>
      </header>

      <div className="ds-card ds-card--flush">
        {rows.map(r => r.href ? (
          <ExternalLink key={r.id} className={ROW_CLASS} href={r.href} onClick={r.onClick}>
            <RowBody row={r} />
          </ExternalLink>
        ) : (
          <button key={r.id} type="button" className={ROW_CLASS} onClick={r.onClick}>
            <RowBody row={r} />
          </button>
        ))}
      </div>

      <button type="button" className="ds-card ds-card--row ds-card--nav ds-card--crisis ds-card--hover" onClick={() => onNavigate('practice')}>
        <span className="pp-row-art"><Heart size="row" /></span>
        <span className="ds-list-title">Мне очень плохо</span>
        <span className="ds-chev" aria-hidden="true" />
      </button>

      {why && <WhySheet onClose={() => setWhy(false)} />}
      {target.sheet}
      {journey && <JourneySheet onClose={() => setJourney(false)} />}
    </div>
  );
}
