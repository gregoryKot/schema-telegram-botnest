import { pluralEntries } from './diaryModel';

// Шапка: H1 «Дневник наблюдений» + статистика месяца (только из реальных записей).
export function DiaryHeader({ total, daysWithEntry, daysInMonth, streak }: {
  total: number; daysWithEntry: number; daysInMonth: number; streak: number;
}) {
  return (
    <div className="ds-head-row cd-head">
      <div>
        <div className="ds-eyebrow">Дневник</div>
        <h1 className="ds-h1">Дневник <i>наблюдений</i></h1>
        <div className="ds-sub cd-head-sub">
          {total > 0
            ? `${pluralEntries(total)} · ведётся непрерывно`
            : 'Пара минут на запись — через 3–5 записей виден паттерн'}
        </div>
      </div>
      {total > 0 && (
        <div className="cd-stats">
          <div>
            <div className="ds-num cd-stat">{daysWithEntry}<span>/{daysInMonth}</span></div>
            <div className="cd-stat-label">дней с записью</div>
          </div>
          {streak > 1 && (
            <div>
              <div className="ds-num cd-stat cd-stat--hot">{streak}</div>
              <div className="cd-stat-label">дней подряд</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
