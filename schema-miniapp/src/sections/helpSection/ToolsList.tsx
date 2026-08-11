import { useState } from 'react';
import { ToolRow } from '../../components/ToolRow';
import { buildToolRows, ToolRowsProps } from './toolRows';
import { QuickActionCustomizeSheet } from '../../components/plusMenu/QuickActionCustomizeSheet';
import { CustomizeButton } from '../../components/plusMenu/CustomizeButton';
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
      <div
        style={{
          margin: '8px 4px -4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div className="section-label">Инструменты</div>
        <CustomizeButton
          label="Настроить"
          ariaLabel="Настроить список инструментов"
          onClick={() => setShowCustomize(true)}
        />
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
          Все инструменты скрыты. Вернуть их можно через «Настроить» выше.
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
            emoji: r.emoji,
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
