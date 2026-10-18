// Всё, что «Мои паттерны» открывает поверх экрана для схемы или режима:
// экран паттерна (PatternSheet), статус карточки для строки списка и
// упражнение режима для плиток «Карты режимов». Вынесено из SchemasSection
// (правило №10): секция остаётся раскладкой, а состояние листов живёт здесь.
import { useMemo, useState, type ReactNode } from 'react';
import { api } from '../../api';
import { PatternSheet } from '../../components/patternSheet/PatternSheet';
import { ModeExOverlay } from './ModeExOverlay';
import { usePatternEntries } from './usePatternEntries';
import { usePatternStatus } from '../../../../shared/src/pattern/usePatternStatus';
import { schemaEntryCounts, modeEntryCounts } from '../../../../shared/src/pattern/patternStatus';
import { weekSchemaFrequency, weekModeFrequency, weekPatternTop } from '../../../../shared/src/pattern/patternsSummary';
import type { MyCardsKind } from '../../../../shared/src/pattern/useMyCards';

export function usePatternLayer() {
  const [pattern, setPattern] = useState<{ kind: MyCardsKind; id: string } | null>(null);
  const [exModeId, setExModeId] = useState<string | null>(null);
  const entries = usePatternEntries();
  const schemaStatus = usePatternStatus('schema', schemaEntryCounts(entries.schemaEntries), api);
  const modeStatus = usePatternStatus('mode', modeEntryCounts(entries.modeEntries), api);
  const open = pattern?.kind === 'mode' ? modeStatus : schemaStatus;

  const { schemaEntries, modeEntries, ready } = entries;
  // Недельная сводка считается по загруженным записям; до загрузки — пусто, не выдумка.
  const week = useMemo(() => {
    const now = new Date();
    return {
      schemaFreq: weekSchemaFrequency(schemaEntries, now),
      modeFreq: weekModeFrequency(modeEntries, now),
      top: weekPatternTop(schemaEntries, modeEntries, now),
    };
  }, [schemaEntries, modeEntries]);

  const layer: ReactNode = (
    <>
      {pattern && (
        <PatternSheet
          kind={pattern.kind}
          id={pattern.id}
          items={open.items}
          loading={open.loading}
          reload={open.reload}
          entries={entries}
          onClose={() => setPattern(null)}
        />
      )}
      {exModeId && <ModeExOverlay modeId={exModeId} onBack={() => setExModeId(null)} />}
    </>
  );
  return {
    layer,
    openPattern: (kind: MyCardsKind, id: string) => setPattern({ kind, id }),
    openModeEx: setExModeId,
    ...week,
    entriesReady: ready,
    hasEntries: schemaEntries.length + modeEntries.length > 0,
    // Пока заметки или записи не загрузились, «карточка пока пустая» была бы враньём.
    schemaStatusFor: entries.ready && !schemaStatus.loading ? schemaStatus.statusFor : undefined,
  };
}
