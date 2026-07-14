import { DisclaimerCheckbox } from './DisclaimerCheckbox';

// Шаг 1 онбординга Disclaimer: данные и конфиденциальность. Перенесено из
// Disclaimer.tsx как есть (этап 3 REMEDIATION_PLAN) — без смены поведения.
export function DisclaimerPrivacyStep({
  c2,
  setC2,
}: {
  c2: boolean;
  setC2: (updater: (p: boolean) => boolean) => void;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 16,
        }}
      >
        Данные и конфиденциальность
      </div>
      <div
        className="card"
        style={{ borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'rgba(var(--fg-rgb),0.7)',
            lineHeight: 1.7,
            marginBottom: 16,
          }}
        >
          Все данные хранятся на защищённом сервере,{' '}
          <strong style={{ color: 'var(--text)' }}>зашифрованы</strong> и
          привязаны к Telegram-аккаунту. Не передаются третьим лицам — кроме
          терапевта, если позже подключить его по коду по собственному решению.
          <br />
          <br />
          Записи и ответы на опросники могут касаться психоэмоционального
          состояния — на обработку таких сведений даётся отдельное согласие
          ниже.
          <br />
          <br />
          Удалить все данные можно прямо в приложении — Настройки → «Удалить все
          данные». Сервис предназначен для пользователей старше 18 лет.
          <br />
          <br />
          <a
            href="https://schemehappens.ru/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Политика конфиденциальности →
          </a>
        </div>
        <DisclaimerCheckbox
          checked={c2}
          onToggle={() => setC2((p) => !p)}
          label="Мне есть 18 лет, и я согласен(на) на обработку персональных данных — включая сведения о моём психоэмоциональном состоянии, которые я добровольно вношу, — согласно Политике конфиденциальности"
        />
      </div>
    </div>
  );
}
