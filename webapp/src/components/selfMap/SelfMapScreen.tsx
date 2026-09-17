import { useMemo } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { SelfMapLane } from './SelfMapLane';
import { useTr } from '../../utils/addressForm';
import {
  buildMapLanes,
  type MapInput,
  type MapLaneId,
} from '../../../../shared/src/map/mapVm';
import {
  caseNextStep,
  buildWhereIAm,
  type NextStepInput,
  type NextStepId,
} from '../../../../shared/src/case/caseNextStep';

/**
 * «Карта себя» — накопитель разборов, единственный экран, отвечающий на
 * вопрос «где я в этой системе и что дальше». Карта не рисуется руками —
 * складывается из разборов. Twin schema-miniapp SelfMapScreen.tsx, разметка —
 * webapp ExScreen (единая колонка, без aside — экран для чтения, не форма).
 *
 * Внизу ровно одна кнопка «что дальше» (caseNextStep) — не список опций
 * (правило онбординга «одно очевидное действие на экран»).
 */
export function SelfMapScreen({
  map,
  next,
  onBack,
  onPickMode,
  onNextStep,
}: {
  map: MapInput;
  next: NextStepInput;
  onBack: () => void;
  onPickMode: (modeId: string) => void;
  onNextStep: (id: NextStepId) => void;
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
    <ExScreen
      onBack={onBack}
      backLabel="Закрыть"
      eyebrow="Карта себя"
      eyebrowColor="var(--accent-indigo)"
      title="Карта себя"
      lede={tr(
        'Черновик. Меняется с каждым разбором — переписать можно когда угодно.',
        'Черновик. Меняется с каждым разбором — переписать можно когда угодно.',
      )}
    >
      {lanes.map((lane) => (
        <SelfMapLane
          key={lane.id}
          lane={lane}
          emptyHint={emptyHints[lane.id]}
          onPickMode={onPickMode}
        />
      ))}

      <div style={{ fontSize: 13, color: 'var(--text-faint)', margin: '0 0 24px' }}>
        {tr('Это части, а не ты целиком.', 'Это части, а не вы целиком.')}
      </div>

      <div className="aside-card" style={{ margin: '0 0 24px' }}>
        <div className="aside-card-eyebrow">Где я сейчас</div>
        <p className="body">{whereIAm}</p>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>Что дальше</div>
      <button
        type="button"
        className="ex-btn ex-btn-primary"
        onClick={() => onNextStep(step.id)}
      >
        {step.time ? `${step.label} · ${step.time}` : step.label}
      </button>
      {step.hint && (
        <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 10 }}>
          {step.hint}
        </div>
      )}
    </ExScreen>
  );
}
