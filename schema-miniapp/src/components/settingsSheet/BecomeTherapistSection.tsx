// Секция «Стать терапевтом» — статус заявки + форма подачи (CLIENT-view).
// Вынесено из SettingsSheet.tsx.
import { api } from '../../api';

type Req = { id: number; status: string; rejectReason: string | null };

export function BecomeTherapistSection({
  therapistReq,
  setTherapistReq,
  showReqForm,
  setShowReqForm,
  reqFullName,
  setReqFullName,
  reqQual,
  setReqQual,
  reqContacts,
  setReqContacts,
  reqMsg,
  setReqMsg,
  reqBusy,
  setReqBusy,
  reqError,
  setReqError,
}: {
  therapistReq: Req | null | undefined;
  setTherapistReq: (v: Req | null) => void;
  showReqForm: boolean;
  setShowReqForm: (v: boolean) => void;
  reqFullName: string;
  setReqFullName: (v: string) => void;
  reqQual: string;
  setReqQual: (v: string) => void;
  reqContacts: string;
  setReqContacts: (v: string) => void;
  reqMsg: string;
  setReqMsg: (v: string) => void;
  reqBusy: boolean;
  setReqBusy: (v: boolean) => void;
  reqError: string;
  setReqError: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      {therapistReq === undefined ? null : therapistReq?.status ===
        'pending' ? (
        <div className="card" style={{ borderRadius: 16, padding: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-yellow)',
              marginBottom: 4,
            }}
          >
            Заявка отправлена
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              lineHeight: 1.5,
            }}
          >
            Рассмотрим в течение нескольких дней и напишем в боте.
          </div>
        </div>
      ) : therapistReq?.status === 'approved' ? (
        <div className="card" style={{ borderRadius: 16, padding: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-green)',
              marginBottom: 4,
            }}
          >
            ✓ Заявка одобрена
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
            Обновите страницу, чтобы войти как специалист.
          </div>
        </div>
      ) : !showReqForm ? (
        <button
          onClick={() => setShowReqForm(true)}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 14,
            border:
              '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
            color: 'var(--accent)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>👨‍⚕️</span> Я психолог — подать заявку
        </button>
      ) : (
        <div className="card" style={{ borderRadius: 16, padding: 16 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 4,
            }}
          >
            Заявка специалиста
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            Рассмотрим заявку и напишем в боте
          </div>
          {[
            {
              label: 'Имя и фамилия',
              val: reqFullName,
              set: setReqFullName,
              placeholder: 'Мария Иванова',
            },
            {
              label: 'Квалификация',
              val: reqQual,
              set: setReqQual,
              placeholder: 'Схема-терапевт, КПТ, 5 лет практики',
            },
            {
              label: 'Контакты',
              val: reqContacts,
              set: setReqContacts,
              placeholder: '@telegram или email',
            },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-sub)',
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <input
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={placeholder}
                style={{
                  width: '100%',
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: '1px solid rgba(var(--fg-rgb),0.12)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginBottom: 4,
              }}
            >
              Сообщение (необязательно)
            </div>
            <textarea
              value={reqMsg}
              onChange={(e) => setReqMsg(e.target.value)}
              placeholder="Расскажи о себе или своём подходе"
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(var(--fg-rgb),0.06)',
                border: '1px solid rgba(var(--fg-rgb),0.12)',
                borderRadius: 10,
                padding: '9px 12px',
                color: 'var(--text)',
                fontSize: 13,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {reqError && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--accent-red)',
                marginBottom: 10,
              }}
            >
              {reqError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                setShowReqForm(false);
                setReqError('');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'transparent',
                color: 'var(--text-sub)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              disabled={
                reqBusy ||
                !reqFullName.trim() ||
                !reqQual.trim() ||
                !reqContacts.trim()
              }
              onClick={async () => {
                setReqBusy(true);
                setReqError('');
                try {
                  await api.submitTherapistRequest({
                    fullName: reqFullName.trim(),
                    qualification: reqQual.trim(),
                    contacts: reqContacts.trim(),
                    message: reqMsg.trim() || undefined,
                  });
                  const req = await api.getTherapistRequest();
                  setTherapistReq(req);
                  setShowReqForm(false);
                } catch (e) {
                  // Показываем реальную причину (парность с webapp):
                  // «Request already pending», лимит и т.п. — иначе
                  // ошибка выглядит необъяснимой.
                  setReqError(
                    String(e).replace('Error: ', '') ||
                      'Ошибка. Попробуй ещё раз.',
                  );
                } finally {
                  setReqBusy(false);
                }
              }}
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                opacity:
                  !reqFullName.trim() || !reqQual.trim() || !reqContacts.trim()
                    ? 0.5
                    : 1,
              }}
            >
              {reqBusy ? '...' : 'Отправить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
