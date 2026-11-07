import type { ModeGuideView } from '../../../../../shared/src/therapy/conceptGraph/conceptGuide';
import { GuideSignArt } from '../../art/GuideSigns';
import { modeSign } from '../../art/guideSignsModel';
import { GuideSection } from './GuideSection';
import { GuidePoints, GuideSheet, type GuideSheetActions } from './GuideSheet';

type Props = GuideSheetActions & { modeName: string; view: ModeGuideView };

// Четыре канала работы с режимом — порядок справочника, подписи простыми словами
// (отношения, когнитивный, экспериенциальный, поведенческий); пустой канал не показывается.
const CHANNELS = [
  ['relationship', 'В отношениях'],
  ['cognitive', 'Через понимание'],
  ['experiential', 'Через чувства и образы'],
  ['behavioral', 'В жизни'],
] as const;

/**
 * Лист режима (#995): герой — что это за режим и знак его группы, «Как это
 * звучит», цель, «Как работать» — каналы пунктами, затем общий хвост листа
 * раздела (GuideSheet): техники «На сессии», задания «Между сессиями»,
 * «Подробнее» и источники. Открывается «Подробнее о режиме» на плашке «Обычно в методе».
 */
export function ModeGuideSheet({ modeName, view, ...actions }: Props) {
  const { guide } = view;
  const channels = CHANNELS.flatMap(([key, lead]) => {
    const text = guide[key]?.trim();
    return text ? [{ lead, text }] : [];
  });
  return (
    <GuideSheet
      label="Режим" title={modeName} lede={guide.what} voice={guide.voice} view={view} {...actions}
      art={<GuideSignArt sign={modeSign(guide.modeId)} size="hero" />}
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
