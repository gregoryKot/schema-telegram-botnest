// Лист «Настроить экран» для «Сегодня» — паритет с мини-аппом
// (schema-miniapp/src/components/TodayCustomizeSheet.tsx): главная практика дня,
// какие блоки показывать и в каком порядке, вход в общие настройки. Тему лист
// не содержит: кабинет сайта только светлый. Логика и ключи хранения общие
// (shared/today), вёрстка — каркас и строки листа (CustomizeSheetFrame, CustomizeRow).
import { useTr } from '../../utils/addressForm';
import { useIsMobile } from '../useIsMobile';
import { useDragReorder } from '../../../../shared/src/hooks/useDragReorder';
import { FOCUS_OPTIONS } from '../../../../shared/src/today/todayFocus';
import {
  TODAY_BLOCK_META, highlightedBlock, visibleTodayBlocks, type TodayBlockId,
} from '../../../../shared/src/today/todayBlocks';
import type { TodayCustomization } from '../../sections/today/useTodayCustomization';
import { CustomizeRow } from './CustomizeRow';
import { CustomizeSheetFrame } from './CustomizeSheetFrame';
import { ReorderHint } from './ReorderHint';

interface Props {
  today: TodayCustomization;
  /** Строка баннера кабинета есть только у специалиста с кабинетом. */
  showTherapistBlock: boolean;
  onOpenSettings: () => void;
}

export function TodayCustomizeSheet({ today, showTherapistBlock, onOpenSettings }: Props) {
  const tr = useTr();
  const phone = useIsMobile();
  const visibleIds = visibleTodayBlocks(today.orderedIds, showTherapistBlock);
  const drag = useDragReorder({
    ids: visibleIds,
    onReorder: (id, toIndex) => today.reorder(id, toIndex, visibleIds),
  });
  const range = { min: 0, max: visibleIds.length - 1 };
  const highlighted = highlightedBlock(today.highlight);

  // on — блок показан. «Что ещё можно сегодня» наоборот: включено = спрятано
  // под сворачивание, поэтому тумблер показывает «свёрнуто».
  const toggles: Partial<Record<TodayBlockId, { on: boolean; onToggle: () => void }>> = {
    streak: { on: !today.streakHidden, onToggle: today.toggleStreak },
    phrase: { on: !today.phraseHidden, onToggle: today.togglePhrase },
    secondary: { on: today.secondaryHidden, onToggle: today.toggleSecondary },
    therapist_banner: { on: !today.therapistBannerHidden, onToggle: today.toggleTherapistBanner },
  };

  return (
    <CustomizeSheetFrame title="Настроить экран" subtitle="Главное дело дня — у каждого своё" onClose={today.closeSheet}>
      {() => (
        <>
          <div className="ds-label cz-group">Одно дело на сегодня</div>
          <div className={'cz-card' + (highlighted === 'focus' ? ' is-hl' : '')} role="radiogroup" aria-label="Главная практика дня">
            {FOCUS_OPTIONS.map((opt) => {
              const active = opt.id === today.practice;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={'cz-row cz-pick' + (active ? ' is-on' : '')}
                  onClick={() => today.choosePractice(opt.id)}
                >
                  <span className="cz-text">
                    <span className="cz-title">{opt.label}</span>
                    <span className="cz-sub">{opt.sub}</span>
                  </span>
                  <span className="cz-check" aria-hidden>{active ? '✓' : ''}</span>
                </button>
              );
            })}
          </div>

          <div className="ds-label cz-group">Показывать на главном</div>
          <ReorderHint tr={tr} phone={phone} />
          <div className="cz-card">
            {visibleIds.map((id) => {
              const meta = TODAY_BLOCK_META[id];
              const toggle = toggles[id];
              return (
                <CustomizeRow
                  key={id}
                  title={meta.title}
                  sub={meta.sub}
                  on={toggle?.on}
                  onToggle={toggle?.onToggle}
                  handle={phone ? drag.handleProps(id, meta.title, range) : undefined}
                  rowRef={drag.registerRow(id)}
                  offsetY={drag.offsetFor(id)}
                  lifted={drag.drag?.id === id}
                  highlighted={highlighted === id}
                />
              );
            })}
          </div>

          <div className="cz-card cz-gap">
            <button type="button" className="cz-row cz-pick" onClick={onOpenSettings}>
              <span className="cz-title">Общие настройки приложения</span>
              <span className="cz-chev" aria-hidden>›</span>
            </button>
          </div>
        </>
      )}
    </CustomizeSheetFrame>
  );
}
