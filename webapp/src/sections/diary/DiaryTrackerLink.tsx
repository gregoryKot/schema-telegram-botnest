import { pressable } from '../../utils/a11y';
import { DIARY_TRACKER_LINK } from '../../../../shared/src/diary/diaryTrackerLink';

// Переход из хаба дневников в трекер потребностей — паритет с мини-аппом
// (HomeView, блок «Оценить день»). Текст «что это и зачем» общий (shared).
export function DiaryTrackerLink({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="cd-tracker">
      <div className="ds-label">{DIARY_TRACKER_LINK.label}</div>
      <div className="ds-card ds-card--row ds-card--hover cd-tracker-card" {...pressable(onOpen)}>
        <div className="cd-tracker-body">
          <div className="cd-tracker-title">{DIARY_TRACKER_LINK.title}</div>
          <div className="ds-sub">{DIARY_TRACKER_LINK.desc}</div>
        </div>
        <span className="ds-link" aria-hidden="true">открыть →</span>
      </div>
    </div>
  );
}
