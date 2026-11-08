import { useTr } from '../../utils/addressForm';

// «Письмо отправлено» (U6, аудит 2026-11): раньше здесь был только «Ввести
// другой email» — ни подсказки про «Спам», ни повторной отправки, и на «письмо
// не пришло» человек вводил тот же адрес заново. Пауза — useResendPause.
interface Props {
  sentCount: number;
  /** Секунд до «Отправить ещё раз»; 0 — можно. */
  left: number;
  loading: boolean;
  onResend: () => void;
  onOtherEmail: () => void;
}

const actionsSt: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', columnGap: 16 };

export function LoginEmailSent({ sentCount, left, loading, onResend, onOtherEmail }: Props) {
  const tr = useTr();
  return (
    <div className="al-email-sent">
      <p>{sentCount > 1 ? 'Письмо отправлено ещё раз' : 'Письмо отправлено'}</p>
      <p>{tr('Проверь почту и перейди по ссылке — она действует 30 минут', 'Проверьте почту и перейдите по ссылке — она действует 30 минут')}</p>
      <p>{tr('Письма нет? Проверь папку «Спам»', 'Письма нет? Проверьте папку «Спам»')}</p>
      <div style={actionsSt}>
        <button className="al-linkbtn" disabled={loading || left > 0} onClick={onResend}>
          {loading ? 'Отправляем…' : left > 0 ? `Отправить ещё раз через ${left} с` : 'Отправить ещё раз'}
        </button>
        <button className="al-linkbtn" onClick={onOtherEmail}>
          Ввести другой email
        </button>
      </div>
    </div>
  );
}
