import { useMemo } from 'react';
import { BottomSheet } from '../BottomSheet';
import { SheetHeader, PrimaryAction } from '../diary/diaryFlowUi';
import { CapsLabel, DiaryPanel } from '../diary/diaryUi';
import { SelfMapLane } from './SelfMapLane';
import { useTr } from '../../utils/addressForm';
import { haptic } from '../../haptic';
import {
  buildMapLanes,
  type MapInput,
  type MapLaneId,
} from '../../../../shared/src/map/mapVm';
import {
  caseNextStep,
  buildWhereIAm,
  type NextStepInput,
} from '../../../../shared/src/case/caseNextStep';

/**
 * «Карта себя» — накопитель разборов и единственный экран, отвечающий на
 * вопрос «где я в этой системе и что дальше».
 *
 * Карта не рисуется руками: она складывается из разборов, руками правятся
 * только имена. Подпись «черновик» в шапке — прямая цитата клинического
 * правила составления карты режимов: снять давление сделать правильно с
 * первого раза.
 *
 * Внизу ровно одна кнопка «что дальше» (caseNextStep). Не список опций: экран,
 * предлагающий четыре равнозначных действия, возвращает человека ровно в ту
 * растерянность, из-за которой затевался редизайн.
 */
export function SelfMapScreen({
  map,
  next,
  onClose,
  onPickMode,
  onNextStep,
}: {
  map: MapInput;
  next: NextStepInput;
  onClose: () => void;
  onPickMode: (modeId: string) => void;
  onNextStep: (id: string) => void;
}) {
  const tr = useTr();
  const lanes = useMemo(() => buildMapLanes(map), [map]);
  const step = useMemo(() => caseNextStep(next, tr), [next, tr]);
  const whereIAm = useMemo(() => buildWhereIAm(next, tr), [next, tr]);

  const emptyHints: Record<MapLaneId, string> = {
    healthy: 'Появится, когда в разборе прозвучат свои слова поддержки.',
    stage: 'Первый разбор поставит первую метку.',
    backstage:
      'Откроется из случая, где за тем, кто вышел на сцену, окажется кто-то ещё.',
    origins: '',
  };

  return (
    <BottomSheet onClose={onClose}>
      <SheetHeader title="Карта себя" onBack={onClose} />

      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
        {tr(
          'Черновик. Меняется с каждым разбором — переписать можно когда угодно.',
          'Черновик. Меняется с каждым разбором — переписать можно когда угодно.',
        )}
      </div>

      {lanes.map((lane) => (
        <SelfMapLane
          key={lane.id}
          lane={lane}
          emptyHint={emptyHints[lane.id]}
          onPickMode={onPickMode}
        />
      ))}

      <div
        style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 22px' }}
      >
        {tr('Это части, а не ты целиком.', 'Это части, а не вы целиком.')}
      </div>

      <CapsLabel>Где я сейчас</CapsLabel>
      <DiaryPanel style={{ marginBottom: 22 }}>
        <div style={{ padding: '16px 14px', fontSize: 15, lineHeight: 1.5 }}>
          {whereIAm}
        </div>
      </DiaryPanel>

      <CapsLabel>Что дальше</CapsLabel>
      <PrimaryAction
        label={step.time ? `${step.label} · ${step.time}` : step.label}
        onClick={() => {
          haptic.tap();
          onNextStep(step.id);
        }}
      />
      {step.hint && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          {step.hint}
        </div>
      )}
    </BottomSheet>
  );
}
