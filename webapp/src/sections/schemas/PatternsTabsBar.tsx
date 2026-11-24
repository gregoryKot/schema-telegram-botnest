import { LineTabs } from '../../components/LineTabs';
import { PATTERNS_TABS, type PatternsTab } from './patternsTab';

/** Вкладки «Схемы / Режимы / Потребности» под шапкой (телефон). */
export function PatternsTabsBar({ tab, onChange }: { tab: PatternsTab; onChange: (t: PatternsTab) => void }) {
  return <LineTabs tabs={PATTERNS_TABS} value={tab} onPick={onChange} label="Раздел паттернов" look="fill" className="cs-tabs" />;
}
