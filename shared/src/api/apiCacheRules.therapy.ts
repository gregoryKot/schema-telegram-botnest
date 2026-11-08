// Карта инвалидации ручек /api/therapy/* (src/therapy/*.controller.ts),
// вынесена из apiCacheRules.data.ts (правило №10): строка — решение про роут.
// Id клиента в пути — `(-?\d+)`, с минусом: у офлайн-клиента это
// -TherapyRelation.id (`-57`). До 2026-10 шаблоны были `\d+`, офлайн-клиент
// мимо них проходил, и кабинет до 2 минут показывал старое. Новая мутация с
// :clientId обязана попасть сюда — сверка с контроллерами в
// apiCacheRules.therapy.test.ts.
import type { InvalidationTarget } from './apiCache';
import { numStr, simple, type Rule } from './apiCacheRules.kit';

const T = '/api/therapy';
const FORMER = `${T}/former-therapist`;
const INVITES = `${T}/invites`;
const CLIENTS = `${T}/clients`;
const CLAIMS = `${T}/card-claims`;
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
  // Сообщение о бывшем терапевте зависит от живой связи (former-therapist-
  // info.ts); отключение делает задания терапевта личными (end-client-relations.ts).
  simple('POST', /^\/api\/therapy\/join$/, `${T}/relation`, FORMER),
  simple(
    'DELETE',
    /^\/api\/therapy\/relation$/,
    `${T}/relation`,
    FORMER,
    `${T}/tasks`,
  ),
  // «Ждут подключения»: новое и отозванное меняют список сразу; принятое
  // клиентом уходит на чужом запросе — 15 секунд кеша допустимы.
  simple('POST', /^\/api\/therapy\/invite$/, INVITES),
  // Приглашение из карточки офлайн-клиента сразу видно в «Ждут подключения» и в карточке.
  simple('POST', /^\/api\/therapy\/clients\/-?\d+\/invite$/, INVITES),
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
  // Сверка «тот же человек?» (S8): «Да» переносит записи карточки на аккаунт.
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/card-claims\/(-?\d+)$/,
    targets: (m) => [CLAIMS, CLIENTS, ALL_TASKS, ...clientKeys(m[1])],
  },
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
  // Задание офлайн-клиента закрывает терапевт — меняется и доска (tasks/all).
  simple(
    'POST',
    /^\/api\/therapy\/tasks\/\d+\/complete$/,
    `${T}/tasks`,
    `${T}/tasks/history`,
    ALL_TASKS,
    { prefix: `${T}/tasks/client/` },
  ),
  // deleteTherapyTask(id) — терапевт удаляет задание; клиент задания из id
  // неизвестен (офлайн-клиент — отрицательный id), сбрасываем задания всех
  // клиентов кабинета, доску и списки самого клиента.
  simple(
    'DELETE',
    /^\/api\/therapy\/tasks\/\d+$/,
    `${T}/tasks`,
    `${T}/tasks/history`,
    ALL_TASKS,
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
  // Данные клиента несут ysqRequestPending: после запроса YSQ карточка,
  // открытая заново, обязана показать «запрос отправлен» (QA 2026-11). Сам
  // запрос — задание клиенту: оно сразу видно в его заданиях и на доске.
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/request-ysq\/(-?\d+)$/,
    targets: (m) => [
      `${T}/client-data/${m[1]}`,
      `${T}/tasks/client/${m[1]}`,
      ALL_TASKS,
    ],
  },
  // Список клиентов несёт схемы из концептуализации (getClients); /append — холст.
  {
    method: 'POST',
    pattern: /^\/api\/therapy\/conceptualization\/(-?\d+)(?:\/append)?$/,
    targets: (m) => [`${T}/conceptualization/${m[1]}`, CLIENTS],
  },
  // «Показать клиенту»: GET концептуализации несёт sharedWithClientAt — без строки
  // вкладка после возврата 15 с показывала бы прежнее положение тумблера.
  {
    method: 'PATCH',
    pattern: /^\/api\/therapy\/conceptualization\/(-?\d+)\/share$/,
    targets: (m) => [`${T}/conceptualization/${m[1]}`],
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
