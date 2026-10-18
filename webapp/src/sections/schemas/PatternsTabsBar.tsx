import { PATTERNS_TABS, type PatternsTab } from './patternsTab';

/** Сегмент «Схемы / Режимы / Потребности» под шапкой (телефон). */
export function PatternsTabsBar({ tab, onChange }: { tab: PatternsTab; onChange: (t: PatternsTab) => void }) {
  return (
    <div className="ds-seg cs-seg" role="tablist" aria-label="Раздел паттернов">
      {PATTERNS_TABS.map(t => (
        <button
          key={t.id} role="tab" aria-selected={tab === t.id}
          className={`ds-seg-btn${tab === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >{t.label}</button>
      ))}
    </div>
  );
}
