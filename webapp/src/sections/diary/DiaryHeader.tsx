import { Sheets } from '../../components/art/PaperArt';

// Шапка «Записей»: герой-блок и единственная залитая кнопка экрана — «Записать» открывает «Дневник одной страницы».
// На ≥768 заголовок и «Записать» стоят в одной строке (client-diary.css, #925).
export function DiaryHeader({ onWrite }: { onWrite: () => void }) {
  return (
    <div className="pp-block cd-head">
      <div className="pp-hero"><div className="pp-hero-body"><div className="ds-eyebrow">Записи</div><h1 className="ds-h1">Что было</h1></div><Sheets size="hero" /></div>
      <button type="button" className="ds-btn ds-btn--lg cd-write" onClick={onWrite}>Записать</button>
    </div>
  );
}
