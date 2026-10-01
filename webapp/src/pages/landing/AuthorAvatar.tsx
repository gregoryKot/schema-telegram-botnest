// Круглый аватар автора визитки: буква «Г» под фото — запасной вариант,
// пока картинка грузится или не загрузилась. Один компонент на навигацию
// первого экрана (HeroSection, 34px) и липкую панель (LandingPage, 30px) —
// до выноса две копии одной разметки.
import { hideOnError } from './hideOnError';

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
      <img src={photo} alt="Григорий Котляревский" decoding="async" width={size} height={size} style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 18%' }} onError={hideOnError} />
    </div>
  );
}
