// Вход в тест на схемы из справочника — одна плитка на все состояния (APP_2026-11.md, b16): раньше при
// незаконченном тесте стояли две плашки подряд («Незаконченный тест ⏸» и «Продолжить тест»), обе
// открывали одно и то же. Теперь надпись «Незаконченный тест» — над заголовком той же плитки, а
// подпись — «продолжить с места остановки»; запрос терапевта по-прежнему важнее (ysqEntrySub).
import { ysqEntrySub } from '../../../../shared/src/tasks/ysqRequestMark';

type Tr = (ty: string, vy: string) => string;

export interface YsqEntryState {
  hasResult: boolean;
  hasProgress: boolean;
  requested: boolean;
}

export function ysqEntryTile({ hasResult, hasProgress, requested }: YsqEntryState, tr: Tr): { label?: string; title: string; sub: string } {
  if (hasResult) return { title: 'Мои результаты теста', sub: ysqEntrySub({ hasResult, requested }) };
  if (!hasProgress) return { title: 'Пройти тест на схемы', sub: ysqEntrySub({ hasResult, requested }) };
  return {
    label: 'Незаконченный тест',
    title: 'Продолжить тест',
    sub: requested
      ? ysqEntrySub({ hasResult, requested })
      : tr('Нажми, чтобы продолжить с места остановки', 'Нажмите, чтобы продолжить с места остановки'),
  };
}
