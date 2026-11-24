import type { ModeGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GUIDE_CHANNELS as CHANNELS, channelLabel } from '../../../../../shared/src/therapy/plan/planItem'; // четыре канала работы с режимом, пустой не показывается
import { GuideSection } from './GuideSection';
import { channelSeed } from './guidePlan';
import { PlanButton } from './PlanButton';
import { modeGuideLook, schemaGuideLook } from './guideLook';
import { articleAddress } from './marks/guideMarkModel';
import { GuidePoints } from './GuidePoints';
import { GuideRelated } from './GuideRelated';
import { GuideSheet, type GuideSheetActions } from './GuideSheet';

type Props = GuideSheetActions & {
  modeName: string; view: ModeGuideView;
  /** Тап по схеме в «Связано» — её лист; нет — названия строкой. */
  onOpenSchema?: (schemaId: string) => void;
};

/**
 * Лист режима (#995) вкладками GuideSheet: герой со знаком группы (modeGuideLook); «Кратко» — как звучит, цель, схемы
 * строками (обратная сторона «Режимов» схемы); «На сессии» — техники и каналы карточками; «Между сессиями»; «Теория».
 * Открывается «Подробнее о режиме» на плашке «Обычно в методе».
 */
export function ModeGuideSheet({ modeName, view, onOpenSchema, ...actions }: Props) {
  const { guide } = view;
  const at = articleAddress('mode', guide.modeId);
  const channels = CHANNELS.flatMap(({ id: key, ...c }) => {
    const lead = channelLabel(c);
    const text = guide[key]?.trim();
    const action = actions.onPlan && <PlanButton label={lead} onClick={() => actions.onPlan?.(channelSeed(key, text ?? ''))} />;
    return text ? [{ lead, text, action, address: at(key) }] : [];
  });
  return (
    <GuideSheet
      label="Режим" title={modeName} lede={guide.what} voice={guide.voice} view={view} {...actions}
      look={modeGuideLook(guide.modeId)} at={at} article={{ kind: 'mode', id: guide.modeId }}
      lead={<GuideSection title="Цель" text={guide.goal} address={at('goal')} />}
      related={<GuideRelated groups={[{ title: 'Схемы', address: at('schemas'), items: view.schemas, look: schemaGuideLook, onOpen: onOpenSchema }]} />}
    >
      {channels.length > 0 && (
        <GuideSection title="Как работать">
          <GuidePoints items={channels} />
        </GuideSection>
      )}
    </GuideSheet>
  );
}
