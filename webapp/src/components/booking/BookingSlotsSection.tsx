import { useMemo } from 'react';
import type { BookingSlot } from '../../api';
import { trackGoalOnce } from '../../lib/metrika';
import { TimeZonePicker } from './TimeZonePicker';
import { Chip } from './Chip';
import { SignChip } from '../paper/SignChip';
import { VY, type Tr } from './slotsCopy';
import { fieldLabel as labelSt } from './fieldLabelStyle';
import {
  groupByLocalDay, localDayLabel, localTimeLabel, timeZoneCaption, mskHintLabel,
} from '../../../../shared/src/booking/clientTimeZone';

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
  /** Лист записи в приложении (b24): чипы бумаги с галочкой (SignChip), лента дней — класс cbk-days. Визитка — без него. */
  paper?: boolean;
}

type ChipProps = { active: boolean; onClick: () => void; children: React.ReactNode };
function PaperChip({ active, onClick, children }: ChipProps) {
  return <SignChip className="cbk-chip" label={children} on={active} onToggle={onClick} />;
}

/** Дни + время слотов, в зоне посетителя — вынесено из BookingPicker (правило №10). */
export function BookingSlotsSection({ slots, tz, onTzChange, day, onDayChange, slot, onSlotChange, tr = VY, paper }: Props) {
  const Pick = paper ? PaperChip : Chip;
  const days = useMemo(() => groupByLocalDay(slots, tz), [slots, tz]);
  const dayList = [...days.keys()];
  const daySlots = days.get(day) ?? [];

  return (
    <>
      <div>
        <div style={labelSt}>{tr('Выбери день', 'Выберите день')}</div>
        <div className={paper ? 'cbk-days' : undefined} style={paper ? undefined : { display: 'flex', gap: 'var(--space-8)', overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
          {dayList.map((k) => (
            <Pick key={k} active={k === day} onClick={() => {
              trackGoalOnce('booking_start');
              trackGoalOnce('booking_day');
              onDayChange(k);
            }}>
              {localDayLabel(days.get(k)![0].startsAt, tz)}
            </Pick>
          ))}
        </div>
      </div>

      <div>
        <div style={labelSt}>Время</div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 8px' }}>
          {timeZoneCaption(tz, undefined, tr('твоему', 'вашему'))} <TimeZonePicker tz={tz} onChange={onTzChange} tr={tr} />
        </p>
        <div className={paper ? 'u-wrap8 cbk-times' : 'u-wrap8'}>
          {daySlots.map((s) => (
            <Pick key={s.startsAt} active={slot?.startsAt === s.startsAt} onClick={() => {
              trackGoalOnce('booking_start');
              trackGoalOnce('booking_time', { tz });
              onSlotChange(s);
            }}>
              {localTimeLabel(s.startsAt, tz)}
            </Pick>
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
