import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTherapyBridgeTexts } from './therapy/useTherapyBridgeTexts';
import '../styles/client-why.css';

interface Props {
  auto?: boolean; // true — лист открылся сам при первом входе; false — по кнопке «Зачем это?» или из «Ещё»
  onClose: () => void;
}

const ACTIONS: [string, string][] = [
  ['Трекер', 'Пять потребностей, один вопрос за раз. Через 3–5 дней виден паттерн: что питает, что истощает, чего не хватает.'],
  ['Что случилось', 'Момент, после которого стало не по себе. Приложение подскажет, на какой режим это похоже и что поможет сейчас.'],
  ['Дневник', 'Одна мысль, схема, режим или спасибо. Записи собираются в одну картину: со временем видно, что повторяется.'],
];

// «Зачем это всё»: откуда взялись три действия и что даёт каждое — «откуда это и зачем» на пути
// пользователя (frontend-visual.md). Шапка листа с «← Закрыть» (ds-sheet-head, #906); «Понятно, начнём»
// идёт сразу после строк — на телефоне 852px видна без прокрутки, оговорка про самопомощь — под ней.
export function WhySheet({ auto = false, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const bridge = useTherapyBridgeTexts();
  return (
    <div className="u-sheet cw-sheet" role="dialog" aria-modal="true" aria-label="Зачем это всё">
      <div className="ds-sheet-head ds-sheet-head--page cw-head">
        <button type="button" className="ds-back" onClick={goBack}>← Закрыть</button>
      </div>
      <div className="cw-inner">
        <header>
          <div className="ds-eyebrow">{auto ? 'Первый раз здесь' : 'Зачем это всё'}</div>
          <h1 className="ds-h1">Три вещи, которые здесь можно делать</h1>
        </header>
        <p className="ds-lead">
          Всё строится на схема-терапии: у человека есть пять базовых потребностей — привязанность, автономия, выражение чувств,
          спонтанность, границы. Когда их долго не хватает, включаются старые паттерны. Приложение помогает это замечать.
        </p>
        <ul className="ds-card ds-card--flush cw-list">
          {ACTIONS.map(([title, text]) => (
            <li key={title} className="ds-list-row cw-item"><span className="ds-list-title">{title}</span><span className="cw-item-text">{text}</span></li>
          ))}
        </ul>
        <p className="cw-tip">Не нужно делать всё. Одно действие в день — уже работа.</p>
        <button type="button" className="ds-btn ds-btn--lg" onClick={goBack}>Понятно, начнём</button>
        <p className="ds-sub cw-foot">{bridge.whyNote}</p>
      </div>
    </div>
  );
}
