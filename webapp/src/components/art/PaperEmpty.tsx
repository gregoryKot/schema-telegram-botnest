import type { ComponentType, ReactNode } from 'react';
import { Cup } from './PaperArt';
import type { ArtProps } from './paper';

/**
 * Пустое состояние единого стиля: картинка слева, текст справа (.pp-empty, paper.css).
 * `title` — строка-заголовок (ds-list-title) над абзацем: «Планов пока нет» и
 * что делать дальше; без `children` остаётся один заголовок («Записи»).
 * `art` — знак сущности вместо чашки, когда пусто место одной сущности и её знака
 * рядом нет (вкладки карточки клиента: карта — Cluster, сессии — Talk; таблица
 * «Мотив → смысл» в docs/design/PAPER_2026-11.md). По умолчанию — чашка.
 */
export function PaperEmpty({ title, art: Art = Cup, children }: { title?: ReactNode; art?: ComponentType<ArtProps>; children?: ReactNode }) {
  return (
    <div className={Art === Cup ? 'pp-empty' : 'pp-empty pp-empty--sign'}>
      <Art size="empty" />
      {title ? (
        <div className="pp-empty-text">
          <p className="ds-list-title">{title}</p>
          {children && <p className="ds-empty">{children}</p>}
        </div>
      ) : (
        <p className="ds-empty">{children}</p>
      )}
    </div>
  );
}
