// Шапка «Записей»: eyebrow, заголовок и главное действие — «Записать» открывает «Дневник одной страницей».
export function DiaryHeader({ onWrite }: { onWrite: () => void }) {
  return (
    <>
      <div className="cd-head">
        <div className="ds-eyebrow">Записи</div>
        <h1 className="ds-h1">Что было</h1>
      </div>
      <button type="button" className="ds-btn cd-write" onClick={onWrite}>Записать</button>
    </>
  );
}
