import type { ReactNode } from 'react';
import type { Look } from '../../../../shared/src/theme/entityLook';
import { SignArt } from '../../components/art/SignArt';
import { hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';

interface Props {
  look: Look;
  title: string;
  /** Подпись плитки; у «Тёплых слов» — сама фраза (cpf-tile-quote). */
  children: ReactNode;
  /** Мета внизу из данных (счёт схем, фраз) или вложенная кнопка; нет — только стрелка. */
  foot?: ReactNode;
  onOpen: () => void;
  label?: string;
}

/** Плитка витрины профиля — заметка между линиями (pp-block--note), оттенок сущности (ENTITY_LOOK) — только у знака:
 *  заголовок Literata h2, подпись, знак, внизу мета и стрелка. Вся плитка — одно действие: открыть лист сущности.
 *  На телефоне плитка лежит строкой во всю ширину, знак справа (client-profile-mobile.css). */
export function ShelfTile({ look, title, children, foot, onOpen, label }: Props) {
  return (
    <section {...pressable(onOpen)} aria-label={label} className="pp-block pp-block--note cpf-tile" style={hueStyle(look.hue)}>
      <h2 className="pp-block-title cpf-tile-title">{title}</h2>
      <div className="pp-block-text cpf-tile-text">{children}</div>
      <span className="cpf-tile-art" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>
      <span className="cpf-tile-foot">
        {foot ?? <span />}
        <span className="pp-arrow" aria-hidden="true">→</span>
      </span>
    </section>
  );
}
