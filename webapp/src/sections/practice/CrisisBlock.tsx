// Постоянная точка входа к кризисной помощи на сайте (дизайн-аудит 2026-08,
// В2): раньше карточка на webapp показывалась только реактивно, по
// срабатыванию crisisMarkers в тексте — постоянного «спасательного круга» не
// было. Текст и структура — по образцу helpSection/CrisisSheet.tsx мини-аппа
// (правило №3: контент выверен, не переписываем заново). CrisisCard — без
// surface: это не реактивный показ по детекции, а постоянный блок (см.
// useCrisisCardTracking — карточка без surface не засоряет crisis_card_shown).
import { CrisisCard } from '../../components/CrisisCard';

export function CrisisBlock() {
  return (
    <div className="section">
      <div className="section-head">
        <h3>Помощь рядом</h3>
      </div>
      <CrisisCard />
      <p className="text-sm muted" style={{ lineHeight: 1.6, marginTop: 4 }}>
        Если есть угроза жизни — 112. Разговор с близким человеком тоже
        считается: иногда одно сообщение «мне плохо» — уже первый шаг.
      </p>
    </div>
  );
}
