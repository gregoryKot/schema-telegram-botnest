import { Skeleton } from '../../components/Skeleton';

/** Силуэт плоской группы /account, пока грузятся способы входа: заголовок с переключателем и два абзаца. */
export function GroupSkeleton() {
  return (
    <section className="aa-group" aria-hidden="true">
      <div className="aa-group-head">
        <Skeleton width="55%" height={20} />
        <Skeleton width={44} height={26} radius={13} />
      </div>
      <Skeleton width="96%" height={12} />
      <Skeleton width="88%" height={12} />
      <Skeleton width="62%" height={12} />
    </section>
  );
}
