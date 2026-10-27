import { useHistorySheet } from '../hooks/useHistorySheet';
import { NEEDS_EXPLAINER } from '../../../shared/src/about/aboutData';
import { TRACKER_ORIGIN_NOTE } from '../../../shared/src/needs/trackerOnboarding';
import '../styles/client-why.css';

interface Props {
  /** true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё». */
  auto?: boolean;
  onClose: () => void;
}

// «Зачем это всё»: откуда взялись три действия и что даёт каждое. Правило
// онбординга (frontend-visual.md): «откуда это и зачем» — на пути пользователя.
// Фразы про потребности — из уже сведённых NEEDS_EXPLAINER и TRACKER_ORIGIN_NOTE.
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const needs = NEEDS_EXPLAINER.map(n => n.name.toLowerCase()).join(', ');
  return (
    <div className="u-sheet cw-sheet" role="dialog" aria-modal="true" aria-label="Зачем это всё">
      <div className="cw-inner">
        <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
        <h1 className="ds-h1 cw-h1">Три вещи, которые здесь можно делать</h1>
        <p className="cw-lead">
          {TRACKER_ORIGIN_NOTE}{' '}
          Это {needs}. Приложение помогает замечать, как с ними дела сегодня и что происходит, когда их не хватает.
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
