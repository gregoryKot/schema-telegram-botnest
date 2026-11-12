import { PrivacyArt, PrivacyItem } from './TherapistPrivacyParts';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { glueSpaces } from '../../../shared/src/utils/typo';
import { markTherapistDisclaimerSeen } from './therapistDisclaimerSeen';
import { PRIVACY_TILE_LOOK, type PrivacyTile } from './therapist/cabinetLook';
import '../styles/sheet-tasks.css';

interface Props { onDone: () => void }

/**
 * Первый вход в кабинет терапевта: короткий этический дисклеймер о том, что
 * клиентов лучше записывать под инициалами/псевдонимом, а не полным именем.
 * Показывается один раз (флаг в localStorage).
 */
export function TherapistPrivacyDisclaimer({ onDone }: Props) {
  const goBack = useHistorySheet(onDone);
  const tr = useTr();

  // Тексты гарантий — те же; порядок плиток 2×2 задаёт PRIVACY_TILE_LOOK (соседние — дальше 40°).
  const items: Record<PrivacyTile, [string, string]> = {
    encrypt: ['Шифрование',
      'Всё чувствительное — заметки, записи о сессиях, дневники — хранится в зашифрованном виде (AES-256-GCM). Ключ лежит отдельно от базы, поэтому даже при её утечке прочитать данные без него невозможно.'],
    access: [tr('Только твой доступ', 'Только ваш доступ'), tr('Данные каждого клиента видишь только ты — они привязаны к твоему аккаунту и не пересекаются с чужими.', 'Данные каждого клиента видите только вы — они привязаны к вашему аккаунту и не пересекаются с чужими.')],
    login: ['Защищённый вход',
      'Вход подтверждается подписью Telegram, а попытки подделать сессию мы отслеживаем и отклоняем.'],
    delete: ['Полное удаление', tr('Если решишь удалить аккаунт — данные стираются насовсем, без «скрытых» копий про запас.', 'Если решите удалить аккаунт — данные стираются насовсем, без «скрытых» копий про запас.')],
  };

  function acknowledge() {
    markTherapistDisclaimerSeen();
    goBack();
  }

  return (
    <div className="sk-priv">
      <div className="sk-priv-col">

        <div className="sk-priv-head">
          <PrivacyArt />
          <h1 className="ds-h2 sk-priv-title">{glueSpaces('Немного о заботе о клиентах')}</h1>
          <p className="sk-priv-lead">
            {tr('Здесь будет твоя работа с людьми, которые тебе доверились. Одна маленькая привычка поможет бережно сохранить это доверие.', 'Здесь будет ваша работа с людьми, которые вам доверились. Одна маленькая привычка поможет бережно сохранить это доверие.')}
          </p>
        </div>

        <p className="sk-priv-p">
          Пожалуйста, {tr('старайся', 'старайтесь')} <span className="u-w600">не вносить настоящие имена
          и фамилии клиентов</span> — ни в карточку клиента, ни в заметки, ни в записи о
          сессиях. Достаточно инициалов, псевдонима или любого обозначения, понятного
          только {tr('тебе', 'вам')}.
        </p>

        <p className="sk-priv-p">
          Это привычная профессиональная практика, а не лишняя перестраховка — так бережно
          поступают даже с бумажными записями: если они вдруг окажутся не у тех людей,
          по ним нельзя будет понять, о ком речь.
        </p>

        <div className="sk-priv-note">
          На этом стоят и этические кодексы психологов —{' '}
          <span className="sk-priv-em">РПО</span> и{' '}
          <span className="sk-priv-em">APA (стандарт 6.02)</span>:
          они рекомендуют обезличивать данные клиента и использовать условные обозначения
          вместо настоящих имён.
        </div>

        <p className="sk-priv-p">
          А обо всём остальном мы уже позаботились. Вот что делаем со своей стороны:
        </p>

        <div className="sk-priv-list">
          {PRIVACY_TILE_LOOK.map(({ key, hue, sign }) => (
            <PrivacyItem key={key} title={items[key][0]} text={items[key][1]} hue={hue} sign={sign} />
          ))}
        </div>

        <p className="sk-priv-p sk-priv-p--sub">
          И всё же самая надёжная защита — когда лишних персональных данных в системе
          просто нет.
        </p>

        <button onClick={acknowledge} className="ds-btn sk-wide-btn">
          Спасибо, буду иметь в виду
        </button>
      </div>
    </div>
  );
}
