import { useState } from 'react';
import { ToolRow } from '../../components/ToolRow';
import { buildToolRows, ToolRowsProps } from './toolRows';
import { QuickActionCustomizeSheet } from '../../components/plusMenu/QuickActionCustomizeSheet';
import type { QuickActionId } from '../../utils/quickActions';
import {
  getHiddenActions,
  setActionHidden,
  TOOLS_ACTIONS_HIDDEN_KEY,
} from '../../utils/quickActionPrefs';

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
// поля (ToolRowsProps), callbacks — свои 10 колбэков. Короче сигнатура —
// короче файл (файл уже в бейслайне храповика размера, правило №10).
export function ToolsList(props: Props) {
  const [hidden, setHidden] = useState<string[]>(() =>
    getHiddenActions(TOOLS_ACTIONS_HIDDEN_KEY),
  );
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
  const visibleRows = rows.filter((r) => !hidden.includes(r.id));
  function handleToggle(id: string, nextHidden: boolean) {
    setActionHidden(TOOLS_ACTIONS_HIDDEN_KEY, id, nextHidden);
    setHidden((prev) =>
      nextHidden ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }
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
        <button
          onClick={() => setShowCustomize(true)}
          aria-label="Настроить список инструментов"
          style={{
            minHeight: 44,
            padding: '6px 10px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text-sub)',
          }}
        >
          Настроить
        </button>
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
          actions={rows.map((r) => ({
            id: r.id,
            emoji: r.emoji,
            label: r.label,
            sub: r.sub ?? '',
          }))}
          hidden={hidden}
          onToggle={handleToggle}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </>
  );
}
