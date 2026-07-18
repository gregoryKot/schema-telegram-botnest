// Лист «Настроить экран» (волна 2 нейродизайна): что показывать на «Сегодня»
// и как. Живёт прямо на экране (правило «управление там, где пользователь и
// так идёт»): выбор главной практики, тема, скрытие серии / баннера кабинета /
// второстепенного, и вход в общие настройки приложения.
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { FOCUS_OPTIONS, FocusPractice } from '../utils/todayFocus';
import { getTheme, toggleTheme, Theme } from '../utils/theme';
import { pressable } from '../utils/a11y';

interface Props {
  practice: FocusPractice;
  streakHidden: boolean;
  secondaryHidden: boolean;
  therapistBannerHidden: boolean;
  showTherapistToggle: boolean;
  onPractice: (p: FocusPractice) => void;
  onToggleStreak: () => void;
  onToggleSecondary: () => void;
  onToggleTherapistBanner: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

function ToggleRow({
  emoji,
  title,
  sub,
  on,
  onToggle,
}: {
  emoji: string;
  title: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      {...pressable(onToggle)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 14,
        cursor: 'pointer',
        background: 'rgba(var(--fg-rgb),0.04)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 1 }}>
          {sub}
        </div>
      </div>
      <span
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: on ? 'var(--accent)' : 'var(--text-faint)',
        }}
      >
        {on ? '✓' : '—'}
      </span>
    </div>
  );
}

export function TodayCustomizeSheet({
  practice,
  streakHidden,
  secondaryHidden,
  therapistBannerHidden,
  showTherapistToggle,
  onPractice,
  onToggleStreak,
  onToggleSecondary,
  onToggleTherapistBanner,
  onOpenSettings,
  onClose,
}: Props) {
  const [theme, setTheme] = useState<Theme>(getTheme);

  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          Настроить экран
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          Главное дело дня — у каждого своё
        </div>

        <div className="section-label" style={{ margin: '16px 4px 8px' }}>
          Одно дело на сегодня
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FOCUS_OPTIONS.map((opt) => {
            const active = opt.id === practice;
            return (
              <div
                key={opt.id}
                {...pressable(() => onPractice(opt.id))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: active
                    ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                    : 'rgba(var(--fg-rgb),0.04)',
                  border: `1.5px solid ${
                    active
                      ? 'color-mix(in srgb, var(--accent) 35%, transparent)'
                      : 'transparent'
                  }`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{opt.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: active ? 'var(--accent)' : 'var(--text)',
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-sub)',
                      marginTop: 1,
                    }}
                  >
                    {opt.sub}
                  </div>
                </div>
                {active && (
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="section-label" style={{ margin: '16px 4px 8px' }}>
          Оформление
        </div>
        <div
          {...pressable(() => setTheme(toggleTheme()))}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 14,
            cursor: 'pointer',
            background: 'rgba(var(--fg-rgb),0.04)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </span>
          <div
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Тема
          </div>
          <span
            style={{ fontSize: 13, color: 'var(--text-sub)', fontWeight: 600 }}
          >
            {theme === 'dark' ? 'Тёмная' : 'Светлая'}
          </span>
        </div>

        <div className="section-label" style={{ margin: '16px 4px 8px' }}>
          Показывать на главном
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow
            emoji="🔥"
            title="Карточка серии"
            sub="можно убрать, если счёт дней давит"
            on={!streakHidden}
            onToggle={onToggleStreak}
          />
          <ToggleRow
            emoji="🗂"
            title="«Что ещё можно сегодня»"
            sub="потребности и дневник под сворачиванием"
            on={secondaryHidden}
            onToggle={onToggleSecondary}
          />
          {showTherapistToggle && (
            <ToggleRow
              emoji="🧑‍⚕️"
              title="Кабинет терапевта"
              sub="баннер входа в кабинет на главном"
              on={!therapistBannerHidden}
              onToggle={onToggleTherapistBanner}
            />
          )}
        </div>

        <button
          {...pressable(onOpenSettings)}
          style={{
            marginTop: 16,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '13px 14px',
            borderRadius: 14,
            border: '1px solid var(--border-color)',
            background: 'var(--surface)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚙️</span>
          <span
            style={{
              flex: 1,
              textAlign: 'left',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
            }}
          >
            Общие настройки приложения
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
        </button>

        <button
          className="btn-primary"
          style={{ marginTop: 10 }}
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
