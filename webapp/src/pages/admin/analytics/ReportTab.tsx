import { useState } from 'react';
import { card } from '../shared';
import { Skeleton } from '../../../components/Skeleton';
import { analyticsApi } from './analyticsApi';
import { useAdminData } from './useAdminData';
import { MarkupText } from './MarkupText';
import { CardsSkeleton, EmptyNote, ErrorRetry, Hint, Pills } from './ui';

function SectionText({ adminKey, id }: { adminKey: string; id: string }) {
  const { data, error, loading, retry } = useAdminData(() => analyticsApi.section(adminKey, id), [adminKey, id]);
  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  if (loading || !data) return <Skeleton height={220} radius={14} />;
  return <div style={{ ...card, fontSize: 14, lineHeight: 1.55, color: 'var(--text)' }}>{data.text.trim() ? <MarkupText text={data.text} /> : <EmptyNote />}</div>;
}

export function ReportTab({ adminKey }: { adminKey: string }) {
  const { data, error, loading, retry } = useAdminData(() => analyticsApi.sections(adminKey), [adminKey]);
  const [picked, setPicked] = useState<string | null>(null);
  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  const id = picked ?? data?.[0]?.id ?? null;
  return (
    <div>
      <Hint>Подробный отчёт по разделам: те же цифры, что раньше показывал бот. Раздел выбирается кнопками.</Hint>
      {loading || !data ? <CardsSkeleton count={2} height={100} /> : !data.length || !id ? <EmptyNote /> : (
        <>
          <div className="u-mb14">
            <Pills label="Раздел отчёта" items={data.map((s) => ({ id: s.id, label: s.title }))} value={id} onChange={setPicked} />
          </div>
          <SectionText adminKey={adminKey} id={id} />
        </>
      )}
    </div>
  );
}
