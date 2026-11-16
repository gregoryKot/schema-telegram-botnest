import { Skeleton, SkeletonLines } from '../Skeleton';
import { PaperAlert } from '../paper/PaperAlert';

const COPY = {
  relation: { label: 'Загружается связь с терапевтом', failed: 'Поле для кода откроется после загрузки, чтобы не подключиться второй раз.' },
  request: { label: 'Загружается заявка', failed: 'Форма заявки откроется после загрузки, чтобы не ушла вторая заявка.' },
};

/**
 * Раздел листа, чьи данные ещё не пришли (useSectionLoadFailure): загрузка — силуэт текста и кнопки,
 * сбой — PaperAlert с «Повторить». Сбой не рисуется как «пусто»: иначе открылась бы форма (№14).
 */
export function SectionLoadState({ of, load }: { of: keyof typeof COPY; load: { failed: boolean; retry: () => void } }) {
  const copy = COPY[of];
  if (load.failed) return <PaperAlert title="Не загрузилось." text={copy.failed} onRetry={load.retry} />;
  return (
    <div aria-busy="true" aria-label={copy.label} className="st-body-block">
      <SkeletonLines widths={['82%', '64%']} />
      <Skeleton width={180} height={36} radius={18} />
    </div>
  );
}
