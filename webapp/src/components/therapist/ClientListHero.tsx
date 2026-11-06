import { Sheets } from '../art/PaperArt';

interface Props { count: number; formVisible: boolean; onToggle: () => void }

/** Шапка «Клиенты»: то, что уже собрано (Sheets), и единственная залитая кнопка экрана —
 *  пока форма открыта, главное действие — её «Создать карточку», и эта кнопка вторична. */
export function ClientListHero({ count, formVisible, onToggle }: Props) {
  return (
    <div className="pp-block pp-block--head tc-hero">
      <div className="pp-hero">
        <div className="pp-hero-body">
          <div className="ds-label">Практика</div>
          <h1 className="pp-hero-title">Клиенты{count > 0 && <> <span className="tc-count">{count}</span></>}</h1>
        </div>
        <Sheets size="hero" />
      </div>
      <button className={formVisible ? 'ds-btn ds-btn--secondary tc-hero-btn' : 'ds-btn tc-hero-btn'} aria-expanded={formVisible} onClick={onToggle}>
        + Новый клиент
      </button>
    </div>
  );
}
