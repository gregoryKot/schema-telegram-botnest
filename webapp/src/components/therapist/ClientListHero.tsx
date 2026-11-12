import { Sheets } from '../art/PaperArt';

interface Props {
  count: number;
  formVisible: boolean;
  onToggle: () => void;
  /** Палитра «Перейти к…» (⌘K): кнопка-лупа в шапке там, где строки `.topbar` нет (телефон). */
  onSearch?: () => void;
}

/** Шапка «Клиенты»: то, что уже собрано (Sheets), и единственная залитая кнопка экрана —
 *  пока форма открыта, главное действие — её «Создать карточку», и эта кнопка вторична.
 *  Лупа — переход к клиенту в одно касание (решение 9: «Поиска» в нижнем меню больше нет). */
export function ClientListHero({ count, formVisible, onToggle, onSearch }: Props) {
  return (
    <div className="pp-block pp-block--head tc-hero">
      <div className="pp-hero">
        <div className="pp-hero-body">
          <div className="ds-label">Практика</div>
          <h1 className="pp-hero-title">Клиенты{count > 0 && <> <span className="tc-count">{count}</span></>}</h1>
        </div>
        <Sheets size="hero" />
      </div>
      <div className="tc-hero-row">
        <button className={formVisible ? 'ds-btn ds-btn--secondary tc-hero-btn' : 'ds-btn tc-hero-btn'} aria-expanded={formVisible} onClick={onToggle}>
          + Новый клиент
        </button>
        {onSearch && (
          <button type="button" className="tc-find" aria-label="Перейти к…" onClick={onSearch}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <path d="M15.5 15.5 L20.5 20.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
