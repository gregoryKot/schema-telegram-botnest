import { Skeleton } from '../Skeleton';

/** Группы силуэта по форме первых групп листа: «Имя» — поле, «Обращение» — сегмент, дальше строки с тумблером. */
const GROUPS: ('field' | 'seg' | number)[] = ['field', 'seg', 4, 1];

function Row({ odd }: { odd: boolean }) {
  return (
    <div className="ds-list-row ds-list-row--nav ds-list-row--inset">
      <div className="ds-list-body"><Skeleton width={odd ? '46%' : '58%'} height={14} /><Skeleton width="72%" height={11} /></div>
      <Skeleton width={44} height={26} radius={13} />
    </div>
  );
}

/**
 * Тело листа «Настройки», пока грузятся настройки: оглавление и группы — плашки по форме
 * (ярлык группы + поле, сегмент или строки через линию, без карточек); заголовок-текст появляется
 * вместе с содержимым — по нему тесты листа ждут конец загрузки. Корень листа и шапку с живой
 * «← Закрыть» рисует SettingsSheet — одни и те же узлы до и после загрузки (фокус не теряется).
 * navRows — сколько пунктов будет в оглавлении (settingsNav): плашки стоят в ячейках пунктов.
 */
export function SettingsSkeleton({ navRows }: { navRows: number }) {
  return (
    <div className="st-body" aria-busy="true" data-skeleton="settings">
      <div className="settings-sidenav" aria-hidden>
        {Array.from({ length: navRows }, (_, i) => (
          <div key={i} className="settings-sidenav-item st-navitem st-skel-nav"><Skeleton width="72%" height={14} /></div>
        ))}
      </div>
      <div className="st-scroll">
        <div className="settings-content-inner st-inner" aria-hidden>
          <div className="ds-h2 st-h st-skel-line"><Skeleton width={150} height={26} /></div>
          {GROUPS.map((g, i) => (
            <div key={i} className="st-section">
              <div className="st-sec-head"><div className="ds-label st-skel-line"><Skeleton width={110} height={12} /></div></div>
              {g === 'field' && <div className="st-row-name"><div className="st-skel-field"><Skeleton width="100%" height="100%" radius={12} /></div></div>}
              {g === 'seg' && <div className="st-body-block"><div className="st-skel-seg"><Skeleton width="100%" height="100%" radius={20} /></div></div>}
              {typeof g === 'number' && Array.from({ length: g }, (_, r) => <Row key={r} odd={r % 2 === 1} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
