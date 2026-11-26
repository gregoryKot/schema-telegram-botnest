import type { NodeProps } from '@xyflow/react';
import { CRITIC_PATH, PENTA_PATH, SHIELD_PATH } from '../../../shared/src/modeMap/modeShapes';
import type { ModeNodeData } from './modeMap/nodeStyle';
import { ribbonPath, stepsPath } from './modeMap/paperShapes';
import { RectNode } from './modeMap/RectNode';
import { SvgShapeNode } from './modeMap/SvgShapeNode';
import '../styles/modemap-paper.css';

// Фигуры холста карты режимов — общие для кабинета терапевта и карты у клиента (ModeMapViewer).
// Бумага и оттенок — modeMap/nodePaper.ts; фигура по контуру — SvgShapeNode, лист — RectNode;
// тулбар, ручки и подпись — modeMap/nodeParts.tsx. Формы: режим — круг (детский) и фигуры групп
// (критик — восьмиугольник, копинги — пятиугольник, щит, капсула), триггер — лента, поведение —
// ступени, схема — слои (ConceptNodes). Те же формы у знаков палитры (PaletteMark).
type P = NodeProps;
const shape = (p: P) => ({ id: p.id, type: p.type, data: p.data as unknown as ModeNodeData, selected: p.selected });

export const CriticModeNode = (p: P) => <SvgShapeNode {...shape(p)} shape={CRITIC_PATH} pad="mm2-n--oct" />;

export const CopingModeNode = function CopingModeNode(p: P) {
  const sub = (p.data as unknown as ModeNodeData).copingSubtype ?? 'over';
  if (sub === 'surr') return <RectNode {...p} variant="pill" />;
  if (sub === 'avoid') return <SvgShapeNode {...shape(p)} shape={SHIELD_PATH} pad="mm2-n--shield" />;
  return <SvgShapeNode {...shape(p)} shape={PENTA_PATH} pad="mm2-n--penta" />;
};

export const ChildModeNode = (p: P) => <RectNode {...p} variant="circle" />;
export const TriggerNode = (p: P) => <SvgShapeNode {...shape(p)} shape={ribbonPath} viewBox={[160, 64]} pad="mm2-n--ribbon" />;
export const HealthyModeNode = (p: P) => <RectNode {...p} />;
export const CustomModeNode = (p: P) => <RectNode {...p} />;
export const BehaviorNode = (p: P) => <SvgShapeNode {...shape(p)} shape={stepsPath} viewBox={[160, 64]} pad="mm2-n--steps" />;
