// BottomNav.tsx — Redesigned bottom navigation
// Place at: src/components/BottomNav.tsx
// Replaces the existing BottomNav component fully.
//
// Changes from original:
//  – Thinner top indicator pill instead of a line
//  – Active icon gets a soft glow (drop-shadow filter)
//  – Each tab has its own accent color
//  – Uses new --surface, --border-color tokens

import React from 'react';

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

const TABS: TabDef[] = [
  { id: 'today', label: 'Сегодня', color: '#7c72f8' },
  { id: 'help', label: 'Помощь', color: '#f472b6' },
  { id: 'schemas', label: 'Паттерны', color: '#60a5fa' },
  { id: 'profile', label: 'Профиль', color: '#a78bfa' },
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
    filter: active ? `drop-shadow(0 0 5px ${color}88)` : 'none',
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
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
      }}
    >
      <div style={{ height: 60, display: 'flex' }}>
        {TABS.map((tab) => {
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
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
                  gap: 4,
                }}
              >
                {active && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: '-6px -10px',
                      borderRadius: 12,
                      background: tab.color + '18',
                      border: `1px solid ${tab.color}30`,
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
