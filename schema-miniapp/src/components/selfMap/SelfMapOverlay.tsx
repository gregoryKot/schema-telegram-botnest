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
}: {
  sheets: {
    selfMap: boolean;
    close: (k: 'selfMap') => void;
    open: (k: 'caseFlow' | 'schemaInfo' | 'trackerOverlay') => void;
  };
}) {
  const { map, next } = useSelfMapData();
  const close = () => sheets.close('selfMap');

  if (!map || !next) {
    return (
      <BottomSheet onClose={close}>
        <ScreenSkeleton cards={3} />
      </BottomSheet>
    );
  }

  return (
    <SelfMapScreen
      map={map}
      next={next}
      onClose={close}
      onPickMode={close}
      onNextStep={(id) => {
        close();
        // Тест схем и «посмотреть потребности» ведут в свои разделы, всё
        // остальное — обратно в разбор: он и есть основная работа.
        if (id === 'ysq_test') sheets.open('schemaInfo');
        else if (id === 'needs_week') sheets.open('trackerOverlay');
        else sheets.open('caseFlow');
      }}
    />
  );
}
