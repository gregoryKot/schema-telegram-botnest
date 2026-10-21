// Лист «Настроить экран» (волна 2 нейродизайна): что показывать на «Сегодня»
// и как. Живёт прямо на экране (правило «управление там, где пользователь и
// так идёт»): выбор главной практики, тема, скрытие серии / баннера кабинета /
// второстепенного, и вход в общие настройки приложения. iOS-группы (правило
// «одна механика — один компонент»): переиспользует Row/Toggle/ThemeIcon/
// SettingsLabel и стиль `.card` из settingsSheet — та же грамматика, что и в
// общих настройках.
import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import {
  FOCUS_OPTIONS,
  FocusPractice,
} from '../../../shared/src/today/todayFocus';
import { getTheme, toggleTheme, Theme } from '../utils/theme';
import { CustomizeRow } from './plusMenu/CustomizeRow';
import { useDragReorder } from '../../../shared/src/hooks/useDragReorder';
import {
  TODAY_BLOCK_META,
  highlightedBlock,
  visibleTodayBlocks,
  type CustomizeHighlight,
  type TodayBlockId,
} from '../../../shared/src/today/todayBlocks';
import { Row, SettingsLabel, ThemeIcon, Toggle } from './settingsSheet/ui';

interface Props {
  practice: FocusPractice;
  streakHidden: boolean;
  phraseHidden: boolean;
  highlight?: CustomizeHighlight;
  secondaryHidden: boolean;
  therapistBannerHidden: boolean;
  showTherapistToggle: boolean;
  orderedIds: TodayBlockId[];
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
  // переставляется (сама практика выбирается в группе выше). Тумблер
  // «Что ещё можно сегодня» работает наоборот: on = блок спрятан под сворачивание.
  const toggles: Partial<
    Record<TodayBlockId, { on: boolean; onToggle: () => void }>
  > = {
    streak: { on: !streakHidden, onToggle: onToggleStreak },
    phrase: { on: !phraseHidden, onToggle: onTogglePhrase },
    secondary: { on: secondaryHidden, onToggle: onToggleSecondary },
    therapist_banner: {
      on: !therapistBannerHidden,
      onToggle: onToggleTherapistBanner,
    },
  };
  // Драг идёт по видимому подмножеству: у не-терапевта строки баннера нет.
  const visibleIds = visibleTodayBlocks(orderedIds, showTherapistToggle);
  const d = useDragReorder({
    ids: visibleIds,
    onReorder: (id, toIndex) => reorder(id, toIndex, visibleIds),
  });
  const range = { min: 0, max: visibleIds.length - 1 };
  const highlightedId = highlightedBlock(highlight);

  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div className="u-pt4">
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

        <div className="u-mt16">
          <SettingsLabel>Одно дело на сегодня</SettingsLabel>
          <div className="card u-r16-clip">
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

        <div className="u-mt16">
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

        <div className="u-mt16">
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
          <div className="card u-r16-clip">
            {visibleIds.map((id, i) => {
              const meta = TODAY_BLOCK_META[id];
              const toggle = toggles[id];
              return (
                <CustomizeRow
                  key={id}
                  label={meta.title}
                  sub={meta.sub}
                  hidden={toggle ? !toggle.on : undefined}
                  onToggle={toggle?.onToggle}
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

        <div className="u-mt16">
          <div className="card u-r16-clip">
            <Row label="Общие настройки приложения" onClick={onOpenSettings} />
          </div>
        </div>

        <button className="btn-primary u-mt10" onClick={onClose}>
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
