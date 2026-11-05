// Шапка «Записей»: подпись, заголовок и единственная залитая кнопка экрана — «Записать»
// открывает «Дневник одной страницей». Без линий и картинки (владелец 2026-11-05 по
// скриншоту: «перегружено»). На ≥768 заголовок и «Записать» в одной строке (client-diary.css).
export function DiaryHeader({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="pp-block pp-block--head cd-head">
      <div className="pp-hero-body"><div className="ds-eyebrow">Записи</div><h1 className="ds-h1">Что было</h1></div>
      <button type="button" className="ds-btn cd-write" onClick={onWrite}>Записать</button>
    </div>
  );
}
