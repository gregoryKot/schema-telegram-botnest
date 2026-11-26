import { hueStyle } from '../../lib/tone';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { glue } from '../../../../shared/src/utils/typo';

interface Props {
  /** Сущность плитки: бумага и знак — из ENTITY_LOOK, а не на месте. */
  entity: 'case' | 'diary';
  title: string;
  text: string;
  /** null — данные ещё грузятся: плашка-скелетон вместо выдуманной подписи. */
  meta: string | null;
  onClick: () => void;
}

/** Квадрат цветной бумаги на главной «Сегодня» (референс владельца 2026-11-04): заголовок, подпись,
 *  знак сущности, внизу мета из данных и стрелка (мета — одной строкой). На компьютере — плитка
 *  вширь, знак справа (client-today.css). Не ds-card--nav: там строка «картинка — текст — шеврон». */
export function HomeSquare({ entity, title, text, meta, onClick }: Props) {
  const { hue, sign } = ENTITY_LOOK[entity];
  return (
    <button type="button" className="ct-tile pp-paper pp-square" style={hueStyle(hue)} onClick={onClick}>
      <span className="pp-title">{title}</span>
      <span className="pp-text">{glue(text)}</span>
      <SignArt sign={sign} size="square" />
      <span className="pp-square-foot">
        {meta === null ? <span className="pp-meta pp-meta--skeleton" aria-hidden="true" /> : <span className="pp-meta">{meta}</span>}
        <span className="pp-arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}
