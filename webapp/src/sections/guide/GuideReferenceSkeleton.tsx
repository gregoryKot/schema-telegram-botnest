import { Skeleton, SkeletonList } from '../../components/Skeleton';

/** Силуэт «Справочника»: строка поиска, переключатель и группы строк — в те же колонки, что группы режимов. */
export function GuideReferenceSkeleton() {
  return (
    <div aria-hidden className="gr-column">
      <Skeleton height={44} radius={12} />
      <Skeleton width={300} height={34} radius={16} style={{ maxWidth: '100%' }} />
      <div className="gr-wrap">
        <div className="gr-list gr-list--groups">
          {[4, 3].map((rows) => (
            <div key={rows} className="gr-skel-group">
              <Skeleton width="40%" height={24} />
              <SkeletonList rows={rows} height={48} radius={12} gap={6} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
