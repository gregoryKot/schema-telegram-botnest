import type { TechniqueGuide } from '../../../../../shared/src/schemaTherapy/guide';
import { ConceptFullscreenSheet } from '../ConceptFullscreenSheet';
import { GuideSection, GuideSources } from './GuideSection';
import { guideColumnStyle, guideListStyle, guideTextStyle } from './guideStyles';

/**
 * Лист техники (#995): что это, когда применять, шаги, когда не делать,
 * доказательность и источники. Открывается с плашки «Обычно в методе» и из
 * листа режима; оболочка та же, что у листа режима (ConceptFullscreenSheet,
 * один слой): лист техники рисуется позже в DOM и встаёт поверх листа режима.
 */
export function TechniqueSheet({ technique: t, onClose }: { technique: TechniqueGuide; onClose: () => void }) {
  return (
    <ConceptFullscreenSheet title={t.name} closeLabel="Закрыть" onClose={onClose}>
      <div style={guideColumnStyle}>
        <p style={guideTextStyle}>{t.summary}</p>
        <GuideSection title="Когда" text={t.when} />
        {t.steps.length > 0 && (
          <GuideSection title="Как проводить">
            <ol style={guideListStyle}>
              {t.steps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </GuideSection>
        )}
        <GuideSection title="Когда не делать" text={t.cautions} />
        <GuideSection title="Доказательность" text={t.evidence} />
        <GuideSources text={t.sources} />
      </div>
    </ConceptFullscreenSheet>
  );
}
