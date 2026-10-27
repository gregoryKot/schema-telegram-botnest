import { useState } from 'react';
import type { Section } from '../components/appShell/navigation';
import { JourneySheet } from '../components/JourneySheet';
import { WhySheet } from '../components/WhySheet';
import '../styles/client-more.css';

interface Props {
  onNavigate: (s: Section) => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
  onOpenAdvanced: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  onOpenTherapistCabinet?: () => void;
}

interface Row { id: string; title: string; sub: string; onClick: () => void }

// «Ещё»: всё, что не входит в три действия главной (docs/design/CLIENT_SIMPLE_2026-10.md).
// Разделы /schemas, /practice, /profile остаются на своих адресах — отсюда в них заходят.
export function MoreSection({ onNavigate, onOpenSchema, onOpenAdvanced, userRole, onOpenTherapistCabinet }: Props) {
  const [why, setWhy] = useState(false);
  const [journey, setJourney] = useState(false);

  const rows: Row[] = [
    { id: 'why', title: 'Зачем это всё', sub: 'Откуда это и что даёт каждое действие', onClick: () => setWhy(true) },
    { id: 'schemas', title: 'Мои паттерны', sub: 'Схемы и режимы', onClick: () => onNavigate('schemas') },
    { id: 'practice', title: 'Практики', sub: 'Дыхание, упражнения, планы', onClick: () => onNavigate('practice') },
    { id: 'journey', title: 'Мой путь', sub: 'Всё, что уже собрано', onClick: () => setJourney(true) },
    { id: 'therapist', title: 'Терапевт', sub: 'Связь и ближайшая встреча', onClick: () => onNavigate('profile') },
    ...(userRole === 'THERAPIST' && onOpenTherapistCabinet
      ? [{ id: 'cabinet', title: 'Кабинет терапевта', sub: 'Клиенты и сессии', onClick: onOpenTherapistCabinet }]
      : []),
    { id: 'test', title: 'Тест на схемы', sub: 'Какие схемы откликаются', onClick: () => onOpenSchema({ startTest: true }) },
    { id: 'settings', title: 'Настройки', sub: 'Напоминания, обращение, данные', onClick: onOpenAdvanced },
    { id: 'profile', title: 'Профиль', sub: 'Имя, аккаунт, данные', onClick: () => onNavigate('profile') },
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
            <button type="button" className="cm-row" onClick={r.onClick}>
              <span className="cm-row-body">
                <span className="cm-row-title">{r.title}</span>
                <span className="cm-row-sub">{r.sub}</span>
              </span>
              <span className="cm-row-arrow" aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="cm-sos" onClick={() => onNavigate('practice')}>Мне очень плохо</button>

      {why && <WhySheet onClose={() => setWhy(false)} />}
      {journey && <JourneySheet onClose={() => setJourney(false)} />}
    </div>
  );
}
