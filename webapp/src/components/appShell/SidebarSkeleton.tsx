// Силуэт меню на первой загрузке (AppShellSkeleton) — по форме того меню, что откроется: у клиента
// шесть пунктов со знаком и карточка дня, у терапевта переключатель режима, четыре пункта и строки
// клиентов (до 2026-11 терапевт видел клиентский силуэт: три пункта и плитку индекса). Карточки дня на
// «Сегодня» нет — как у меню (SidebarFoot: там тот же трекер на главной). Свёрнутое —
// сразу полоской, без прыжка. Плашки — .skel тоном панели (.sb-skel, index.css).
import { Skeleton } from '../Skeleton';
import { RailHead, SidebarBrand } from './SidebarRail';
import { useSidebarCollapsed } from './sidebarCollapse';

/** Строка пункта: место знака 24×14 и подпись. */
function ItemBar({ width }: { width: number }) {
  return (
    <div className="sb-skel-item">
      <span className="skel sb-skel" style={{ width: 24, height: 14, borderRadius: 4 }} />
      <span className="skel sb-skel" style={{ width, height: 12, borderRadius: 6 }} />
    </div>
  );
}
const CLIENT_ITEMS = [64, 56, 72, 104, 64, 36];
const THERAPIST_ITEMS = [64, 88, 72, 96];
const CLIENT_ROWS = [112, 96, 120, 88];

export function SidebarSkeleton({ therapist = false, today = false }: { therapist?: boolean; today?: boolean }) {
  const collapsed = useSidebarCollapsed();
  const items = therapist ? THERAPIST_ITEMS : CLIENT_ITEMS;
  if (collapsed) {
    return (
      <aside className="sidebar is-collapsed" aria-hidden="true">
        <RailHead />
        <div className="sb-nav">
          {items.map((_, i) => <span key={i} className="skel sb-skel sb-skel-rail" />)}
        </div>
        <div className="sb-foot-wrap"><span className="skel sb-skel sb-skel-avatar" /></div>
      </aside>
    );
  }
  return (
    <aside className="sidebar" aria-hidden="true">
      <SidebarBrand />
      {therapist && <Skeleton height={34} radius={10} style={{ background: 'var(--panel-2)', flexShrink: 0 }} />}
      <div className="sb-nav">
        {items.map((w, i) => <ItemBar key={i} width={w} />)}
        {therapist && (
          <div className="sb-skel-clients">
            <span className="skel sb-skel" style={{ width: 64, height: 10, borderRadius: 6 }} />
            {CLIENT_ROWS.map((w, i) => (
              <div key={i} className="sb-skel-item">
                <span className="skel sb-skel" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                <span className="skel sb-skel" style={{ width: w, height: 11, borderRadius: 6 }} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sb-foot-wrap">
        {!therapist && !today && <div className="pp-paper sb-today sb-skel-today"><Skeleton width={72} height={11} /><Skeleton width={88} height={30} /></div>}
        <div className="sb-skel-item sb-skel-account">
          <span className="skel sb-skel sb-skel-avatar" />
          <span className="skel sb-skel" style={{ width: 96, height: 12, borderRadius: 6 }} />
        </div>
      </div>
    </aside>
  );
}
