import { hasDraft } from '../../utils/drafts';
import { pressable } from '../../utils/a11y';
import { DIARY_HUE, hueStyle } from '../../lib/tone';
import type { DiaryKind } from './model';

const KINDS: DiaryKind[] = ['schema', 'mode', 'gratitude'];
const LABELS: Record<DiaryKind, string> = { schema: 'Дневник схем', mode: 'Дневник режимов', gratitude: 'Благодарность' };

// «Незаконченные записи»: черновики дневников, по клику — в дневники.
export function DraftsBlock({ onOpenDiaries }: { onOpenDiaries: () => void }) {
  const drafts = KINDS.filter(t => hasDraft(t));
  if (drafts.length === 0) return null;
  return (
    <section className="ct-section ct-block">
      <div className="ds-head-row">
        <h3 className="ds-h2">Незаконченные записи</h3>
        <button type="button" className="ds-link" onClick={onOpenDiaries}>открыть →</button>
      </div>
      {drafts.map(type => (
        <div key={type} {...pressable(onOpenDiaries)} className="ds-card ds-card--row ds-card--hover ct-draft">
          <span className="ct-draft-mark tone-fill" style={hueStyle(DIARY_HUE[type])} />
          <div className="ct-task-body">
            <div className="ds-label tone-ink" style={hueStyle(DIARY_HUE[type])}>Черновик</div>
            <div className="ds-sub">{LABELS[type]}</div>
          </div>
          <span className="ds-link">продолжить →</span>
        </div>
      ))}
    </section>
  );
}
