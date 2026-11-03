// Клиенты в сайдбаре кабинета. Порядок и поиск — те же, что у «Все клиенты»
// (sortRoster/filterRoster: сначала ближайшие встречи, «е» находит «ё»),
// инициалы — общий clientInitials. QA 2026-11: сайдбар шёл в порядке сервера,
// искал по точной подстроке и резал имя slice(0, 2) («Анна Крылова» → «АН»).
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { TherapyClientSummary } from '../../api';
import { clientHue, hueStyle } from '../../lib/tone';
import { todayStr } from '../../utils/format';
import { filterRoster, sortRoster } from '../therapist/rosterModel';
import { clientInitials } from '../../../../shared/src/therapy/clientInitials';

/** С какого числа клиентов в сайдбаре появляется поиск. */
const SEARCH_FROM = 5;

export function SidebarClients({ clients }: { clients: TherapyClientSummary[] }) {
  const [search, setSearch] = useState('');
  if (clients.length === 0) return null;
  // Местный день терапевта: с ним sortRoster сравнивает nextSession (его настенное время).
  const shown = sortRoster(filterRoster(clients, search, 'all'), todayStr());
  return (
    <div className="sb-clients">
      <div className="sb-section-label">Клиенты</div>
      {clients.length >= SEARCH_FROM && (
        <input className="sb-search" value={search} placeholder="Поиск клиента…" aria-label="Поиск клиента"
               onChange={e => setSearch(e.target.value)} />
      )}
      {shown.map(c => {
        const name = c.clientAlias ?? c.name ?? `#${c.telegramId}`;
        return (
          <NavLink key={c.telegramId} to={`/cabinet/${c.telegramId}`}
                   className={({ isActive }) => `sb-item sb-client-item${isActive ? ' is-active' : ''}`}>
            <span className="sb-client-av" style={hueStyle(clientHue(c.telegramId))}>{clientInitials(name)}</span>
            <span className="sb-client-name">{name}</span>
            {c.todayIndex != null && <span className="sb-active-dot" />}
          </NavLink>
        );
      })}
    </div>
  );
}
