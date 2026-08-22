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
import { CustomizeRow } from './plusMenu/CustomizeRow';
import { useDragReorder } from '../hooks/useDragReorder';
import type { ScreenBlockId } from '../utils/screenBlocks';
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
  orderedIds: ScreenBlockId[];
  reorder: (id: string, toIndex: number, displayedIds?: string[]) => boolean;
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
  orderedIds,
  reorder,
  onPractice,
  onToggleStreak,
  onTogglePhrase,
  onToggleSecondary,
  onToggleTherapistBanner,
  onOpenSettings,
  onClose,
}: Props) {
  const [theme, setTheme] = useState<Theme>(getTheme);

  // Строки блоков — по одному на блок band «Сегодня», в порядке orderedIds.
  // «Фокус дня» без тумблера: главная карточка не скрывается, только
  // переставляется (сама практика выбирается в группе выше).
  const rowMeta: Record<
    string,
    { title: string; sub: string; on?: boolean; onToggle?: () => void }
  > = {
    streak: {
      title: 'Карточка серии',
      sub: 'можно убрать, если счёт дней давит',
      on: !streakHidden,
      onToggle: onToggleStreak,
    },
    focus: { title: 'Фокус дня', sub: 'главное дело — выбирается выше' },
    phrase: {
      title: 'Фраза для себя',
      sub: 'цитата Здорового взрослого на главном',
      on: !phraseHidden,
      onToggle: onTogglePhrase,
    },
    secondary: {
      title: '«Что ещё можно сегодня»',
      sub: 'потребности и дневник под сворачиванием',
      on: secondaryHidden,
      onToggle: onToggleSecondary,
    },
    therapist_banner: {
      title: 'Кабинет терапевта',
      sub: 'баннер входа в кабинет на главном',
      on: !therapistBannerHidden,
      onToggle: onToggleTherapistBanner,
    },
  };
  // Драг идёт по видимому подмножеству: у не-терапевта строки баннера нет.
  const visibleIds = orderedIds.filter(
    (id) => id !== 'therapist_banner' || showTherapistToggle,
  );
  const d = useDragReorder({
    ids: visibleIds,
    onReorder: (id, toIndex) => reorder(id, toIndex, visibleIds),
  });
  const range = { min: 0, max: visibleIds.length - 1 };
  const highlightedId = highlight === 'practice' ? 'focus' : highlight;

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
            style={{ borderRadius: 'var(--r-16)', overflow: 'hidden' }}
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
              borderRadius: 'var(--r-16)',
              padding: '13px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-10)',
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
            эту настройку. Порядок блоков меняется за ручку «≡».
          </div>
          <div
            className="card"
            style={{ borderRadius: 'var(--r-16)', overflow: 'hidden' }}
          >
            {visibleIds.map((id, i) => {
              const meta = rowMeta[id];
              if (!meta) return null;
              return (
                <CustomizeRow
                  key={id}
                  label={meta.title}
                  sub={meta.sub}
                  hidden={meta.onToggle ? !meta.on : undefined}
                  onToggle={meta.onToggle}
                  divider={i > 0}
                  dragHandleProps={d.handleProps(id, meta.title, range)}
                  rowRef={d.registerRow(id)}
                  drag={{ offsetY: d.offsetFor(id), lifted: d.drag?.id === id }}
                  highlighted={highlightedId === id}
                />
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            className="card"
            style={{ borderRadius: 'var(--r-16)', overflow: 'hidden' }}
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
