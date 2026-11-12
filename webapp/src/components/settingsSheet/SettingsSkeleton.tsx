import { Skeleton } from '../Skeleton';

const NAV_ROWS = 6;
/** Строк в группе силуэта: имя, обращение, уведомления, оформление — по форме плоских групп листа. */
const GROUP_ROWS = [1, 1, 4, 1];

/**
 * Силуэт листа «Настройки», пока грузятся настройки: «Закрыть» живая, заголовок,
 * оглавление и группы (ярлык + строки через линию, без карточек) — плашки по форме (заголовок-текст появляется вместе с
 * содержимым: по нему тесты листа ждут конец загрузки). Корень листа
 * (st-overlay) рисует SettingsSheet — он же держит запись истории.
 */
export function SettingsSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="ds-sheet-head">
        <button type="button" className="ds-back" onClick={onClose}>← Закрыть</button>
      </div>
      <div className="st-body" aria-busy="true" data-skeleton="settings">
        <div className="settings-sidenav" aria-hidden>
          {Array.from({ length: NAV_ROWS }, (_, i) => <Skeleton key={i} width="72%" height={14} style={{ margin: '11px 12px' }} />)}
        </div>
        <div className="st-scroll">
          <div className="settings-content-inner st-inner" aria-hidden>
            <div className="ds-h2 st-h"><Skeleton width={150} height={26} /></div>
            {GROUP_ROWS.map((rows, i) => (
              <div key={i} className="st-section">
                <div className="st-sec-head"><Skeleton width={110} height={12} /></div>
                {Array.from({ length: rows }, (_, r) => (
                  <div key={r} className="ds-list-row ds-list-row--nav ds-list-row--inset">
                    <div className="ds-list-body"><Skeleton width={r % 2 ? '46%' : '58%'} height={14} /><Skeleton width="72%" height={11} /></div>
                    <Skeleton width={44} height={26} radius={13} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
