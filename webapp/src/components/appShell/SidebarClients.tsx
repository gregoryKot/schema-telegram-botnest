// Клиенты в сайдбаре кабинета. Порядок и поиск — те же, что у «Все клиенты»
// (therapist/rosterOrder: сначала ближайшие встречи, «е» находит «ё»),
// подпись и инициалы — общие clientDisplayName/clientAvatarInitials. QA 2026-11: сайдбар шёл в порядке сервера,
// искал по точной подстроке и резал имя slice(0, 2) («Анна Крылова» → «АН»).
// «Показ экрана» (screenShareMode) прячет имена и поиск; без клиентов прятать нечего — блока нет.
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { clientHue, hueStyle } from '../../lib/tone';
import { todayStr } from '../../utils/format';
import { matchesRosterSearch, sortRoster } from '../therapist/rosterOrder';
import { clientAvatarInitials, clientDisplayName } from '../../../../shared/src/therapy/clientInitials';
import { clientRef } from '../../../../shared/src/utils/clientRef';
import { useScreenShare } from './screenShareMode';
import { ScreenShareSwitch } from './ScreenShareSwitch';

/** С какого числа клиентов в сайдбаре появляется поиск. */
const SEARCH_FROM = 5;

export function SidebarClients({ clients }: { clients: TherapyClientSummary[] }) {
  const [search, setSearch] = useState('');
  const screenShare = useScreenShare();
  if (clients.length === 0) return null;
  // Местный день терапевта: с ним sortRoster сравнивает nextSession (его настенное время).
  const shown = screenShare ? [] : sortRoster(clients.filter(c => matchesRosterSearch(c, search)), todayStr());
  return (
    <div className="sb-clients">
      <div className="sb-section-label">Клиенты</div>
      <ScreenShareSwitch on={screenShare} />
      {!screenShare && clients.length >= SEARCH_FROM && (
        <input className="sb-search" value={search} placeholder="Поиск клиента…" aria-label="Поиск клиента"
               onChange={e => setSearch(e.target.value)} />
      )}
      {shown.map(c => {
        const name = clientDisplayName(c);
        return (
          <NavLink key={c.telegramId} to={`/cabinet/${clientRef(c)}`}
                   className={({ isActive }) => `sb-item sb-client-item${isActive ? ' is-active' : ''}`}>
            <span className="sb-client-av" style={hueStyle(clientHue(c.telegramId))}>{clientAvatarInitials(c)}</span>
            <span className="sb-client-name">{name}</span>
            {c.todayIndex != null && <span className="sb-active-dot" />}
          </NavLink>
        );
      })}
    </div>
  );
}
