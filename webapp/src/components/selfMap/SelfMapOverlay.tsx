import { useHistorySheet } from '../../hooks/useHistorySheet';
import { ExScreen } from '../exercises/ExScreen';
import { Skeleton, SkeletonList } from '../Skeleton';
import { SelfMapScreen } from './SelfMapScreen';
import { useSelfMapData } from '../../hooks/useSelfMapData';
import '../../styles/case-quick.css';
import '../../styles/self-map.css';

/**
 * Точка монтирования карты себя — грузит данные только когда карту открыли
 * (правило CLAUDE.md: скелетон по форме контента, а не спиннер, пока карта
 * не готова: лист неба с местом под сцену, полосы строками). Маршрутизация
 * «что дальше» здесь же — тест схем и «посмотреть потребности» ведут в свои
 * разделы, всё остальное возвращает в разбор случая (он и есть основная работа).
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
      <ExScreen onBack={goBack} backLabel="Закрыть" spread look="modes" heroArt={<span className="cq-scene sm-scene-skel" />} eyebrow={null} title="Карта себя">
        <div className="sm-skel" aria-hidden>
          <Skeleton width={150} height={11} />
          <SkeletonList rows={3} height={60} />
          <Skeleton width="100%" height={88} radius={20} />
        </div>
      </ExScreen>
    );
  }

  return (
    <SelfMapScreen
      map={map}
      next={next}
      onBack={goBack}
      onPickMode={goBack}
      onNextStep={(id) => goBack(() => {
        if (id === 'ysq_test') onOpenSchema({ startTest: true });
        else if (id === 'needs_week') onOpenTracker();
        else onStartCase();
      })}
    />
  );
}
