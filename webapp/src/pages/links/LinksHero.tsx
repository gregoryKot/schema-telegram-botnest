// Шапка страницы ссылок: фотокарточка визитки (AuthorPhoto) с подписью пером и приветствие.
import { AuthorPhoto } from '../../components/AuthorAvatar';

export function LinksHero() {
  return (
    <header className="lk-hello">
      <figure className="lk-photo-fig">
        <AuthorPhoto className="lk-photo" />
        <figcaption className="lk-pen">это я</figcaption>
      </figure>
      <div className="lk-hi">
        <span className="lk-pen">Привет!</span>
        <h1>Я Григорий Котляревский</h1>
        <p>Работаю в подходе схема-терапия — <span className="lk-marker">с тем, что мешает жить.</span></p>
      </div>
    </header>
  );
}
