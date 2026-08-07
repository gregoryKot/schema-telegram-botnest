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
  withMoveFlags,
} from '../../utils/quickActionOrder';
import { useQuickActionOrder } from '../../utils/useQuickActionOrder';

// Строки блока «Инструменты» живут в toolRows.ts — общий источник для
// рендера и для листа настройки видимости (QuickActionCustomizeSheet, та
// же инфраструктура, что у меню «плюс», правило «одна механика — компонент»).
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
}

// props целиком, без деструктуризации: buildToolRows(props) берёт свои 4
// поля, callbacks — свои 10 колбэков (файл в бейслайне размера, правило №10).
export function ToolsList(props: Props) {
  const [hidden, handleToggle] = useHiddenActions(TOOLS_ACTIONS_HIDDEN_KEY);
  const [showCustomize, setShowCustomize] = useState(false);
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
  const { ordered, onMove } = useQuickActionOrder(TOOLS_ACTIONS_ORDER_KEY, [
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
          actions={withMoveFlags(orderedRows).map((r) => ({
            id: r.id,
            emoji: r.emoji,
            label: r.label,
            sub: r.sub ?? '',
            disabledUp: r.disabledUp,
            disabledDown: r.disabledDown,
          }))}
          hidden={hidden}
          onToggle={handleToggle}
          onMove={onMove}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}
