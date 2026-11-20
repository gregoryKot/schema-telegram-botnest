import type { ModeGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GUIDE_CHANNELS as CHANNELS, channelLabel } from '../../../../../shared/src/therapy/plan/planItem'; // четыре канала работы с режимом, пустой не показывается
import { GuideSection } from './GuideSection';
import { channelSeed } from './guidePlan';
import { PlanButton } from './PlanButton';
import { modeGuideLook } from './guideLook';
import { GuidePoints } from './GuidePoints';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';

type Props = GuideSheetActions & { modeName: string; view: ModeGuideView };

/**
 * Лист режима (#995): герой — что это за режим и знак на бумаге его группы (modeGuideLook), «Как это
 * звучит», цель, «Как работать» — каналы пунктами, затем общий хвост листа
 * раздела (GuideSheet): техники «На сессии», задания «Между сессиями»,
 * «Подробнее» и источники. Открывается «Подробнее о режиме» на плашке «Обычно в методе».
 */
export function ModeGuideSheet({ modeName, view, ...actions }: Props) {
  const { guide } = view;
  const channels = CHANNELS.flatMap((c) => {
    const key = c.id;
    const lead = channelLabel(c);
    const text = guide[key]?.trim();
    const action = actions.onPlan && <PlanButton label={lead} onClick={() => actions.onPlan?.(channelSeed(key, text ?? ''))} />;
    return text ? [{ lead, text, action }] : [];
  });
  return (
    <GuideSheet
      label="Режим" title={modeName} lede={guide.what} voice={guide.voice} view={view} {...actions}
      look={modeGuideLook(guide.modeId)}
    >
      <GuideSection title="Цель" text={guide.goal} />
      {channels.length > 0 && (
        <GuideSection title="Как работать">
          <GuidePoints items={channels} />
        </GuideSection>
      )}
    </GuideSheet>
  );
}
