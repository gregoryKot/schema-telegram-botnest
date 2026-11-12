// Части «Обзора» карточки клиента (b30), вынесенные из ClientOverviewTab: «Последние записи» и пустой «Обзор».
import type { CSSProperties } from 'react';
import { useTr } from '../../utils/addressForm';
import { fmtDate } from '../../utils/format';
import { SceneConceptStart } from '../art/AppScenesMore';
import { SignArt } from '../art/SignArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { noteLook } from './noteLook';
import type { DiaryPreviewRow } from './clientOverviewModel';

/** «Последние записи» — белый лист с тенью-слоем; у строки знак типа (noteLook: как в ленте «Записи» клиента),
 *  тип — тихой подписью перед фрагментом, без цветной плашки-«таблетки». Камешков благодарности в превью не
 *  знаем — знак целиком (все камешки легли). */
export function OverviewEntries({ entries, onAll }: { entries: DiaryPreviewRow[]; onAll: () => void }) {
  return (
    <section className="pp-leaf tk-leaf" style={{ '--h': ENTITY_LOOK.diary.hue } as CSSProperties}>
      <div className="ds-head-row tk-card-head">
        <h2 className="ds-label tk-sec-label">Последние записи</h2>
        <button className="ds-link" onClick={onAll}>Все записи →</button>
      </div>
      {entries.map((e, i) => (
        <div key={i} className="tk-entry">
          <span className="pp-row-art" aria-hidden="true"><SignArt sign={noteLook(e.type).sign} size="row" /></span>
          <div className="tk-entry-body">
            <div className="ds-list-title">{e.title}</div>
            <div className="tk-entry-sub">
              <span className="tk-entry-type">{e.typeLabel}</span>
              {e.excerpt && <span className="tk-entry-excerpt">{e.excerpt}</span>}
            </div>
          </div>
          <span className="ds-sub tk-entry-date">{fmtDate(e.date)}</span>
        </div>
      ))}
    </section>
  );
}

/** Пустой «Обзор» нового клиента — одно состояние: сцена «пустая схема случая», текст и одна кнопка
 *  (вместо карточки-крошки с маленьким знаком и пустой страницы). */
export function OverviewEmpty({ onOpen }: { onOpen: () => void }) {
  const tr = useTr();
  return (
    <section className="tk-empty-box">
      <div className="tk-empty">
        <div className="tk-empty-scene" aria-hidden="true"><SceneConceptStart /></div>
        <div className="tk-empty-body">
          <p className="tk-empty-text">{tr('Заполни концептуализацию, чтобы увидеть схемы и режимы клиента', 'Заполните концептуализацию, чтобы увидеть схемы и режимы клиента')}</p>
          <button className="ds-btn" onClick={onOpen}>Открыть концептуализацию</button>
        </div>
      </div>
    </section>
  );
}
