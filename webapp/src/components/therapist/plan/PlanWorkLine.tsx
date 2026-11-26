import { planWorkLine, type PlanWorkSummary } from '../../../../../shared/src/therapy/plan/planWork';

/** Тихая строка под пунктом: сколько раз работали и когда; тап открывает последнюю запись (есть обработчик). */
export function PlanWorkLine({ summary, onOpen }: { summary: PlanWorkSummary; onOpen?: (noteId: number) => void }) {
  const line = planWorkLine(summary);
  if (!onOpen) return <div className="pl-meta ds-sub">{line}</div>;
  return <button type="button" className="ds-link pl-source pl-work" onClick={() => onOpen(summary.lastNoteId)}>{line}</button>;
}
