interface Props {
  count: number;
  formVisible: boolean;
  onToggle: () => void;
}

/** Шапка «Клиенты» (К31): eyebrow, serif-заголовок с тихим числом и в той же строке справа —
 *  текстовое действие «+ Новый клиент» на линии. Залитой кнопки нет: главное действие экрана —
 *  строка клиента, а у открытой формы — её «Создать карточку». */
export function ClientListHero({ count, formVisible, onToggle }: Props) {
  return (
    <div className="pp-block pp-block--head tc-hero">
      <div className="ds-label">Практика</div>
      <div className="tc-hero-line">
        <h1 className="pp-hero-title">Клиенты{count > 0 && <> <span className="tc-count">{count}</span></>}</h1>
        <button className="ds-btn ds-btn--secondary tc-hero-add" aria-expanded={formVisible} onClick={onToggle}>
          + Новый клиент
        </button>
      </div>
    </div>
  );
}
