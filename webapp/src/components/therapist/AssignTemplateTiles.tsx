import type { CSSProperties } from 'react';
import { SignArt } from '../art/SignArt';
import { ASSIGN_TEMPLATES, type AssignPreset } from './assignTemplates';

/**
 * «Назначить из шаблона» (вкладка «Задания» карточки клиента): выбор из четырёх равных — плитки бумаги
 * сущности со знаком (принцип 3, `pp-paper`), как плитки «Практик» у клиента: тот же знак, что клиент увидит
 * у задания. 2×2 в узкой колонке, в ряд — где места хватает (контейнер .tb-tpls-box, therapist-tabs.css).
 */
export function AssignTemplateTiles({ onAssign }: { onAssign: (preset?: AssignPreset) => void }) {
  return (
    <div className="tb-tpls-box"><div className="tb-tpls">
      {ASSIGN_TEMPLATES.map(card => (
        <button
          key={card.title} type="button" className="pp-paper tb-tpl"
          style={{ '--h': card.look.hue } as CSSProperties} onClick={() => onAssign(card.preset)}
        >
          <span className="pp-row-art tb-tpl-art" aria-hidden="true"><SignArt sign={card.look.sign} size="row" /></span>
          <span className="tb-tpl-title">{card.title}</span>
          <span className="tb-tpl-sub">{card.sub}</span>
        </button>
      ))}
    </div></div>
  );
}
