import { NeedArt } from '../art/NeedArt';

/** Заголовок группы результата YSQ на бумаге потребности: её знак и название (как у групп «Справочника»). */
export function YsqNeedHead({ needId, label }: { needId: string; label: string }) {
  return (
    <h3 className="ss-group-head ss-res-head">
      <span className="ss-group-sign" aria-hidden="true"><NeedArt id={needId} size="square" /></span>
      <span className="ds-label ss-group-name">{label}</span>
    </h3>
  );
}
