import { hueStyle } from '../../lib/tone';

// Шапка экрана 2FA. Показывается до входа: обращения к читателю в тексте нет.
export function TwoFactorIntro() {
  return (
    <>
      <div className="al-2fa-mark tone-tint" style={hueStyle(240)}>2</div>
      <div className="ds-eyebrow">Двухфакторная проверка</div>
      <h1 className="al-2fa-title">Код из приложения-аутентификатора</h1>
      <p className="al-sub">
        Понадобится код из приложения-аутентификатора (Google Authenticator, 1Password, Bitwarden и т.п.) — 6 цифр.
        Подойдёт и один из recovery-кодов, если доступ к телефону потерян.
      </p>
    </>
  );
}
