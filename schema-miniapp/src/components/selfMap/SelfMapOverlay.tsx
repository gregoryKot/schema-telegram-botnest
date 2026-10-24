import { LazySelfMapScreen as SelfMapScreen } from '../LazyOverlays';
import { useSelfMapData } from '../../hooks/useSelfMapData';
import { ScreenSkeleton } from '../Skeleton';
import { BottomSheet } from '../BottomSheet';

/**
 * Карта себя грузится только когда её открыли: хук внутри отдельного
 * компонента, а не в AppOverlays — иначе три запроса уходили бы на каждый
 * маунт приложения ради экрана, который человек может и не открыть.
 *
 * Пока данные едут — скелетон по форме карты, а не пустая карта: пустая карта
 * читается как упрёк за безделье, и показывать её человеку с разборами
 * нельзя.
 */
export function SelfMapOverlay({
  sheets,
  onClose,
}: {
  sheets: {
    selfMap: boolean;
    open: (k: 'caseFlow' | 'schemaInfo' | 'trackerOverlay') => void;
  };
  onClose: () => void; // closers.selfMap: реестр закрытия, как у «Назад» хоста
}) {
  const { map, next } = useSelfMapData();

  if (!map || !next) {
    return (
      <BottomSheet onClose={onClose}>
        <ScreenSkeleton cards={3} />
      </BottomSheet>
    );
  }

  return (
    <SelfMapScreen
      map={map}
      next={next}
      onClose={onClose}
      onPickMode={onClose}
      onNextStep={(id) => {
        onClose();
        // Тест схем и «посмотреть потребности» ведут в свои разделы, всё
        // остальное — обратно в разбор: он и есть основная работа.
        if (id === 'ysq_test') sheets.open('schemaInfo');
        else if (id === 'needs_week') sheets.open('trackerOverlay');
        else sheets.open('caseFlow');
      }}
    />
  );
}
