import { modeDiaryLabel } from './journey-diary-labels';

export { schemaDiaryLabels } from './journey-diary-labels';

/** Запись дневника режимов в ленте: из разбора (fromCase) — тип 'case'. */
export const modeDiaryItem = (e: {
  id: number;
  createdAt: Date;
  modeId: string;
  fromCase: boolean;
}) => ({
  type: e.fromCase ? ('case' as const) : ('mode_diary' as const),
  id: e.id,
  at: e.createdAt.toISOString(),
  modeId: modeDiaryLabel(e),
});
