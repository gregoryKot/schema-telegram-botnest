import { Skeleton } from '../../components/Skeleton';

/** Силуэт «Моих схем / Моих режимов», пока профиль грузится: две группы по форме листа группы —
 *  место под знак и подпись, белый список из двух строк (не чипы и не пустота). */
export function MineGroupsSkeleton() {
  return (
    <div className="sg-cols-box" aria-hidden="true"><div className="sg-cols sg-cols--rows">
      {[0, 1].map(i => (
        <div key={i} className="sg-group cs-skel-group">
          <div className="sg-head"><Skeleton width={60} height={32} radius={10} /><Skeleton width={140} height={11} /></div>
          <div className="sg-rows cs-skel-rows"><Skeleton height={52} radius={0} /><Skeleton height={52} radius={0} /></div>
        </div>
      ))}
    </div></div>
  );
}
