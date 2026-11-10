import type { ReactNode } from 'react';
import type { useSchemasData } from './useSchemasData';
import type { usePatternLayer } from './usePatternLayer';
import { ModesBlocks } from './ModesBlocks';
import { MyModesList } from './MyModesList';
import { ModeMap } from './ModeMap';
import { SchemaMapFold } from './SchemaMapFold';

interface Props {
  mobile: boolean;
  d: ReturnType<typeof useSchemasData>;
  pat: ReturnType<typeof usePatternLayer>;
  onAdd: () => void;
  /** Баннер «Карта режимов с терапевтом» — между «Мои режимы» и полной картой. */
  banner?: ReactNode;
  /** Сбой сохранения выбора режимов — строкой у «Моих режимов». */
  note?: ReactNode;
}

/**
 * Всё про режимы на экране «Паттерны». Компьютер — «Мои режимы» группами на бумаге группы в колонки и
 * карта режимов аккордеонами. Телефон — как в мини-аппе: те же группы строками, карта под «Все режимы».
 */
export function PatternsModesPane({ mobile, d, pat, onAdd, banner, note }: Props) {
  const freq = pat.entriesReady ? pat.modeFreq : undefined;
  const openMine = (id: string) => pat.openPattern('mode', id);
  const statusFor = pat.statusOf('mode').statusFor;
  if (!mobile) {
    return (
      <>
        <ModesBlocks loading={d.loading} myModeIds={d.myModeIds} onAdd={onAdd} onOpenMode={pat.openModeEx} onOpenPattern={openMine} modeFreq={freq} statusFor={statusFor} note={note} banner={banner} />
      </>
    );
  }
  return (
    <>
      {note}
      <MyModesList loading={d.loading} ids={d.myModeIds} onAdd={onAdd} onOpenMode={openMine} statusFor={statusFor} freq={freq} />
      {banner}
      <SchemaMapFold label="Все режимы">
        <ModeMap myModeIds={d.myModeIds} onOpenMode={pat.openModeEx} hideTitle />
      </SchemaMapFold>
    </>
  );
}
