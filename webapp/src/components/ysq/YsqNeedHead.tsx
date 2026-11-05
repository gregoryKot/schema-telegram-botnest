import { NeedArt } from '../art/NeedArt';

/** Заголовок группы результата YSQ: мотив потребности и её название. */
export function YsqNeedHead({ needId, label }: { needId: string; label: string }) {
  return (
    <div className="ss-res-head">
      <span className="pp-row-art"><NeedArt id={needId} size="row" /></span>
      <div className="ds-chip tone-tint">{label}</div>
    </div>
  );
}
