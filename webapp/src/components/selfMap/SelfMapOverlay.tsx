import { useHistorySheet } from '../../hooks/useHistorySheet';
import { ExScreen } from '../exercises/ExScreen';
import { ScreenSkeleton } from '../Skeleton';
import { SelfMapScreen } from './SelfMapScreen';
import { useSelfMapData } from '../../hooks/useSelfMapData';

/**
 * Точка монтирования карты себя — грузит данные только когда карту открыли
 * (правило CLAUDE.md: скелетон по форме контента, а не спиннер, пока карта
 * не готова). Twin schema-miniapp SelfMapOverlay.tsx: маршрутизация «что
 * дальше» здесь же — тест схем и «посмотреть потребности» ведут в свои
 * разделы, всё остальное возвращает в разбор случая (он и есть основная
 * работа).
 */
export function SelfMapOverlay({
  onClose,
  onStartCase,
  onOpenTracker,
  onOpenSchema,
}: {
  onClose: () => void;
  onStartCase: () => void;
  onOpenTracker: () => void;
  onOpenSchema: (opts?: { startTest?: boolean }) => void;
}) {
  const goBack = useHistorySheet(onClose);
  const { map, next } = useSelfMapData();

  if (!map || !next) {
    return (
      <ExScreen
        onBack={goBack}
        backLabel="Закрыть"
        eyebrow="Карта себя"
        eyebrowColor="var(--accent-indigo)"
        title="Карта себя"
      >
        <ScreenSkeleton />
      </ExScreen>
    );
  }

  return (
    <SelfMapScreen
      map={map}
      next={next}
      onBack={goBack}
      onPickMode={goBack}
      onNextStep={(id) => {
        goBack();
        if (id === 'ysq_test') onOpenSchema({ startTest: true });
        else if (id === 'needs_week') onOpenTracker();
        else onStartCase();
      }}
    />
  );
}
