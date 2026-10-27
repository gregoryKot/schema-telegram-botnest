import { useHistorySheet } from '../hooks/useHistorySheet';
import '../styles/client-why.css';

interface Props {
  /** true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё». */
  auto?: boolean;
  onClose: () => void;
}

// «Зачем это всё»: откуда взялись три действия и что даёт каждое. Правило
// онбординга (frontend-visual.md): «откуда это и зачем» — на пути пользователя.
// Вступление короткое, чтобы все три карточки и кнопка помещались на экран телефона.
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  return (
    <div className="u-sheet cw-sheet" role="dialog" aria-modal="true" aria-label="Зачем это всё">
      <div className="cw-inner">
        <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
        <h1 className="ds-h1 cw-h1">Три вещи, которые здесь можно делать</h1>
        <p className="cw-lead">
          Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия,
          выражение чувств, спонтанность, границы. Когда их долго не хватает, включаются старые паттерны.
          Приложение помогает это замечать.
        </p>
        <ul className="cw-list">
          <li className="cw-item">
            <div className="cw-item-title">Трекер</div>
            <div className="cw-item-text">Пять потребностей, один вопрос за раз. Через 3–5 дней виден паттерн: что питает, что истощает, чего не хватает.</div>
          </li>
          <li className="cw-item">
            <div className="cw-item-title">Что случилось</div>
            <div className="cw-item-text">Момент, после которого стало не по себе. Приложение подскажет, на какой режим это похоже и что поможет сейчас.</div>
          </li>
          <li className="cw-item">
            <div className="cw-item-title">Дневник</div>
            <div className="cw-item-text">Одна мысль, схема, режим или спасибо. Записи собираются в одну картину: со временем видно, что повторяется.</div>
          </li>
        </ul>
        <p className="cw-note">Не нужно делать всё. Одно действие в день — уже работа.</p>
        <button type="button" className="ds-btn cw-cta" onClick={goBack}>Понятно, начнём</button>
      </div>
    </div>
  );
}
