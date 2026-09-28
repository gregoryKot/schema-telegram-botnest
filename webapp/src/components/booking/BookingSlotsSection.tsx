import { useMemo } from 'react';
import type { BookingSlot } from '../../api';
import { trackGoalOnce } from '../../lib/metrika';
import { TimeZonePicker } from './TimeZonePicker';
import {
  groupByLocalDay, localDayLabel, localTimeLabel, timeZoneCaption, mskHintLabel,
} from '../../../../shared/src/booking/clientTimeZone';

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: '9px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
      borderRadius: 100, whiteSpace: 'nowrap', transition: 'all .15s',
      background: active ? 'var(--accent)' : 'transparent',
      color: active ? '#fff' : 'var(--text-sub)',
      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--line-strong)'}`,
    }}>{children}</button>
  );
}

interface Props {
  slots: BookingSlot[];
  tz: string;
  onTzChange: (tz: string) => void;
  day: string;
  onDayChange: (day: string) => void;
  slot: BookingSlot | null;
  onSlotChange: (slot: BookingSlot) => void;
}

/** Дни + время слотов, в зоне посетителя — вынесено из BookingPicker (правило №10). */
export function BookingSlotsSection({ slots, tz, onTzChange, day, onDayChange, slot, onSlotChange }: Props) {
  const days = useMemo(() => groupByLocalDay(slots, tz), [slots, tz]);
  const dayList = [...days.keys()];
  const daySlots = days.get(day) ?? [];

  return (
    <>
      <div>
        <div style={labelSt}>Выберите день</div>
        <div style={{ display: 'flex', gap: 'var(--space-8)', overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          {dayList.map((k) => (
            <Chip key={k} active={k === day} onClick={() => {
              trackGoalOnce('booking_start');
              trackGoalOnce('booking_day');
              onDayChange(k);
            }}>
              {localDayLabel(days.get(k)![0].startsAt, tz)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <div style={labelSt}>Время</div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 8px' }}>
          {timeZoneCaption(tz)} <TimeZonePicker tz={tz} onChange={onTzChange} />
        </p>
        <div className="u-wrap8">
          {daySlots.map((s) => (
            <Chip key={s.startsAt} active={slot?.startsAt === s.startsAt} onClick={() => {
              trackGoalOnce('booking_start');
              trackGoalOnce('booking_time', { tz });
              onSlotChange(s);
            }}>
              {localTimeLabel(s.startsAt, tz)}
            </Chip>
          ))}
        </div>
        {slot && mskHintLabel(slot.startsAt, tz) && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '8px 0 0' }}>
            {localTimeLabel(slot.startsAt, tz)} {mskHintLabel(slot.startsAt, tz)}
          </p>
        )}
      </div>
    </>
  );
}
