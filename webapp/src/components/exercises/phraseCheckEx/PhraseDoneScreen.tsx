// Итог «Критик или забота?» (b18): лист «готово» на сливе разбора со сценой Sprout с Together (критик сменился
// заботой — и проросло), внутри — «было → стало» двумя репликами (PhraseDoneCard). «Закрыть» — залитая,
// «Проверить ещё одну» — тихая ссылка; поделиться — тихими ссылками под листом (ex2-share), а не ещё двумя
// кнопками рядом с главной. Прошлые разборы — строками «было → стало» (на компьютере колонкой справа).
// Рамка — общая ExDonePage; useHistorySheet — в PhraseCheckEx (onClose — его goBack).
import type { ReactNode } from 'react';
import { DoneSheet } from '../../paper/DoneSheet';
import { Sprout } from '../../art/AppScenes';
import { PhraseDoneCard } from './PhraseDoneCard';
import { PhraseCheckShare } from './PhraseCheckShare';
import { PhraseHistoryRows } from './PhraseHistoryRows';
import { ExDonePage, ExPastList } from '../ExDonePage';
import { CARE_LOOK } from './phraseLook';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import type { PhraseCheckEntry } from '../../../api';
import type { PhraseMarkId } from '../../../../../shared/src/phraseCheck/criteria';

const HUE = ENTITY_LOOK.phrase_check.hue;

export function PhraseDoneScreen({ phrase, rewrite, marks, lede, past, total, onOpenPast, onAgain, onClose }: {
  phrase: string;
  rewrite: string;
  marks: PhraseMarkId[];
  lede: ReactNode;
  past: PhraseCheckEntry[];
  total: number;
  onOpenPast: (id: number) => void;
  onAgain: () => void;
  onClose: () => void;
}) {
  return (
    <ExDonePage onBack={onClose} side={past.length > 0 && (
      <ExPastList label={<>Прошлые разборы · {total}</>}>
        <PhraseHistoryRows entries={past} onOpen={onOpenPast} showRewrite />
      </ExPastList>
    )}>
      <DoneSheet entity="phrase_check" scene={<Sprout sign={CARE_LOOK.sign} hue={HUE} patch={CARE_LOOK.hue} />} titleAs="h1"
        label="Критик или забота? · сохранено" title={<>Разобрано. <span className="it">Голос учится заново.</span></>} sub={lede}
        primary={{ label: 'Закрыть', onClick: onClose }} secondary={{ label: 'Проверить ещё одну', onClick: onAgain }}>
        <PhraseDoneCard phrase={phrase} rewrite={rewrite} />
      </DoneSheet>
      <div className="ex2-share">
        <PhraseCheckShare phrase={phrase} marks={marks} rewrite={rewrite.trim() || undefined} />
      </div>
    </ExDonePage>
  );
}
