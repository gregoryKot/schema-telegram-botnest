// Заглушка вместо service worker мини-аппа (docs/ONE_FRONTEND_PLAN.md, этап 2).
// У давно не открывавших мог остаться старый SW с прекэшем /app/: без заглушки
// он отдавал бы старую оболочку даже после редиректа на кабинет. Браузер сам
// перепроверяет скрипт SW по его адресу, получает этот текст и ставит его
// поверх старого: новый воркер забирает управление, чистит кэши, снимает
// регистрацию и перезагружает открытые вкладки.
export const SW_STUB_SOURCE = `self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.allSettled([
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      ]);
      await Promise.allSettled([self.registration.unregister()]);
      const clients = await self.clients.matchAll({ type: 'window' });
      await Promise.allSettled(clients.map((c) => c.navigate(c.url)));
    })(),
  );
});
`;
