// Карта инвалидации ручек /api/therapy/* (src/therapy/*.controller.ts):
// связь клиент↔терапевт и кабинет терапевта. Вынесено из
// apiCacheRules.data.ts (правило №10), принцип тот же: каждая строка —
// решение про конкретный роут.
//
// Id клиента в пути — `(-?\d+)`, с минусом. У клиента с аккаунтом это id
// пользователя, у офлайн-клиента — отрицательный -TherapyRelation.id (`-57`,
// therapy-relations.service.ts getClients). До 2026-10 шаблоны были `\d+`,
// офлайн-клиент мимо них проходил, и после правки, переименования или
// удаления кабинет до 2 минут показывал старое (apiCache.ts: свежо 15 с,
// протухает за 2 мин). Новая мутация с :clientId обязана попасть сюда —
// сверку с контроллерами держит apiCacheRules.therapy.test.ts.
import type { InvalidationTarget } from './apiCache';
import { numStr, simple, type Rule } from './apiCacheRules.kit';

const T = '/api/therapy';
const FORMER = `${T}/former-therapist`;
const INVITES = `${T}/invites`;
const CLIENTS = `${T}/clients`;
// Канбан «Задания» (tasks/all): имя клиента и его задания.
const ALL_TASKS = `${T}/tasks/all`;
const MODE_MAPS = { prefix: `${T}/mode-maps/` };

/** Всё, что кабинет кеширует про одного клиента (GET с :clientId). */
const clientKeys = (id: string): InvalidationTarget[] => [
  `${T}/client-data/${id}`,
  `${T}/client-history/${id}`,
  `${T}/notes/${id}`,
  `${T}/conceptualization/${id}`,
  `${T}/tasks/client/${id}`,
  `${T}/mode-maps/${id}`,
  { prefix: `${T}/client/${id}/` }, // diary, schema-notes, mode-notes
];

export const THERAPY_RULES: Rule[] = [
  // Сообщение о бывшем терапевте зависит от живой связи: подключился по коду —
  // пропадает, отключился — может вернуться (former-therapist-info.ts).
  simple('POST', /^\/api\/therapy\/join$/, `${T}/relation`, FORMER),
  simple('DELETE', /^\/api\/therapy\/relation$/, `${T}/relation`, FORMER),
  // Живые приглашения терапевта («Ждут подключения»): новое и отозванное
  // меняют список сразу; принятое клиентом уходит из него на чужом запросе —
  // его кеш у терапевта живёт 15 секунд, это допустимо.
  simple('POST', /^\/api\/therapy\/invite$/, INVITES),
  simple('DELETE', /^\/api\/therapy\/invites\/\d+$/, INVITES),
  simple('POST', /^\/api\/therapy\/clients\/virtual$/, CLIENTS),
  // Удаление стирает связь, заметки, концептуализацию, карты режимов, а у
  // офлайн-клиента и задания (remove-client.ts) — сбрасываем всё про клиента.
  {
    method: 'DELETE',
    pattern: /^\/api\/therapy\/clients\/(-?\d+)$/,
    targets: (m) => [CLIENTS, ALL_TASKS, ...clientKeys(m[1])],
  },
  simple('POST', /^\/api\/therapy\/rename-client\/-?\d+$/, CLIENTS, ALL_TASKS),
  simple('POST', /^\/api\/therapy\/become-therapist$/, `${T}/request`),
  simple('POST', /^\/api\/therapy\/request$/, `${T}/request`),
  simple('POST', /^\/api\/therapy\/therapist-view$/, '/api/user-flags'),
  simple(
    'DELETE',
    /^\/api\/therapy\/therapist-role$/,
    '/api/user-flags',
    CLIENTS,
    INVITES,
  ),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/tasks$/,
    targets: (_m, body) => {
      const clientId = numStr(body?.clientId);
      return clientId
        ? [`${T}/tasks`, `${T}/tasks/client/${clientId}`, ALL_TASKS]
        : [`${T}/tasks`];
    },
  },
  // completeTask(id) — clientId владельца задачи неизвестен из одного id.
  simple(
    'POST',
    /^\/api\/therapy\/tasks\/\d+\/complete$/,
    `${T}/tasks`,
    `${T}/tasks/history`,
    { prefix: `${T}/tasks/client/` },
  ),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/notes\/(-?\d+)$/,
    targets: (m) => [`${T}/notes/${m[1]}`],
  },
  // deleteTherapistNote(noteId) — clientId заметки неизвестен из noteId.
  simple('DELETE', /^\/api\/therapy\/notes\/\d+$/, { prefix: `${T}/notes/` }),
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/session-info\/(-?\d+)$/,
    targets: (m) => [`${T}/client-data/${m[1]}`, CLIENTS],
  },
  // Список клиентов несёт схемы из концептуализации (getClients, schemaIds).
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/conceptualization\/(-?\d+)$/,
    targets: (m) => [`${T}/conceptualization/${m[1]}`, CLIENTS],
  },
  // Карты режимов (ModeMapSelector, «Открыть на холсте»): без строки новая
  // карта не попадала в список, а правки холста пропадали при возврате на
  // вкладку. PATCH/DELETE знают только mapId — список клиента неизвестен,
  // сбрасываем карты кабинета целиком.
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/mode-maps\/(-?\d+)$/,
    targets: (m) => [`${T}/mode-maps/${m[1]}`],
  },
  simple('PATCH', /^\/api\/therapy\/mode-maps\/map\/\d+$/, MODE_MAPS),
  simple('DELETE', /^\/api\/therapy\/mode-maps\/map\/\d+$/, MODE_MAPS),
  simple('POST', /^\/api\/therapy\/custom-modes$/, `${T}/custom-modes`),
  simple('DELETE', /^\/api\/therapy\/custom-modes\/\d+$/, `${T}/custom-modes`),
];
