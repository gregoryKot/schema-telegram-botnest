import { useState } from 'react';
import { ToolRow } from '../../components/ToolRow';
import { buildToolRows, ToolRowsProps } from './toolRows';
import { QuickActionCustomizeSheet } from '../../components/plusMenu/QuickActionCustomizeSheet';
import type { QuickActionId } from '../../utils/quickActions';
import { TOOLS_ACTIONS_HIDDEN_KEY } from '../../utils/quickActionPrefs';
import { useHiddenActions } from '../../utils/useHiddenActions';
import {
  TOOLS_ACTIONS_ORDER_KEY,
  withDragRange,
} from '../../utils/quickActionOrder';
import { useQuickActionOrder } from '../../utils/useQuickActionOrder';

// Строки блока «Инструменты» — из toolRows.ts, общего с листом настройки
// видимости (QuickActionCustomizeSheet, правило «одна механика — компонент»).
//
// Ж2 (аудит 2026-08): раньше здесь рядом с заголовком была ещё и пилюля
// «Настроить» — второй вход в тот же лист, что и шестерёнка в HelpHeader.
// Оставлен один вход (шестерёнка, см. HelpHeader.tsx) — пилюля убрана, лист
// по-прежнему открывается через customizeOpenRef, состояние листа (`show
// Customize`) остаётся здесь.
interface Props extends ToolRowsProps {
  onOpenTasks: () => void;
  onOpenPractices: () => void;
  onOpenPlans: () => void;
  onOpenBeliefCheck: () => void;
  onOpenPhraseCheck: () => void;
  onOpenSafePlace: () => void;
  onOpenLetterToSelf: () => void;
  onOpenFlashcard: () => void;
  onOpenChildhoodWheel: () => void;
  onOpenWarmWords: () => void;
  customizeOpenRef?: React.MutableRefObject<() => void>; // шапка HelpSection
}
// props целиком, без деструктуризации (файл в бейслайне размера, №10).
export function ToolsList(props: Props) {
  const [hidden, handleToggle] = useHiddenActions(TOOLS_ACTIONS_HIDDEN_KEY);
  const [showCustomize, setShowCustomize] = useState(false);
  if (props.customizeOpenRef)
    props.customizeOpenRef.current = () => setShowCustomize(true);
  const callbacks: Partial<Record<QuickActionId, () => void>> = {
    phrase_check: props.onOpenPhraseCheck,
    tasks: props.onOpenTasks,
    practices: props.onOpenPractices,
    plans: props.onOpenPlans,
    belief_check: props.onOpenBeliefCheck,
    safe_place: props.onOpenSafePlace,
    letter_to_self: props.onOpenLetterToSelf,
    flashcard: props.onOpenFlashcard,
    childhood_wheel: props.onOpenChildhoodWheel,
    warm_words: props.onOpenWarmWords,
  };
  const rows = buildToolRows(props);
  const { ordered, onReorder } = useQuickActionOrder(TOOLS_ACTIONS_ORDER_KEY, [
    rows,
  ]);
  const orderedRows = ordered[0];
  const visibleRows = orderedRows.filter((r) => !hidden.includes(r.id));
  return (
    <>
      <div className="section-label" style={{ margin: '8px 4px -4px' }}>
        Инструменты
      </div>

      {visibleRows.length === 0 ? (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            padding: 4,
          }}
        >
          Все инструменты скрыты. Вернуть их можно через шестерёнку в шапке.
        </div>
      ) : (
        visibleRows.map((row, index) => (
          <ToolRow
            key={row.id}
            label={row.label}
            sub={row.sub}
            index={index}
            onClick={() => callbacks[row.id]?.()}
          />
        ))
      )}
      {showCustomize && (
        <QuickActionCustomizeSheet
          title="Какие инструменты показывать"
          surface="tools"
          actions={withDragRange([orderedRows]).map((r) => ({
            id: r.id,
            label: r.label,
            sub: r.sub ?? '',
            rangeMin: r.rangeMin,
            rangeMax: r.rangeMax,
          }))}
          hidden={hidden}
          onToggle={handleToggle}
          onReorder={onReorder}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}
