import { Skeleton, SkeletonCard } from '../Skeleton';

const NAV_ROWS = 6;
const SECTION_HEIGHTS = [132, 176, 132, 96];

/**
 * Силуэт листа «Настройки», пока грузятся настройки: «Закрыть» живая, заголовок,
 * оглавление и разделы — плашки по форме (заголовок-текст появляется вместе с
 * содержимым: по нему тесты листа ждут конец загрузки). Корень листа
 * (st-overlay) рисует SettingsSheet — он же держит запись истории.
 */
export function SettingsSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={onClose}>← Закрыть</button>
        <Skeleton width={150} height={26} />
      </div>
      <div className="st-body" aria-busy="true" data-skeleton="settings">
        <div className="settings-sidenav" aria-hidden>
          {Array.from({ length: NAV_ROWS }, (_, i) => <Skeleton key={i} width="72%" height={14} style={{ margin: '11px 12px' }} />)}
        </div>
        <div className="st-scroll">
          <div className="settings-content-inner st-inner" aria-hidden>
            {SECTION_HEIGHTS.map((h, i) => <SkeletonCard key={i} height={h} />)}
          </div>
        </div>
      </div>
    </>
  );
}
