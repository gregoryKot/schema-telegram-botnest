// Перечитать данные, НЕ стирая уже показанное при сбое. Нужен там, где
// действие уже удалось на сервере, а перечитывание — только освежение
// экрана: его отказ не имеет права выглядеть как «данные пропали».
// Реальный баг (оба кабинета терапевта): после назначения задачи рефетч
// с `.catch(() => [])` обнулял видимый список задач при сетевой ошибке.
export async function reloadKeepingShown<T>(
  fetchFresh: () => Promise<T>,
  show: (fresh: T) => void,
): Promise<void> {
  try {
    show(await fetchFresh());
  } catch (e) {
    console.error('reload failed — keeping already shown data', e);
  }
}
