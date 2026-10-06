/** Пока грузится расписание (и чанк пикера): одна строка на все три места — пикер, лендинг, страница /book. */
export function SlotsLoadingNote() {
  return <p style={{ color: 'var(--text-faint)', fontSize: 15, padding: '24px 0' }}>Загружаю свободное время…</p>;
}
