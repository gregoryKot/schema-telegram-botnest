// Группировка режимов пользователя с недельной частотой — вынесена из
// ModesTab.tsx (бюджет строк файла-храповика, правило №10 CLAUDE.md), а не
// в utils.ts: у того свой замороженный бейслайн, растить его не нужно.
import { MODE_GROUPS } from '../../schemaTherapyData';
import { FreqGroup } from '../../components/PatternFrequencyList';

export function buildModeFreqGroups(
  myModeIds: string[],
  modeFreq: Record<string, number>,
  statusFor?: (id: string) => string,
): FreqGroup[] {
  return MODE_GROUPS.map((group) => ({
    title: group.group,
    items: group.items
      .filter((m) => myModeIds.includes(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name,
        freq: modeFreq[m.id] ?? 0,
        status: statusFor?.(m.id),
      })),
  })).filter((g) => g.items.length > 0);
}
