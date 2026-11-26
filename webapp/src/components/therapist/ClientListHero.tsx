import { Sheets } from '../art/PaperArt';
import { FindButton } from '../FindButton';

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
        {onSearch && <FindButton className="tc-find" label="Перейти к…" onClick={onSearch} />}
      </div>
    </div>
  );
}
