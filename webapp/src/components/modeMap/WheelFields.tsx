import { useEffect, useState } from 'react';
import type { ModeMapNode, UserId } from '../../api';
import { NEED_ORDER } from '../../needData';
import type { NeedId } from '../../../../shared/src/needs/types';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../Skeleton';
import { SegRow } from './EditorParts';
import { WheelChildhood } from './WheelLinks';
import { WheelNeedRow } from './WheelNeedRow';
import { PERIODS, WHEEL_NEED_EVENT, wheelPeriod } from './needWheel';
import { useWheel } from './wheelContext';
import '../../styles/sheet-exercises.css'; // ползунок «Колеса детства» (ex-wheel.css подключается только через него)

type Data = ModeMapNode['data'];

/**
 * Панель колеса потребностей (лист Farrell & Shaw). Один период за раз («Сейчас» по
 * умолчанию; он же виден на колесе): пять ползунков 0–10 — те же, что в упражнении
 * клиента, на экране проценты. Потребность раскрывается кликом по ней или по её
 * сектору: что о ней сказано в концептуализации и поле листа за этот период.
 * Оценки и тексты пишутся в концептуализацию клиента (useWheel), период — в карту.
 */
export function WheelFields({ data, patchData, clientId }: { data: Data; patchData: (d: Partial<Data>) => void; clientId?: UserId }) {
  const tr = useTr();
  const wheel = useWheel();
  const view = data.wheel ?? {};
  const period = wheelPeriod(view);
  const [open, setOpen] = useState<NeedId | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if ((NEED_ORDER as readonly string[]).includes(id)) setOpen(id as NeedId);
    };
    window.addEventListener(WHEEL_NEED_EVENT, h);
    return () => window.removeEventListener(WHEEL_NEED_EVENT, h);
  }, []);
  const links = wheel?.links ?? null;
  return (
    <>
      <div className="mm2-hint">
        <div className="ds-label">Колесо потребностей</div>
        <p className="mm2-hint-p">Пять базовых потребностей по листу Фаррелл и Шоу: насколько каждая удовлетворялась в детстве, в 11–17 лет и сейчас.</p>
        <p className="mm2-hint-p">{tr('Выбери период и поставь процент по каждой потребности. Колесо одно на клиента: оно же видно в «Концептуализации».',
          'Выберите период и поставьте процент по каждой потребности. Колесо одно на клиента: оно же видно в «Концептуализации».')}</p>
      </div>

      <div className="ds-label">Период</div>
      <SegRow items={PERIODS.map(x => ({ key: x.id, label: x.label, active: period === x.id, onPick: () => patchData({ wheel: { ...view, period: x.id } }) }))} />
      {period !== 'child' && (
        <label className="mm2-check">
          <input type="checkbox" checked={!!view.compare} onChange={e => patchData({ wheel: { ...view, compare: e.target.checked || undefined } })} />
          Контур детства поверх
        </label>
      )}

      {!links && !wheel?.failed && <div aria-busy="true"><Skeleton width="100%" height={180} radius={12} /></div>}
      {wheel?.failed && <p className="mm2-hint-p" role="alert">Концептуализация клиента не загрузилась: проценты и текст сейчас недоступны.</p>}
      {links && wheel && (
        <>
          {period === 'child' && <WheelChildhood clientId={clientId} links={links} onApply={wheel.save} />}
          {wheel.status === 'failed' && (
            <p className="mm2-hint-p" role="alert">Колесо не сохранилось.{' '}
              <button type="button" className="ds-link ds-link--inline" onClick={wheel.retry}>Повторить</button></p>
          )}
          {NEED_ORDER.map(id => (
            <WheelNeedRow key={id} needId={id} period={period} links={links} open={open === id}
              onToggle={() => setOpen(open === id ? null : id)} onSave={wheel.save} />
          ))}
        </>
      )}
    </>
  );
}
