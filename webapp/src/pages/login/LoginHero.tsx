import { Strokes, Ribbon, Pebbles } from '../../components/art/PaperArt';

// Панель входа: знак, слоган и три бумажных мотива (полоски, лента, камушки). Обращения
// к читателю в тексте нет: экран показывается до входа, формы ты/вы ещё нет.
export function LoginHero() {
  return (
    <aside className="al-hero">
      <div className="al-brand">
        <div className="al-logo">В</div>
        <span className="al-brand-name">Всё по схеме</span>
      </div>
      <div className="al-pitch">
        <h2 className="al-slogan">
          От «что со мной не так» к <i>«какая схема включилась»</i>
        </h2>
        <p className="al-lead">Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами</p>
      </div>
      <div className="al-art" aria-hidden="true">
        <Strokes size="square" />
        <Ribbon size="square" />
        <Pebbles size="square" />
      </div>
    </aside>
  );
}
