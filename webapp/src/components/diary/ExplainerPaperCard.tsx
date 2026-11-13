import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignHero } from '../paper/SignHero';
import { hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';

/** Плитка «Схема»/«Режим» пустых «Записей» (b11): бумага и знак из ENTITY_LOOK — схемы вообще (Layers на глине),
 *  режимы вообще (Cluster на небе), знак крупно с тенью-вырезкой, название Literata и два абзаца (первый не повторяет название: «Схема — так в…» → «Так в…»). */
const CARD = { schema: { look: ENTITY_LOOK.schemas, name: 'Схема' }, mode: { look: ENTITY_LOOK.modes, name: 'Режим' } } as const;

export function ExplainerPaperCard({ type, what, why }: { type: 'schema' | 'mode'; what: string; why: string }) {
  const { look, name } = CARD[type];
  return (
    <div className="pp-paper cd-explainer" style={hueStyle(look.hue)}>
      <div className="cd-explainer-top"><h3 className="cd-explainer-name">{name}</h3><span className="cd-explainer-sign" aria-hidden="true"><SignHero sign={look.sign} /></span></div>
      <p className="cd-explainer-what">{glue(what.replace(new RegExp(`^${name} — (.)`), (_, c: string) => c.toUpperCase()))}</p>
      <p className="cd-explainer-why">{glue(why)}</p>
    </div>
  );
}
