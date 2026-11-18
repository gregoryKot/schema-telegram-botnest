// Данные общего поиска с сервера: клиенты терапевта и своё у клиента — задания и планы. Своё грузится
// только в режиме клиента, при открытии палитры; не загрузилось — пусто, строк нет.
import { useEffect, useState } from 'react';
import { api, reportClientError, type TherapyClientSummary } from '../../api';
import type { PaletteInput } from './paletteInput';

const EMPTY: PaletteInput['own'] = { tasks: [], plans: [] };
/** Сбой загрузки строк не показывается (их просто нет), но уходит отчётом наверх. */
const failed = (what: string) => () => reportClientError({ message: `search: ${what} не загрузились`, section: 'commandPalette' });

export function usePaletteClientData(therapist: boolean, cabinet: boolean): { clients: TherapyClientSummary[]; own: PaletteInput['own'] } {
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const [own, setOwn] = useState(EMPTY);
  useEffect(() => {
    if (therapist) api.getTherapyClients().then(setClients).catch(failed('клиенты'));
  }, [therapist]);
  useEffect(() => {
    if (cabinet) return;
    let alive = true;
    api.getTasks().then((tasks) => { if (alive) setOwn((o) => ({ ...o, tasks })); }).catch(failed('задания'));
    api.getPlanHistory().then((plans) => { if (alive) setOwn((o) => ({ ...o, plans })); }).catch(failed('планы'));
    return () => { alive = false; };
  }, [cabinet]);
  return { clients, own: cabinet ? EMPTY : own };
}
