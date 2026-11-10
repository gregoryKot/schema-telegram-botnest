// Записка «Тёплых слов» (WarmWordsEx, b18): слова, которые перечитывают, когда трудно, — на тёплой бумаге
// (warmNoteLook), фраза Literata, внизу тихая строка: знак группы режима, кому отвечали, дата и откуда.
// Раньше — белая карточка-лог с цветной точкой режима в шапке и текстом 15px.
import { SignArt } from '../art/SignArt';
import { hueStyle } from '../../lib/tone';
import { getModeById } from '../../schemaTherapyData';
import { warmNoteLook } from './warmWordsLook';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import type { WarmWordsItem } from '../../../../shared/src/warmWords/collectWarmWords';
import { WARM_SOURCE_LABEL, warmWordTitle } from '../../../../shared/src/warmWords/warmWordsText';

function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function WarmWordNote({ item, index }: { item: WarmWordsItem; index: number }) {
  const look = warmNoteLook(item, index);
  return (
    <article className="pp-paper ex2-warm-note" style={hueStyle(look.hue)}>
      <p className="ex2-warm-text">{glueSpaces(item.text)}</p>
      <div className="ex2-warm-meta">
        <SignArt sign={look.sign} size="row" />
        <div className="ex2-warm-by">
          <span className="ex2-warm-mode">{warmWordTitle(item, getModeById(item.modeId)?.name)}</span>
          <span className="ex2-warm-when">{fmtDate(item.at)} · {WARM_SOURCE_LABEL[item.source]}</span>
        </div>
      </div>
    </article>
  );
}
