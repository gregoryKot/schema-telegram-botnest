import { useState } from 'react';
import { ADMIN_ANALYTICS_DAYS, type AdminAnalyticsDays } from '../../../../../shared/src/analytics/adminAnalytics';
import { OverviewTab } from './OverviewTab';
import { TherapistsTab } from './TherapistsTab';
import { PeopleTab } from './PeopleTab';
import { ReportTab } from './ReportTab';
import { Pills } from './ui';

type Sub = 'main' | 'therapists' | 'people' | 'report';
const SUBS: { id: Sub; label: string }[] = [
  { id: 'main', label: 'Главное' }, { id: 'therapists', label: 'Терапевты' },
  { id: 'people', label: 'Люди' }, { id: 'report', label: 'Все цифры' },
];
const WINDOWS = ADMIN_ANALYTICS_DAYS.map((d) => ({ id: d, label: `${d} дней` }));

/** Вкладка «Аналитика» админки: окно периода + четыре под-вкладки. */
export function AnalyticsSection({ adminKey }: { adminKey: string }) {
  const [sub, setSub] = useState<Sub>('main');
  const [days, setDays] = useState<AdminAnalyticsDays>(30);
  return (
    <div>
      <div className="u-col10 u-mb18">
        <Pills label="Раздел аналитики" items={SUBS} value={sub} onChange={setSub} />
        {sub !== 'report' && <Pills label="Период" items={WINDOWS} value={days} onChange={setDays} />}
      </div>
      {sub === 'main' && <OverviewTab adminKey={adminKey} days={days} />}
      {sub === 'therapists' && <TherapistsTab adminKey={adminKey} days={days} />}
      {sub === 'people' && <PeopleTab adminKey={adminKey} days={days} />}
      {sub === 'report' && <ReportTab adminKey={adminKey} />}
    </div>
  );
}
