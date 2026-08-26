// BottomNav.tsx — нижняя навигация мини-аппа.
import React from 'react';
import { tapStart } from '../utils/perfLog';

export type Section = 'today' | 'help' | 'schemas' | 'profile';

interface Props {
  section: Section;
  onSelect: (s: Section) => void;
  userRole?: 'CLIENT' | 'THERAPIST';
}

interface TabDef {
  id: Section;
  label: string;
  color: string;
}

// Активная вкладка красится акцентом продукта, а не своим цветом. Четыре
// разных ярких цвета (индиго/розовый/голубой/фиолетовый) были прописаны
// хексами мимо токенов — поэтому на тёплой бумаге снизу светился чужой
// фиолетовый, и тема на него не влияла. Цвет вкладки ничего не сообщает:
// где ты находишься, говорят иконка, подпись и заливка.
const ACTIVE = 'var(--accent)';

const TABS: TabDef[] = [
  { id: 'today', label: 'Сегодня', color: ACTIVE },
  { id: 'help', label: 'Помощь', color: ACTIVE },
  { id: 'schemas', label: 'Паттерны', color: ACTIVE },
  { id: 'profile', label: 'Я', color: ACTIVE },
];

function TabIcon({
  id,
  active,
  color,
  isTherapist: _isTherapist,
}: {
  id: Section;
  active: boolean;
  color: string;
  isTherapist?: boolean;
}) {
  const s: React.CSSProperties = {
    width: 22,
    height: 22,
    color: active ? color : 'var(--text-faint)',
    transition: 'color 0.2s',
  };

  if (id === 'today')
    return (
      <svg
        style={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );

  // «Помощь» — спасательный круг: однозначная метафора поддержки
  // (сердце читалось как «лайк/избранное»). P4 UI-аудита.
  if (id === 'help')
    return (
      <svg
        style={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
        <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
        <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
        <line x1="9.17" y1="14.83" x2="4.93" y2="19.07" />
      </svg>
    );

  // «Паттерны» — линия динамики (пульс), а не стопка слоёв. P4 UI-аудита.
  if (id === 'schemas')
    return (
      <svg
        style={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );

  // profile
  return (
    <svg
      style={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function BottomNav({ section, onSelect, userRole }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid var(--border-color)',
        zIndex: 50,
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      <div style={{ height: 60, display: 'flex' }}>
        {TABS.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              // Точка отсчёта замера тапа (perfLog): pointerdown — момент
              // касания пальцем, click на телефоне приходит позже.
              // e.timeStamp — время САМОГО касания: если главный поток был
              // занят, обработчик запустится позже, и разница = очередь.
              onPointerDown={(e) => tapStart(tab.id, e.timeStamp)}
              onClick={() => onSelect(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-4)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0 0',
                WebkitTapHighlightColor: 'transparent',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 'var(--space-4)',
                }}
              >
                {active && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-6px -10px',
                      borderRadius: 'var(--r-12)',
                      // 6%, не общий --accent-bg (12%): текст на плашке — тот
                      // же --accent, заливка той же насыщенности съедает его
                      // контраст (a11y-smoke: 4.27:1 → 4.62:1 light/5.44 dark).
                      background:
                        'color-mix(in srgb, var(--accent) 6%, transparent)',
                      border: '1px solid var(--line)',
                    }}
                  />
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <TabIcon
                    id={tab.id}
                    active={active}
                    color={tab.color}
                    isTherapist={userRole === 'THERAPIST'}
                  />
                </div>
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    letterSpacing: '0.03em',
                    color: active ? tab.color : 'var(--text-faint)',
                    transition: 'color 0.2s',
                  }}
                >
                  {tab.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
