import { ConsentCheckLabel } from '../../components/ConsentCheckLabel';
import { useTr } from '../../utils/addressForm';

// Согласие на обработку ПДн (152-ФЗ, ст. 9) даётся отдельной непредзаполненной галочкой ДО кнопок
// входа; пока она не стоит, кнопки неактивны. Политика и 18+/«не диагноз» в галочку не входят —
// они в строке под кнопками (`LoginConsentNote`). Отметка уходит на сервер уже после входа:
// `auth/loginConsent` + `useConsentGate`.
export function LoginConsentCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const tr = useTr();
  return (
    <div className="al-consent" data-testid="login-consent-check">
      <label className="al-check">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <ConsentCheckLabel />
      </label>
      {!checked && <p className="al-note" role="status">{tr('Чтобы войти, отметь согласие', 'Чтобы войти, отметьте согласие')}</p>}
    </div>
  );
}

export function LoginConsentNote() {
  const tr = useTr();
  return (
    <p className="al-note" data-testid="login-consent-note">
      {tr(
        'Нажимая «Войти», ты подтверждаешь, что тебе есть 18 лет, и понимаешь, что сервис не ставит диагноз. ',
        'Нажимая «Войти», вы подтверждаете, что вам есть 18 лет, и понимаете, что сервис не ставит диагноз. ',
      )}
      <a href="/privacy" target="_blank" rel="noopener noreferrer">Политика конфиденциальности</a>
    </p>
  );
}
