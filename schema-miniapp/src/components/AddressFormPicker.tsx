import { api, reportClientError } from '../api';
import { useSetAddressForm } from '../utils/addressForm';
import { useAddressFormChoice } from '../../../shared/src/settings/useAddressFormChoice';

interface Props {
  onDone: (form: 'ty' | 'vy' | null) => void;
}

/**
 * Выбор обращения («ты»/«вы») при первом входе — пока addressForm в настройках null.
 * «Позже» = мягкий пропуск: остаётся «ты» по умолчанию, спросим в следующей сессии
 * (не блокируем вход).
 *
 * Сохранение выбора — через общий shared/src/settings/useAddressFormChoice.ts
 * (правило №3): при отказе api.updateSettings лист НЕ закрывается — иначе
 * человек видит выбранную форму применённой, а на деле она не долетела до
 * сервера и на следующей сессии перезатрётся обратно на дефолтную (инцидент,
 * см. комментарий в useAddressFormChoice.ts).
 */
export function AddressFormPicker({ onDone }: Props) {
  const setForm = useSetAddressForm();
  const { failed, choose } = useAddressFormChoice(
    setForm,
    api.updateSettings,
    reportClientError,
    onDone,
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px calc(24px + var(--safe-bottom))',
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          Как удобнее общаться?
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 18,
          }}
        >
          Поменять можно в любой момент в настройках.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button
            onClick={() => choose('ty')}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            На «ты»
          </button>
          <button
            onClick={() => choose('vy')}
            style={{
              flex: 1,
              padding: '14px 0',
              borderRadius: 14,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            На «вы»
          </button>
        </div>
        {failed && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--danger, #e5484d)',
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            Не удалось сохранить выбор. Проверить соединение и попробовать ещё
            раз — или «Позже».
          </div>
        )}
        <button
          onClick={() => onDone(null)}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 12,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-faint)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Позже
        </button>
      </div>
    </div>
  );
}
