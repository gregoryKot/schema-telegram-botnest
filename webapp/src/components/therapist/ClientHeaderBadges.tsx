import type { TherapyClientSummary } from '../../api';
import { clientHeaderMeta, clientNextSession } from './clientHeaderMeta';
import { isVirtualClient } from './clientSheetHelpers';
import { NextSessionLine } from './NextSessionLine';
import { BrandMark } from '../art/BrandMark';

/** Шапка клиента: «офлайн» — тихий текст со знаком продукта без плашки (r1), мета — строкой, встреча — как в списке. */
export function ClientHeaderBadges({ client }: { client: TherapyClientSummary }) {
  const [meta, next] = [clientHeaderMeta(client), clientNextSession(client)];
  return (
    <div className="tk-badges">
      {isVirtualClient(client) && <span className="tk-offline"><BrandMark size={20} simple bare />офлайн</span>}
      {meta && <span className="tk-meta">{meta}</span>}
      {next && <NextSessionLine label={next} />}
    </div>
  );
}
