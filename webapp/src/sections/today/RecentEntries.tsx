import { pressable } from '../../utils/a11y';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import { SkeletonLines } from './SkeletonLines';
import { DIARY_KIND_LABEL, type RecentEntry } from './model';

interface Props {
  entries: RecentEntry[];
  loaded: boolean;
  onOpenDiaries: () => void;
}

// «Последние записи»: строка = бейдж типа тона дневника, текст, дата · время.
export function RecentEntries({ entries, loaded, onOpenDiaries }: Props) {
  return (
    <section className="ct-section ct-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">Последние записи</h3>
        <button type="button" className="ds-link" onClick={onOpenDiaries}>Все →</button>
      </div>
      {!loaded ? (
        <SkeletonLines />
      ) : entries.length > 0 ? (
        entries.map((e, i) => (
          <div key={i} className="ds-card ds-card--row ds-card--hover ct-entry" {...pressable(onOpenDiaries)}>
            <span className="ds-chip ds-chip--sm tone-tint" style={hueStyle(DIARY_HUE[e.type])}>{DIARY_KIND_LABEL[e.type]}</span>
            <span className="ct-entry-label">{e.label}</span>
            <span className="ds-sub ct-entry-date">{e.dateStr}{e.time ? ` · ${e.time}` : ''}</span>
          </div>
        ))
      ) : (
        <div className="ds-sub ct-empty">Замечать моменты, когда схема активируется – главная практика</div>
      )}
    </section>
  );
}
