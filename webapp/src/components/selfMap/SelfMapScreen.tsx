import { buildSelfMapIntro } from '../../../../shared/src/onboarding/onboardingExplainers';
import { useMemo } from 'react';
import { haptic } from '../../haptic';
import { ExScreen } from '../exercises/ExScreen';
import { SelfMapLane } from './SelfMapLane';
import { SelfMapOrigins } from './SelfMapOrigins';
import { buildStage } from './selfMapStage';
import { SceneStage } from '../art/SceneStage';
import { getModeById } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { buildMapLanes, mapIsEmpty, type MapInput, type MapLaneId } from '../../../../shared/src/map/mapVm';
import { buildOrigins, type OriginsInput } from '../../../../shared/src/map/mapOrigins';
import { caseNextStep, buildWhereIAm, type NextStepInput, type NextStepId } from '../../../../shared/src/case/caseNextStep';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/case-quick.css';
import '../../styles/self-map.css';
const groupOf = (modeId: string) => getModeById(modeId)?.groupId;

/**
 * «Карта себя» — накопитель разборов, единственный экран, отвечающий на
 * вопрос «где я в этой системе и что дальше». Карта не рисуется руками —
 * складывается из разборов. Герой — сцена-театр SceneStage на листе режимов
 * (небо): круги частей из тех же полос, что строки ниже; на компьютере —
 * разворот, сцена слева, полосы справа. Надпись над заголовком не дублирует его.
 *
 * Внизу ровно одна кнопка «что дальше» (caseNextStep) — не список опций
 * (правило онбординга «одно очевидное действие на экран»); на пустой карте она
 * сразу под героем — иначе на телефоне уходит за сгиб.
 */
export function SelfMapScreen({ map, next, origins, onBack, onPickMode, onPickSchema, onOpenPatterns, onStartTest, onNextStep }: {
  map: MapInput;
  next: NextStepInput;
  origins: OriginsInput;
  onBack: () => void;
  onPickMode: (modeId: string) => void;
  onPickSchema: (schemaId: string) => void;
  onOpenPatterns: () => void;
  onStartTest: () => void;
  onNextStep: (id: NextStepId) => void;
}) {
  const tr = useTr();
  const lanes = useMemo(() => buildMapLanes(map), [map]);
  const stage = useMemo(() => buildStage(lanes, groupOf), [lanes]);
  const originsView = useMemo(() => buildOrigins(origins), [origins]);
  const step = useMemo(() => caseNextStep(next, tr), [next, tr]);
  const whereIAm = useMemo(() => glue(buildWhereIAm(next, tr)), [next, tr]);
  const empty = mapIsEmpty(map);

  const emptyHints: Record<MapLaneId, string> = {
    healthy: 'Появится, когда в разборе прозвучат свои слова поддержки.',
    stage: '',
    backstage:
      'Откроется из случая, где за тем, кто вышел на сцену, окажется кто-то ещё.',
  };

  const nextBlock = (
    <div className="sm-next">
      <div className="ds-label">Что дальше</div>
      <button type="button" className="ds-btn sm-next-btn" onClick={() => { haptic.tap(); onNextStep(step.id); }}>
        {glue(step.time ? `${step.label} · ${step.time}` : step.label)}
      </button>
      {step.hint && <p className="sm-hint">{step.hint}</p>}
    </div>
  );

  return (
    <ExScreen
      onBack={onBack} backLabel="Закрыть" spread
      look="modes" heroArt={<SceneStage model={stage} className="cq-scene" />}
      eyebrow={null} title="Карта себя" lede={buildSelfMapIntro(tr)}
    >
      {empty && nextBlock}

      {lanes.map((lane) => (
        <SelfMapLane key={lane.id} lane={lane} emptyHint={emptyHints[lane.id]} onPickMode={onPickMode} />
      ))}

      {(!empty || originsView.items.length > 0) && (
        <SelfMapOrigins view={originsView} onPickSchema={onPickSchema} onStartTest={onStartTest} onOpenPatterns={onOpenPatterns} />
      )}

      {!empty && <p className="sm-note">{tr('Это части, а не ты целиком.', 'Это части, а не вы целиком.')}</p>}

      {whereIAm && (
        <div className="pp-paper sm-where">
          <div className="ds-label">Где я сейчас</div>
          <p className="sm-where-text">{whereIAm}</p>
        </div>
      )}

      {!empty && nextBlock}

      <button type="button" className="ds-link sm-patterns-link" onClick={onOpenPatterns}>Все режимы и схемы →</button>
    </ExScreen>
  );
}
