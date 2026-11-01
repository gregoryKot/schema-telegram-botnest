import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { FIELD_STYLE } from './fieldStyle';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import {
  THERAPIST_REQUEST_CONTACTS_MAX,
  THERAPIST_REQUEST_MESSAGE_MAX,
  THERAPIST_REQUEST_NAME_MAX,
  THERAPIST_REQUEST_QUAL_MAX,
} from '../../../../shared/src/limits/textLimits';
import { TherapistRequestRejectedNote } from '../../../../shared/src/therapy/TherapistRequestRejectedNote';

type TherapistReq = { id: number; status: string; rejectReason: string | null };

interface Props {
  therapistReq: TherapistReq | null | undefined;
  setTherapistReq: (v: TherapistReq | null) => void;
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
}

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
}: Props) {
  const tr = useTr();

  async function handleSubmitRequest() {
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
      // Показываем реальную причину (парность с webapp): «Request already
      // pending», лимит и т.п. — иначе ошибка выглядит необъяснимой.
      setReqError(
        String(e).replace('Error: ', '') ||
          tr('Ошибка. Попробуй ещё раз.', 'Ошибка. Попробуйте ещё раз.'),
      );
    } finally {
      setReqBusy(false);
    }
  }

  return (
    <div className="u-mb8">
      <TherapistRequestRejectedNote request={therapistReq} className="u-mb8" />
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
          <div className="u-sub12-lh15">
            Сообщим о решении в Telegram, на почту или по контактам из заявки.
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
          <div className="u-sub12">
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
          Я психолог — подать заявку
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
            Сообщим о решении в Telegram, на почту или по контактам из заявки
          </div>
          {[
            {
              label: 'Имя и фамилия',
              val: reqFullName,
              set: setReqFullName,
              placeholder: 'Мария Иванова',
              max: THERAPIST_REQUEST_NAME_MAX,
            },
            {
              label: 'Квалификация',
              val: reqQual,
              set: setReqQual,
              placeholder: 'Психолог, схема-терапия и КПТ, 5 лет практики',
              max: THERAPIST_REQUEST_QUAL_MAX,
            },
            {
              label: 'Контакты',
              val: reqContacts,
              set: setReqContacts,
              placeholder: '@telegram или email',
              max: THERAPIST_REQUEST_CONTACTS_MAX,
            },
          ].map(({ label, val, set, placeholder, max }) => (
            <div key={label} className="u-mb10">
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
                maxLength={max}
                style={FIELD_STYLE}
              />
            </div>
          ))}
          <div className="u-mb14">
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-sub)',
                marginBottom: 4,
              }}
            >
              Сообщение (необязательно)
            </div>
            <LimitedTextarea
              max={THERAPIST_REQUEST_MESSAGE_MAX}
              value={reqMsg}
              onChange={(e) => setReqMsg(e.target.value)}
              placeholder={tr(
                'Расскажи о себе или своём подходе',
                'Расскажите о себе или своём подходе',
              )}
              rows={3}
              style={{ ...FIELD_STYLE, resize: 'none', fontFamily: 'inherit' }}
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
              onClick={handleSubmitRequest}
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: 'var(--on-accent)',
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
