// Состояние супервизора старта (deploy/entrypoint.mjs) для front: причина
// техработ заголовком X-Maintenance-Reason (maintenance-page.mjs).
//
// Аудит 2026-10, «Красный смок не говорит, что именно лежит»: окно старта,
// упавший `migrate deploy` и крашлуп давали одну и ту же страницу техработ.
// Каждый шаг супервизора пишет сюда своё состояние, парковка — своё.
//
// Только встроенные модули Node: супервизор обязан работать при сломанной сборке.

export function createSupervisorStatus() {
  let reason = 'starting';
  return {
    reason: () => reason,
    set(next) {
      reason = next;
    },
    /** Парковка на техработах: причина наружу. */
    async park(next) {
      reason = next;
      return 'skipped';
    },
  };
}
