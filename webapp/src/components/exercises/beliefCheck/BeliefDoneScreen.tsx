import { ExBar } from '../ExBar';
import { useExBackLabel } from '../exBackLabel';
import { DoneSheet } from '../../paper/DoneSheet';
import { SignArt } from '../../art/SignArt';
import { CardDialogue } from '../cardFlow/CardDialogue';
import { BeliefRecap } from './BeliefParts';
import { fmtAgo } from '../../../utils/format';
import type { api } from '../../../api';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { glueSpaces } from '../../../../../shared/src/utils/typo';
import { hueStyle } from '../../../lib/tone';
import '../../../styles/sheet-diary.css';

type BeliefCheckRow = Awaited<ReturnType<typeof api.getBeliefChecks>>[number];
const LOOK = ENTITY_LOOK.belief_check;

// «Проверка сохранена»: лист «готово» на соломе упражнения — весы с проросшим листом (Sprout, ENTITY_LOOK
// belief_check), «Закрыть» главная, «Проверить ещё одну» тихая. Ниже — итог диалогом: убеждение на
// бумаге упражнения и «Точнее» — голосом Здорового Взрослого (CardDialogue, тот же, что у карточек), обе
// чаши столбцами (BeliefRecap), следующий шаг со знаком Layers и прошлые проверки тихими строками.
// Рамка — ex2-screen с баром упражнения; goBack — useHistorySheet в BeliefCheckEx.tsx.
export function BeliefDoneScreen({ goBack, belief, forList, againstList, reframe, history, pastChecks, onRestart }: {
  goBack: () => void;
  belief: string;
  forList: string[];
  againstList: string[];
  reframe: string;
  history: BeliefCheckRow[];
  pastChecks: BeliefCheckRow[];
  onRestart: () => void;
}) {
  const backLabel = useExBackLabel();
  return (
    <div className="ex2-screen">
      <ExBar onBack={goBack} label={backLabel} sticky />
      <div className="sd-done-page ex2-card-done">
        <DoneSheet entity="belief_check" titleAs="h1" label="Проверка убеждения · сохранено"
          title={<>Готово.<br /><span className="it">Мысль проверена.</span></>}
          sub="Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу. Проверка сохранена в разделе «Мой путь»."
          primary={{ label: 'Закрыть', onClick: goBack }} secondary={{ label: 'Проверить ещё одну', onClick: onRestart }} />
        <CardDialogue look={LOOK}
          voice={{ label: 'Убеждение', text: <>«{glueSpaces(belief)}»</> }}
          healthy={reframe.trim() ? { label: 'Точнее', text: <>«{glueSpaces(reframe)}»</> } : undefined} />
        <BeliefRecap forList={forList} againstList={againstList} />
        <div className="pp-paper ex2-next" style={hueStyle(ENTITY_LOOK.schema_card.hue)}>
          <span className="ex2-next-sign" aria-hidden="true"><SignArt sign={ENTITY_LOOK.schema_card.sign} size="row" /></span>
          <div className="ex2-next-body">
            <div className="ds-label ex2-next-label">Что попробовать дальше</div>
            <h2 className="ex2-next-title">Знакомство со схемой</h2>
            <p className="ex2-next-text">Если эта мысль возвращается часто – стоит копнуть, какая схема за ней стоит.</p>
          </div>
        </div>
        {pastChecks.length > 0 && (
          <section className="ex2-answers ex2-belief-past">
            <div className="ds-label ex2-belief-past-head">Прошлые проверки · {history.length}</div>
            {pastChecks.map((h, i) => (
              <div key={i} className="ex2-hist-row">
                <span className="ex2-hist-date">{fmtAgo(h.createdAt)}</span>
                <span className="ex2-hist-snip">«{glueSpaces(h.belief)}»</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
