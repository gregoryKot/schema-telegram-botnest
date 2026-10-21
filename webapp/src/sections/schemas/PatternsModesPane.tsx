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
}

/**
 * Всё про режимы на экране «Паттерны». Десктоп — как раньше (чипы и полная карта).
 * Телефон — как в мини-аппе: строки по группам режимов, полная карта под «Все режимы».
 */
export function PatternsModesPane({ mobile, d, pat, onAdd, banner }: Props) {
  const freq = pat.entriesReady ? pat.modeFreq : undefined;
  const openMine = (id: string) => pat.openPattern('mode', id);
  if (!mobile) {
    return (
      <>
        <ModesBlocks loading={d.loading} myModeIds={d.myModeIds} onAdd={onAdd} onOpenMode={pat.openModeEx} onOpenPattern={openMine} modeFreq={freq} />
        {banner}
      </>
    );
  }
  return (
    <>
      <MyModesList loading={d.loading} ids={d.myModeIds} onAdd={onAdd} onOpenMode={openMine} statusFor={pat.statusOf('mode').statusFor} freq={freq} />
      {banner}
      <SchemaMapFold label="Все режимы">
        <ModeMap myModeIds={d.myModeIds} onOpenMode={pat.openModeEx} hideTitle />
      </SchemaMapFold>
    </>
  );
}
