import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';

/**
 * Точка входа «Что это было» — единственное главное действие экрана.
 *
 * Строка «писать почти ничего не надо» стоит на входе не для красоты: главный
 * барьер этой аудитории — не отсутствие мотивации, а цена начала. Разбор
 * устроен так, что печатать человек будет ровно один раз, и обещание честное.
 *
 * Оценка времени обязательна и честная: при СДВГ задача с неизвестной
 * длительностью ощущается бесконечной и не начинается вовсе.
 *
 * «Ровный день» — равноправная кнопка, а не отговорка мелким шрифтом:
 * спокойные дни тоже считаются, иначе продукт тренирует искать плохое.
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
    <div className="d-panel" style={{ padding: '20px 18px' }}>
      <h2
        className="d-display"
        style={{ fontSize: 20, margin: '0 0 6px', lineHeight: 1.2 }}
      >
        {started ? 'Что сегодня зацепило?' : 'Что это было'}
      </h2>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-sub)',
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        {started
          ? tr(
              'Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в ответ.',
              'Крупное необязательно — хватит мелочи: сообщение, взгляд, тишина в ответ.',
            )
          : tr(
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
              'Один момент, после которого настроение поехало. Разберём за три минуты — писать почти ничего не надо.',
            )}
      </div>

      <button
        className="btn-primary"
        onClick={() => {
          haptic.tap();
          onStart();
        }}
      >
        Разобрать · ≈ 3 мин
      </button>

      <button
        onClick={() => {
          haptic.tap();
          onSteadyDay();
        }}
        style={{
          width: '100%',
          marginTop: 10,
          minHeight: 44,
          background: 'none',
          border: '1px solid rgba(var(--fg-rgb),0.12)',
          borderRadius: 'var(--r-12)',
          color: 'var(--text-sub)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Ровный день
      </button>

      {started && (
        <button
          onClick={() => {
            haptic.tap();
            onOpenMap();
          }}
          style={{
            width: '100%',
            marginTop: 12,
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'left',
            padding: '2px',
          }}
        >
          {`Карта себя · ${caseCount} ${pluralRu(caseCount, 'разбор', 'разбора', 'разборов')} →`}
        </button>
      )}
    </div>
  );
}
