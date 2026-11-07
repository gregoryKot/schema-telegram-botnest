import { useMemo } from 'react';
import type { BookingSlot } from '../../api';
import { trackGoalOnce } from '../../lib/metrika';
import { TimeZonePicker } from './TimeZonePicker';
import { Chip } from './Chip';
import { VY, type Tr } from './slotsCopy';
import {
  groupByLocalDay, localDayLabel, localTimeLabel, timeZoneCaption, mskHintLabel,
} from '../../../../shared/src/booking/clientTimeZone';

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
  textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8,
};

interface Props {
  slots: BookingSlot[];
  tz: string;
  onTzChange: (tz: string) => void;
  day: string;
  onDayChange: (day: string) => void;
  slot: BookingSlot | null;
  onSlotChange: (slot: BookingSlot) => void;
  /** Обращение: визитка публичная — «вы» (по умолчанию); в приложении — useTr() пользователя. */
  tr?: Tr;
}

/** Дни + время слотов, в зоне посетителя — вынесено из BookingPicker (правило №10). */
export function BookingSlotsSection({ slots, tz, onTzChange, day, onDayChange, slot, onSlotChange, tr = VY }: Props) {
  const days = useMemo(() => groupByLocalDay(slots, tz), [slots, tz]);
  const dayList = [...days.keys()];
  const daySlots = days.get(day) ?? [];

  return (
    <>
      <div>
        <div style={labelSt}>{tr('Выбери день', 'Выберите день')}</div>
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
          {timeZoneCaption(tz, undefined, tr('твоему', 'вашему'))} <TimeZonePicker tz={tz} onChange={onTzChange} tr={tr} />
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
