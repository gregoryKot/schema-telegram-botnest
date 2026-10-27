import { Skeleton, SkeletonList } from '../Skeleton';

/** Загрузка бэкфилла: силуэт экрана вопроса (eyebrow, заголовок, строка вопроса, пять плашек ответов). */
export function QuestionSkeleton() {
  return (
    <div className="tk2-overlay" role="status" aria-busy="true" aria-label="Загружаются оценки дня">
      <div className="tq-body">
        <div className="tq-inner" aria-hidden>
          <Skeleton width="42%" height={12} />
          <Skeleton width="62%" height={38} radius={10} />
          <Skeleton width="90%" height={17} />
          <SkeletonList rows={5} height={56} radius={16} gap={10} />
        </div>
      </div>
    </div>
  );
}
