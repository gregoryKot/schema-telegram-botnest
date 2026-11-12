import { DoneSheet } from '../../paper/DoneSheet';
import { SignArt } from '../../art/SignArt';
import { CardDialogue } from '../cardFlow/CardDialogue';
import { ExDonePage, ExPastList, ExPastRow } from '../ExDonePage';
import { BeliefRecap } from './BeliefParts';
import { fmtAgo } from '../../../utils/format';
import type { api } from '../../../api';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { glueSpaces } from '../../../../../shared/src/utils/typo';

type BeliefCheckRow = Awaited<ReturnType<typeof api.getBeliefChecks>>[number];
const LOOK = ENTITY_LOOK.belief_check;

// «Проверка сохранена»: лист «готово» на соломе упражнения — весы с проросшим листом (Sprout, ENTITY_LOOK
// belief_check), «Закрыть» главная, «Проверить ещё одну» тихая. Колонкой справа на ≥1024 (на телефоне под
// листом) — итог диалогом: убеждение на бумаге упражнения и «Точнее» — голосом Здорового Взрослого
// (CardDialogue, тот же, что у карточек), обе чаши столбцами (BeliefRecap), следующий шаг — плоским
// блоком со знаком Layers (перехода к карточке схемы у экрана нет — не карточка, docs/open/frontend-ux.md)
// и прошлые проверки строками ExPastRow со знаком весов. Рамка — общая ExDonePage; goBack — useHistorySheet
// в BeliefCheckEx.tsx.
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
  return (
    <ExDonePage onBack={goBack} side={
      <>
        <CardDialogue look={LOOK}
          voice={{ label: 'Убеждение', text: <>«{glueSpaces(belief)}»</> }}
          healthy={reframe.trim() ? { label: 'Точнее', text: <>«{glueSpaces(reframe)}»</> } : undefined} />
        <BeliefRecap forList={forList} againstList={againstList} />
        <div className="ex2-next">
          <span className="ex2-next-sign" aria-hidden="true"><SignArt sign={ENTITY_LOOK.schema_card.sign} size="row" /></span>
          <div className="ex2-next-body">
            <div className="ds-label ex2-next-label">Что попробовать дальше</div>
            <h2 className="ex2-next-title">Знакомство со схемой</h2>
            <p className="ex2-next-text">Если эта мысль возвращается часто – стоит копнуть, какая схема за ней стоит.</p>
          </div>
        </div>
        {pastChecks.length > 0 && (
          <ExPastList label={<>Прошлые проверки · {history.length}</>}>
            {pastChecks.map((h, i) => (
              <ExPastRow key={i} sign={LOOK.sign} date={fmtAgo(h.createdAt)} quote={glueSpaces(h.belief)} />
            ))}
          </ExPastList>
        )}
      </>
    }>
      <DoneSheet entity="belief_check" titleAs="h1" label="Проверка убеждения · сохранено"
        title={<>Готово.<br /><span className="it">Мысль проверена.</span></>}
        sub="Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу. Проверка сохранена в разделе «Мой путь»."
        primary={{ label: 'Закрыть', onClick: goBack }} secondary={{ label: 'Проверить ещё одну', onClick: onRestart }} />
    </ExDonePage>
  );
}
