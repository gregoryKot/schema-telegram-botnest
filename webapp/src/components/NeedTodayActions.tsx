import type { CSSProperties, ReactNode } from 'react';
import { SignArt } from './art/SignArt';
import { ENTITY_LOOK, type EntityId } from '../../../shared/src/theme/entityLook';
import { glueIf } from '../../../shared/src/utils/typo';

/** Плитка-переход на бумаге сущности: заголовок, подпись, внизу её знак и стрелка (как квадраты «Сегодня»). */
function ActTile({ entity, title, sub, onClick }: { entity: EntityId; title: ReactNode; sub: ReactNode; onClick: () => void }) {
  const { hue, sign } = ENTITY_LOOK[entity];
  return (
    <button type="button" className="pp-paper tk2-act-tile" style={{ '--h': hue } as CSSProperties} onClick={onClick}>
      <span className="tk2-act-title">{glueIf(title)}</span>
      <span className="tk2-act-sub">{glueIf(sub)}</span>
      <span className="tk2-act-foot">
        <SignArt sign={sign} size="square" />
        <span className="pp-arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}

/**
 * «Что с этим сделать?» на листе потребности при низкой оценке: не белые карточки, а плитки
 * бумаги со знаком сущности, куда ведут, — шаг на завтра (план: шалфей и Check) и раздел
 * «Помощь» (бережная роза и Heart, как «Мне плохо»). Тексты передаёт лист.
 */
export function NeedTodayActions({ planHint, onPlan, onHelp }: { planHint: string; onPlan: () => void; onHelp?: () => void }) {
  return (
    <section className="tk2-act">
      <h2 className="ds-label tk2-act-label">Что с этим сделать?</h2>
      <div className="tk2-act-grid">
        <ActTile entity="plan" title="Запланировать шаг на завтра" sub={planHint} onClick={onPlan} />
        {onHelp && <ActTile entity="sos" title="Раздел Помощь" sub="Инструменты прямо сейчас" onClick={onHelp} />}
      </div>
    </section>
  );
}
