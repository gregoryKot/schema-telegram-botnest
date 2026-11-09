// Силуэт ленты «Записей» по форме экрана (b11; ревью g1: у «Записей» своего силуэта не было — общий
// ScreenSkeleton с листом без оттенка прыгал при загрузке): шапка с местом «Записать», сегмент, дни —
// строка даты с местом полосок трекера и карточки со знаком слева. Одни размеры с лентой
// (client-diary-skeleton.css грузится с оболочкой: силуэт раздела рисуется до чанка «Записей»).
// still — без бегущего блика: при сбое загрузки силуэт показывает место ленты, а не «грузится».
import { Skeleton } from '../../components/Skeleton';
import '../../styles/client-diary-skeleton.css';

function SkelCard({ lines }: { lines: number }) {
  return (
    <div className="cdk-card">
      <Skeleton width={44} height={24} radius={8} />
      <div className="cdk-col">
        <Skeleton width={84} height={20} radius={10} />
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} width={i ? '58%' : '86%'} height={13} />)}
      </div>
    </div>
  );
}

export function DiaryTimelineSkeleton({ still }: { still?: boolean }) {
  return (
    <div className={still ? 'cdk-timeline cdk-still' : 'cdk-timeline'} aria-hidden="true">
      {[2, 1].map((cards, d) => (
        <div key={d} className="cdk-day">
          <div className="cdk-head">
            <div className="cdk-col"><Skeleton width={110} height={22} radius={8} /><Skeleton width={130} height={11} /></div>
            <Skeleton width={118} height={36} radius={18} />
          </div>
          <div className="cdk-items">{Array.from({ length: cards }, (_, i) => <SkelCard key={i} lines={2 - i} />)}</div>
        </div>
      ))}
    </div>
  );
}

/** Силуэт раздела целиком (SectionSkeleton по адресу /diary): шапка, сегмент, лента. */
export function DiaryFeedSkeleton() {
  return (
    <div aria-hidden="true" className="ds-page cdk-page" data-testid="diary-skeleton">
      <div className="cdk-top">
        <div className="cdk-col"><Skeleton width={70} height={12} /><Skeleton width={190} height={38} radius={10} /></div>
        <div className="cdk-write"><Skeleton width="100%" height={48} radius={24} /></div>
      </div>
      <div className="cdk-seg"><Skeleton width="100%" height={44} radius={22} /></div>
      <DiaryTimelineSkeleton />
    </div>
  );
}
