// Вкладка «Запись» → блок «Расписание»: недельные правила (когда вообще
// открыта запись) + календарь конкретных дней (точечные правки поверх них).
// ScheduleManager вынесен сюда из BookingSection.tsx — тот упирался в потолок
// размера файла (правило №10 CLAUDE.md).
import { useState } from 'react';
import { api } from '../../api';
import type { AvailabilityRule } from '../../api';
import { card, btn, btnGhost, input } from './shared';
import { CalendarWeek } from './calendar/CalendarWeek';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function ScheduleSection({
  rules, rulesFailed, onChange, adminKey,
}: {
  rules: AvailabilityRule[];
  rulesFailed: boolean;
  onChange: () => void;
  adminKey: string;
}) {
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('19:00');
  const [duration, setDuration] = useState(50);
  const [buffer, setBuffer] = useState(10);

  const add = async () => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    await api.adminCreateRule(adminKey, {
      dayOfWeek: day, startHour: sh, startMinute: sm, endHour: eh, endMinute: em,
      sessionDuration: duration, bufferMin: buffer,
    });
    onChange();
  };

  return (
    <section style={card}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 6 }}>Расписание</h2>
      <p style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 0, marginBottom: 16 }}>
        Недельные правила задают базовое расписание, календарь ниже — точечные правки по дням.
      </p>
      <CalendarWeek adminKey={adminKey} />
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 24, marginBottom: 12 }}>Недельные правила</h3>
      {/* Сбой ≠ пусто: «правил нет» на отказе загрузки провоцирует пересоздать расписание. */}
      {rulesFailed && <p role="alert" style={{ color: 'var(--accent-red)', fontSize: 14 }}>Не удалось загрузить расписание — возможно, неверный админ-ключ или нет соединения.</p>}
      {!rulesFailed && rules.length === 0 && <p className="u-faint14">Пока нет правил. Добавьте слоты ниже.</p>}
      {rules.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', padding: '8px 0', borderBottom: '1px solid var(--line)', opacity: r.isActive ? 1 : 0.45 }}>
          <strong style={{ width: 36, color: 'var(--text)' }}>{DAYS[r.dayOfWeek]}</strong>
          <span style={{ flex: 1, color: 'var(--text-sub)', fontSize: 14 }}>
            {pad(r.startHour)}:{pad(r.startMinute)}–{pad(r.endHour)}:{pad(r.endMinute)} · {r.sessionDuration} мин (+{r.bufferMin})
          </span>
          <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => api.adminToggleRule(adminKey, r.id, !r.isActive).then(onChange)}>
            {r.isActive ? 'Выкл' : 'Вкл'}
          </button>
          <button aria-label="Удалить правило" style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, color: 'var(--accent-red)' }} onClick={() => api.adminDeleteRule(adminKey, r.id).then(onChange)}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', alignItems: 'center', marginTop: 16 }}>
        <select style={input} value={day} onChange={e => setDay(Number(e.target.value))}>
          {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input style={input} type="time" value={start} onChange={e => setStart(e.target.value)} />
        <span className="u-faint">–</span>
        <input style={input} type="time" value={end} onChange={e => setEnd(e.target.value)} />
        <label className="u-faint13">сессия<input style={{ ...input, width: 56, marginLeft: 4 }} type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
        <label className="u-faint13">буфер<input style={{ ...input, width: 56, marginLeft: 4 }} type="number" value={buffer} onChange={e => setBuffer(Number(e.target.value))} /></label>
        <button style={btn} onClick={add}>Добавить</button>
      </div>
    </section>
  );
}

function pad(n: number) { return String(n).padStart(2, '0'); }
