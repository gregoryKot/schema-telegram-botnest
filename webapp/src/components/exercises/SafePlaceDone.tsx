// Итог «Безопасного места» (SafePlaceEx, b18) — экран, к которому возвращаются в тревоге, а не квитанция:
// лист «готово» на шалфее со сценой SceneHaven крупно (все описанные элементы проявлены), под ней — само
// место Literata курсивом и описанные чувства строками, как стихи (метка элемента сцены, подпись, текст).
// «Закрыть» — залитая, «Изменить» — тихая ссылка. Рамка — общая ExDonePage (без колонки «прошлых»: место одно);
// useHistorySheet — в SafePlaceEx (onClose — его goBack).
import type { ReactNode } from 'react';
import { DoneSheet } from '../paper/DoneSheet';
import { HavenSenseMark, SceneHaven } from '../art/SceneHaven';
import { SENSES } from './safePlaceText';
import { ExDonePage } from './ExDonePage';
import { glueSpaces } from '../../../../shared/src/utils/typo';

export function SafePlaceDone({ overview, senses, title, lede, onEdit, onClose }: {
  overview: string;
  senses: Record<string, string>;
  title: ReactNode;
  lede: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const described = SENSES.filter((s) => senses[s.k].trim());
  const shown = Object.fromEntries(described.map((s) => [s.k, true]));
  return (
    <ExDonePage onBack={onClose}>
      <DoneSheet entity="safe_place" scene={<SceneHaven place={Boolean(overview.trim())} senses={shown} />} titleAs="h1"
        label="Безопасное место · сохранено" title={title} sub={lede}
        primary={{ label: 'Закрыть', onClick: onClose }} secondary={{ label: 'Изменить', onClick: onEdit }}>
        <p className="ex2-haven-place">«{glueSpaces(overview)}»</p>
        <div className="ex2-haven-lines">
          {described.map((s) => (
            <div key={s.k} className="ex2-haven-line">
              <HavenSenseMark sense={s.k} on />
              <div>
                <div className="ds-label">{s.label}</div>
                <p className="ex2-haven-text">{glueSpaces(senses[s.k])}</p>
              </div>
            </div>
          ))}
        </div>
      </DoneSheet>
    </ExDonePage>
  );
}
