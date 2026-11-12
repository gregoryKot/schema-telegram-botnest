import type { CSSProperties } from 'react';
import { Skeleton } from '../Skeleton';
import '../../styles/shell-skeletons.css';

const paper = (hue: number) => ({ '--h': hue } as CSSProperties);
/** Бумага счётчиков и листа сессий — литералы, а не импорт cabinetLook: силуэт живёт в главном чанке, и
 *  cabinetLook (entityLook, справочник схем) утащил бы туда лишнее (docs/open/frontend-ux.md, раскрой
 *  чанков). Сверка с cabinetLook — TodaySkeletonBody.test.tsx. */
const SKELETON_COUNTER_HUES = [135, 240, 45] as const;
const SKELETON_SESSIONS_HUE = 240;

/** Тело силуэта «Сегодня» терапевта по форме экрана (b29): три плитки бумаги счётчиков, лист неба
 *  «Сессий» с двумя строками, справа заголовок и строки активности. Одно на загрузку раздела
 *  (TherapistTodaySkeleton, Suspense оболочки) и на загрузку клиентов самим экраном — под шапкой. */
export function TodaySkeletonBody({ label }: { label?: string }) {
  return (
    <div className="sks-today-th" role={label ? 'status' : undefined} aria-label={label}>
      <div className="sks-counters">
        {SKELETON_COUNTER_HUES.map((hue) => (
          <div key={hue} className="pp-paper sks-counter" style={paper(hue)}>
            <Skeleton width={44} height={24} radius={8} /><Skeleton width="60%" height={11} /><Skeleton width={48} height={30} radius={8} />
          </div>
        ))}
      </div>
      <div className="sks-two sks-two--today">
        <div className="pp-paper sks-col sks-sessions" style={paper(SKELETON_SESSIONS_HUE)}>
          <Skeleton width="52%" height={22} />
          {[0, 1].map((i) => <div key={i} className="sks-session"><Skeleton width={52} height={22} /><Skeleton width={`${58 - i * 14}%`} height={14} /></div>)}
        </div>
        <div className="sks-col">
          <Skeleton width="56%" height={22} />
          <div className="sks-card">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sks-row"><Skeleton width={36} height={36} radius={18} /><div className="sks-col"><Skeleton width={`${62 - i * 12}%`} height={14} /><Skeleton width="40%" height={11} /></div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
