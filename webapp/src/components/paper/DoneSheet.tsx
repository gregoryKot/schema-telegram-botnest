// «Лист готово» — один экран исхода для разбора, дневников, практик, упражнений, плана, «Мне
// плохо» и трекера (docs/design/APP_2026-11.md, принцип 8 и таблица ENTITY_LOOK): бумага сущности,
// сцена «готово» из ENTITY_LOOK (DoneScene: Sprout со знаком сущности, камешек лёг, дыхание
// улеглось, лист дня в серии) или своя сцена экрана, надпись («Записано»), заголовок Literata,
// подпись, одна залитая кнопка и тихая ссылка. Кризисная карточка (CrisisCard) — отдельным листом
// над «готово», через зазор: бережная роза 25 рядом с глиной 28 иначе читалась бы одним листом.
// На телефоне лист во всю ширину, на компьютере 480–560 по центру первого экрана. Тексты передаёт
// экран — у примитива своих слов нет.
import type { CSSProperties, ReactNode } from 'react';
import { ENTITY_LOOK, type EntityId } from '../../../../shared/src/theme/entityLook';
import { DoneScene } from '../art/AppScenesMore';
import '../../styles/paper-app.css';

export interface DoneAction {
  label: ReactNode;
  onClick: () => void;
}

export interface DoneSheetProps {
  entity: EntityId;
  /** Бумага листа, если у экрана она своя (трекер: «Готово» на шалфее); по умолчанию — сущности. */
  hue?: number;
  /** Своя сцена экрана вместо сцены «готово» сущности. */
  scene?: ReactNode;
  /** Дни серии вместе с сегодняшним — для сцены «лист дня в серии» (только реальные). */
  days?: number;
  label: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  primary: DoneAction;
  secondary?: DoneAction;
  /** Кризисная карточка над листом. */
  crisis?: ReactNode;
  titleAs?: 'h1' | 'h2';
  children?: ReactNode;
}

export function DoneSheet({ entity, hue, scene, days, label, title, sub, primary, secondary, crisis, titleAs: Title = 'h2', children }: DoneSheetProps) {
  const look = ENTITY_LOOK[entity];
  const picture = scene ?? <DoneScene entity={entity} days={days} />;
  return (
    <section className="pa-done" data-entity={entity}>
      {crisis && <div className="pa-done-crisis">{crisis}</div>}
      <div className="pp-paper pa-done-sheet" style={{ '--h': hue ?? look.hue } as CSSProperties}>
        <div className="pa-done-scene" aria-hidden="true">{picture}</div>
        <span className="ds-label pa-done-label">{label}</span>
        <Title className="pa-done-title">{title}</Title>
        {sub && <p className="pa-done-sub">{sub}</p>}
        {children}
        <div className="pa-done-actions">
          <button type="button" className="ds-btn ds-btn--lg pa-done-primary" onClick={primary.onClick}>{primary.label}</button>
          {secondary && <button type="button" className="ds-link pa-done-link" onClick={secondary.onClick}>{secondary.label}</button>}
        </div>
      </div>
    </section>
  );
}
