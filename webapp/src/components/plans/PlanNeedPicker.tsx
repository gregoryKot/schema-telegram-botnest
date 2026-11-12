// Прямой путь к плану с пустого экрана «Планов» (QA 2026-11, B-М8): раньше
// подпись обещала кнопку «Запланировать практику», которой нет, а настоящий
// путь шёл через трекер и ответ «Совсем нет». Плитка потребности открывает
// тот же лист плана, что и трекер (PlanSheet). b20: плитки бумаги (NeedTiles),
// а не белая таблица, — та же механика, что выбор потребности в «Что питает».
import { useState } from 'react';
import { useNeedData } from '../../needData';
import { PlanSheet } from '../PlanSheet';
import { NeedTiles } from './NeedTiles';

export function PlanNeedPicker({ onPlanned }: { onPlanned: () => void }) {
  const NEED_DATA = useNeedData();
  const [needId, setNeedId] = useState<string | null>(null);
  const picked = needId ? NEED_DATA[needId] : undefined;
  return (
    <>
      <NeedTiles label="Потребность для плана" onPick={setNeedId} />
      {needId && picked && (
        <PlanSheet
          needId={needId}
          needLabel={picked.name}
          onClose={() => setNeedId(null)}
          onSaved={onPlanned}
        />
      )}
    </>
  );
}
