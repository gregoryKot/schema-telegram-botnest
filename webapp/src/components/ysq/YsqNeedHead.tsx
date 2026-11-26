import { needLook } from '../../../../shared/src/theme/entityLook';
import type { NeedId } from '../../../../shared/src/needs/types';
import { SignGroupHead } from '../schemaSheets/SignGroup';

/** Заголовок группы результата YSQ на бумаге потребности: её знак и название — та же шапка, что у групп
 *  «Паттернов» и «Справочника» (SignGroupHead). */
export function YsqNeedHead({ needId, label }: { needId: string; label: string }) {
  return <SignGroupHead signs={[needLook(needId as NeedId).sign]} title={label} className="ss-res-head" />;
}
