import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import '../../styles/sheet-tasks.css';

/**
 * Точка входа «Что это было» — единственное главное действие экрана /today.
 * Twin schema-miniapp/src/sections/today/CaseEntryCard.tsx (правило №3):
 * тот же текст, тот же выбор («Ровный день» — равноправная кнопка, не
 * отговорка мелким шрифтом), разметка — webapp aside-card/ex-btn вместо
 * инлайн-стилей мини-аппа.
 *
 * Оценка времени обязательна и честная: при СДВГ задача с неизвестной
 * длительностью ощущается бесконечной и не начинается вовсе.
 */
export function CaseEntryCard({
  caseCount,
  onStart,
  onSteadyDay,
  onOpenMap,
}: {
  caseCount: number;
  onStart: () => void;
  onSteadyDay: () => void;
  onOpenMap: () => void;
}) {
  const tr = useTr();
  const started = caseCount > 0;

  return (
    <div className="ds-card sk-case ct-case">
      <h3 className="ds-h3">{started ? 'Что сегодня зацепило?' : 'Что это было'}</h3>
      <p className="sk-case-text">
        {started
          ? 'Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в ответ.'
          : tr(
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
            )}
      </p>

      <div className="sk-case-actions">
        <button type="button" className="ds-btn" onClick={() => { haptic.tap(); onStart(); }}>
          Разобрать · ≈ 3 мин
        </button>
        <button type="button" className="ds-btn ds-btn--secondary" onClick={() => { haptic.tap(); onSteadyDay(); }}>
          Ровный день
        </button>
      </div>

      {started && (
        <button type="button" className="ds-link sk-case-map" onClick={() => { haptic.tap(); onOpenMap(); }}>
          {`Карта себя · ${caseCount} ${pluralRu(caseCount, 'разбор', 'разбора', 'разборов')} →`}
        </button>
      )}
    </div>
  );
}
