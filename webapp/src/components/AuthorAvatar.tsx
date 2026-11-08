// Автор проекта на фото — общие компоненты лендинга и кабинета (перенос из pages/landing,
// редизайн 2026-11):
//  • AuthorAvatar — круглый аватар: навигация первого экрана лендинга (34px) и липкая панель
//    (30px); буква «Г» под фото — запасной вариант, пока картинка грузится или не загрузилась.
//  • AuthorPhoto — наклеенная фотокарточка в белой рамке с полоской скотча и наклейкой со знаком
//    Talk (разговор с человеком): «Кто это делает» на лендинге и листы «Поговорить» без
//    терапевта — одна карточка, а не копия. Сломанное фото прячет карточку целиком.
// Вид карточки — styles/author-photo.css; раскладку вокруг задаёт место (className).
import { SignScene } from './art/SceneParts';
import { Talk } from './art/PaperArtSigns';
import { hideOnError } from '../pages/landing/hideOnError';
import '../styles/author-photo.css';

const AUTHOR_NAME = 'Григорий Котляревский';

interface AuthorAvatarProps {
  /** Адрес фото терапевта (из админки либо /gregory.jpg по умолчанию). */
  photo: string;
  /** Диаметр круга, px. */
  size: number;
  /** Кегль буквы-запасного варианта, px. */
  letterSize: number;
}

export function AuthorAvatar({ photo, size, letterSize }: AuthorAvatarProps) {
  return (
    <div style={{ position: 'relative', width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ position: 'absolute', fontFamily: 'var(--serif)', fontSize: letterSize, color: 'var(--text-sub)' }}>Г</span>
      <img src={photo} alt={AUTHOR_NAME} decoding="async" width={size} height={size} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }} onError={hideOnError} />
    </div>
  );
}

export function AuthorPhoto({ photo = '/gregory.jpg', className }: { photo?: string; className?: string }) {
  return (
    <div className={className ? `author-photo ${className}` : 'author-photo'}>
      <img className="author-photo-img" src={photo} alt={AUTHOR_NAME} loading="lazy" decoding="async"
        width={300} height={360} onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
      <span className="author-photo-sticker"><SignScene Art={Talk} /></span>
    </div>
  );
}
