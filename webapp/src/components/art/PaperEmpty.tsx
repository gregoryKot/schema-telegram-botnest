import type { ReactNode } from 'react';
import { Cup } from './PaperArt';

/** Пустое состояние единого стиля: чашка слева, текст ds-empty справа (.pp-empty, paper.css). */
export function PaperEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="pp-empty">
      <Cup />
      <p className="ds-empty">{children}</p>
    </div>
  );
}
