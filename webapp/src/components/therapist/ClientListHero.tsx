import { Sheets } from '../art/PaperArt';

interface Props { count: number; formVisible: boolean; onToggle: () => void }

/** Шапка «Клиенты»: то, что уже собрано (Sheets), и единственная залитая кнопка экрана. */
export function ClientListHero({ count, formVisible, onToggle }: Props) {
  return (
    <div className="pp-block tc-hero">
      <div className="pp-hero">
        <div className="pp-hero-body">
          <div className="ds-label">Практика</div>
          <h1 className="pp-hero-title">Клиенты{count > 0 && <> <span className="tc-count">{count}</span></>}</h1>
        </div>
        <Sheets size="hero" />
      </div>
      <button className="ds-btn tc-hero-btn" aria-expanded={formVisible} onClick={onToggle}>
        + Новый клиент
      </button>
    </div>
  );
}
