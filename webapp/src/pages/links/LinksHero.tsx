// Шапка страницы ссылок: фотокарточка визитки (AuthorPhoto) и приветствие.
import { AuthorPhoto } from '../../components/AuthorAvatar';

export function LinksHero() {
  return (
    <header className="lk-hello">
      <AuthorPhoto className="lk-photo" />
      <div className="lk-hi">
        <span className="lk-pen">Привет!</span>
        <h1>Я Григорий Котляревский</h1>
        <p>Работаю в подходе <span className="lk-nb">схема-терапия</span></p>
      </div>
    </header>
  );
}
