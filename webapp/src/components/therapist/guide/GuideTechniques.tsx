import type { TechniqueGuide, TechniqueId } from '../../../../../shared/src/schemaTherapy/guide';
import { MORE_TECHNIQUES_TITLE } from '../../../../../shared/src/schemaTherapy/guide/address/addressTitles';
import type { GuideNotes } from '../../../../../shared/src/therapy/conceptGraph/guideHistory';
import { PLAN_RUBRIC_LABEL } from '../../../../../shared/src/therapy/plan/planItem';
import { Disclosure, DS_FOLD } from '../../../../../shared/src/components/Disclosure';
import { SignArt } from '../../art/SignArt';
import { TECHNIQUE_SIGN } from '../../art/guideSignsModel';
import { GuideSection } from './GuideSection';
import { sessionSeed, type PlanSeed } from './guidePlan';
import { PlanButton } from './PlanButton';
import { TechniqueDoneNote } from './TechniqueMarkRow';

/** «На сессии» (у фазы — свой заголовок): знак техники, техника — кнопка с описанием, «делали …» и «журнал →». */
export function GuideTechniques({ techniques, address, onOpen, onPlan, notes, onOpenJournal, title = PLAN_RUBRIC_LABEL.session }: TechniqueListProps & {
  onPlan?: (seed: PlanSeed) => void; title?: string;
}) {
  if (techniques.length === 0) return null;
  return (
    <GuideSection title={title} address={address} action={onPlan && <PlanButton label={PLAN_RUBRIC_LABEL.session} onClick={() => onPlan(sessionSeed(techniques))} />}>
      <TechniqueList techniques={techniques} onOpen={onOpen} notes={notes} onOpenJournal={onOpenJournal} />
    </GuideSection>
  );
}

/** «Ещё техники» под «На сессии»: тот же список, свёрнут — главные остаются на виду. */
export function GuideMoreTechniques({ techniques, address, ...list }: TechniqueListProps) {
  if (techniques.length === 0) return null;
  return (
    <GuideSection title={MORE_TECHNIQUES_TITLE} address={address}>
      <Disclosure classes={DS_FOLD} title={`Показать (${techniques.length})`}>
        <TechniqueList techniques={techniques} {...list} />
      </Disclosure>
    </GuideSection>
  );
}

interface TechniqueListProps {
  techniques: TechniqueGuide[]; address: string; onOpen: (id: TechniqueId) => void; notes?: GuideNotes; onOpenJournal?: () => void;
}

function TechniqueList({ techniques, onOpen, notes, onOpenJournal }: Omit<TechniqueListProps, 'address'>) {
  return (
    <ul className="tcp-guide-list">
      {techniques.map((t) => (
        <li key={t.id} className="gd-tech">
          <span className="pp-row-art"><SignArt sign={TECHNIQUE_SIGN[t.id]} size="row" /></span>
          <div className="gd-min">
            <button type="button" className="tcp-guide-link" onClick={() => onOpen(t.id)}>{t.name}</button>
            <div className="ds-sub">{t.summary}</div>
            <TechniqueDoneNote text={notes?.technique(t.id)} onOpenJournal={onOpenJournal} />
          </div>
        </li>
      ))}
    </ul>
  );
}
