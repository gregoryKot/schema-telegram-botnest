import { useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { DayHistory } from '../../types';
import { fillHistoryGaps } from './navigation';

/**
 * История потребностей для вкладки «История» трекера: грузится, когда вкладку
 * открыли. Сбой ≠ пусто: до 2026-11 промис истории шёл без catch (нашёл
 * no-floating-promises), и отказ сети рисовал пустую историю — читалось как
 * «записи пропали». Теперь отказ ставит `historyFailed`, лист говорит «не
 * загрузилось», а сбой уходит отчётом наверх (правило №14).
 */
export function useTrackerHistory(trackerTab: string, historyDays: number) {
  const [history, setHistory] = useState<DayHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);

  // Скелетон — с того же рендера, где открыли вкладку: состояние правится во
  // время рендера (не в эффекте), чтобы не попасть под set-state-in-effect.
  const [seenTab, setSeenTab] = useState(trackerTab);
  if (trackerTab !== seenTab) {
    setSeenTab(trackerTab);
    if (trackerTab === 'history') { setHistoryLoading(true); setHistoryFailed(false); }
  }

  useEffect(() => {
    if (trackerTab !== 'history') return;
    let alive = true;
    api.history(historyDays)
      .then(h => { if (alive) setHistory(fillHistoryGaps(h)); })
      .catch((e: unknown) => {
        if (alive) setHistoryFailed(true);
        reportClientError({ message: `tracker history load failed: ${e instanceof Error ? e.message : String(e)}`, section: 'tracker.history' });
      })
      .finally(() => { if (alive) setHistoryLoading(false); });
    return () => { alive = false; };
  }, [trackerTab, historyDays]);

  /** История, перечитанная листом (после оценки задним числом). */
  const onHistoryRefreshed = (h: DayHistory[]) => { setHistory(h); setHistoryLoading(false); setHistoryFailed(false); };

  return { history, historyLoading, historyFailed, onHistoryRefreshed };
}
