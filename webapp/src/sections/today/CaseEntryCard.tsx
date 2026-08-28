import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

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
    <div className="aside-card" style={{ margin: '0 0 32px' }}>
      <h3 style={{ marginBottom: 8 }}>{started ? 'Что сегодня зацепило?' : 'Что это было'}</h3>
      <p className="body" style={{ marginBottom: 20 }}>
        {started
          ? 'Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в ответ.'
          : tr(
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
            )}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap' }}>
        <button type="button" className="ex-btn ex-btn-primary" onClick={onStart}>
          Разобрать · ≈ 3 мин
        </button>
        <button type="button" className="ex-btn ex-btn-outline" onClick={onSteadyDay}>
          Ровный день
        </button>
      </div>

      {started && (
        <button
          type="button"
          className="link"
          style={{ display: 'block', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 16 }}
          onClick={onOpenMap}
        >
          {`Карта себя · ${caseCount} ${pluralRu(caseCount, 'разбор', 'разбора', 'разборов')} →`}
        </button>
      )}
    </div>
  );
}
