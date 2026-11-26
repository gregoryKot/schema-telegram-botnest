// Выбор схемы и режима для карточки-задания (TaskCreateSheet, b20). Одна механика с карточками в упражнениях
// и дневником режимов — общий PickGroups (exercises/PickGroups.tsx, правило №3): группа на бумаге домена или
// группы режимов со знаком у подписи, строки — белый список с описанием, выбранная — бумага группы с галочкой.
// До b20 здесь шли 36 строк с одним и тем же Cluster; в b20 схемы рисовал свой список «пилюль» — сведён (ревью g6).
import { useId } from 'react';
import { PickGroups } from '../exercises/PickGroups';
import { SCHEMA_PICK_GROUPS } from '../exercises/cardFlow/cardEntities';
import { ModeGroupList } from '../diary/ModeGroupList';
import { SignChip } from '../paper/SignChip';
import { STREAK_OPTIONS } from './taskOptions';

interface PickerProps { value: string; onPick: (id: string) => void }

export function SchemaPicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какую схему изучить?</div>
      <PickGroups groups={SCHEMA_PICK_GROUPS} selectedId={value} onPick={onPick} clamp />
    </div>
  );
}

export function ModePicker({ value, onPick }: PickerProps) {
  return (
    <div className="sk-field">
      <div className="ds-label">Какой режим изучить?</div>
      <ModeGroupList modeId={value} onPick={onPick} />
    </div>
  );
}

export function StreakPicker({ value, onPick }: { value: number; onPick: (days: number) => void }) {
  const labelId = useId();
  return (
    <div className="sk-field">
      <div className="ds-label" id={labelId}>Цель в днях</div>
      {/* Выбор значения, а не раздел — чипы-радио, как теги быстрой записи. */}
      <div className="sk-days" role="radiogroup" aria-labelledby={labelId}>
        {STREAK_OPTIONS.map(d => <SignChip key={d} label={`${d} дн`} on={value === d} radio onToggle={() => onPick(d)} />)}
      </div>
    </div>
  );
}
