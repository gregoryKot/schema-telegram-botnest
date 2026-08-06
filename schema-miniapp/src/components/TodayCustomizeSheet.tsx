// Лист «Настроить экран» (волна 2 нейродизайна): что показывать на «Сегодня»
// и как. Живёт прямо на экране (правило «управление там, где пользователь и
// так идёт»): выбор главной практики, тема, скрытие серии / баннера кабинета /
// второстепенного, и вход в общие настройки приложения. iOS-группы (правило
// «одна механика — один компонент»): переиспользует Row/Toggle/ThemeIcon/
// SettingsLabel и стиль `.card` из settingsSheet — та же грамматика, что и в
// общих настройках.
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { FOCUS_OPTIONS, FocusPractice } from '../utils/todayFocus';
import { getTheme, toggleTheme, Theme } from '../utils/theme';
import { ToggleRow } from './todayCustomize/ToggleRow';
import { Row, SettingsLabel, ThemeIcon, Toggle } from './settingsSheet/ui';

// Какую строку подсветить при открытии: долгое нажатие на блок открывает лист
// и показывает, где этот блок выключается (иначе жест приводит «куда-то в
// настройки», и человек сам ищет нужный тумблер).
export type CustomizeHighlight = 'practice' | 'streak' | 'phrase';

interface Props {
  practice: FocusPractice;
  streakHidden: boolean;
  phraseHidden: boolean;
  highlight?: CustomizeHighlight;
  secondaryHidden: boolean;
  therapistBannerHidden: boolean;
  showTherapistToggle: boolean;
  onPractice: (p: FocusPractice) => void;
  onToggleStreak: () => void;
  onTogglePhrase: () => void;
  onToggleSecondary: () => void;
  onToggleTherapistBanner: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function TodayCustomizeSheet({
  practice,
  streakHidden,
  phraseHidden,
  highlight,
  secondaryHidden,
  therapistBannerHidden,
  showTherapistToggle,
  onPractice,
  onToggleStreak,
  onTogglePhrase,
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

        <div style={{ marginTop: 16 }}>
          <SettingsLabel>Одно дело на сегодня</SettingsLabel>
          <div
            className="card"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            {FOCUS_OPTIONS.map((opt, i) => {
              const active = opt.id === practice;
              return (
                <Row
                  key={opt.id}
                  label={opt.label}
                  sub={opt.sub}
                  divider={i > 0}
                  color={active ? 'var(--accent)' : undefined}
                  onClick={() => onPractice(opt.id)}
                  right={
                    active ? (
                      <span
                        style={{
                          color: 'var(--accent)',
                          fontWeight: 800,
                          fontSize: 15,
                        }}
                      >
                        ✓
                      </span>
                    ) : (
                      <span />
                    )
                  }
                />
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SettingsLabel>Оформление</SettingsLabel>
          <div
            className="card"
            style={{
              borderRadius: 16,
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ThemeIcon theme={theme} />
            <div
              style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--text)',
              }}
            >
              {theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}
            </div>
            <Toggle
              on={theme === 'light'}
              onClick={() => setTheme(toggleTheme())}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <SettingsLabel>Показывать на главном</SettingsLabel>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-faint)',
              lineHeight: 1.5,
              margin: '0 4px 8px',
            }}
          >
            Подсказка: долгое нажатие на любой блок главного экрана открывает
            эту настройку.
          </div>
          <div
            className="card"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <ToggleRow
              emoji="🔥"
              title="Карточка серии"
              sub="можно убрать, если счёт дней давит"
              on={!streakHidden}
              onToggle={onToggleStreak}
              highlighted={highlight === 'streak'}
            />
            <ToggleRow
              emoji="💬"
              title="Фраза для себя"
              sub="цитата Здорового взрослого на главном"
              on={!phraseHidden}
              onToggle={onTogglePhrase}
              highlighted={highlight === 'phrase'}
              divider
            />
            <ToggleRow
              emoji="🗂"
              title="«Что ещё можно сегодня»"
              sub="потребности и дневник под сворачиванием"
              on={secondaryHidden}
              onToggle={onToggleSecondary}
              divider
            />
            {showTherapistToggle && (
              <ToggleRow
                emoji="🧑‍⚕️"
                title="Кабинет терапевта"
                sub="баннер входа в кабинет на главном"
                on={!therapistBannerHidden}
                onToggle={onToggleTherapistBanner}
                divider
              />
            )}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            className="card"
            style={{ borderRadius: 16, overflow: 'hidden' }}
          >
            <Row label="Общие настройки приложения" onClick={onOpenSettings} />
          </div>
        </div>

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
