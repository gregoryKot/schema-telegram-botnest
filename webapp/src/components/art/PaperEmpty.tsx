import type { ReactNode } from 'react';
import { Cup } from './PaperArt';

/**
 * Пустое состояние единого стиля: чашка слева, текст справа (.pp-empty, paper.css).
 * `title` — строка-заголовок (ds-list-title) над абзацем: «Планов пока нет» и
 * что делать дальше; без `children` остаётся один заголовок («Записи»).
 */
export function PaperEmpty({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pp-empty">
      <Cup />
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
