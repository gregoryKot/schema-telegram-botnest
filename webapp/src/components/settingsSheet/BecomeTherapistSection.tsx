import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { SHead } from './ui';
import { inputStyle } from './inputStyle';

// Раздел «Стать специалистом» — вынесен из SettingsSheet.tsx (правило №10,
// файл-должник, пофайловый храповик размера). Состояние заявки полностью
// локально: снаружи оно нигде больше не используется (в отличие от
// мини-аппа, где секция принимает всё пропсами — здесь проп-дриллинг не
// нужен, родителю сама заявка не важна).
export function BecomeTherapistSection() {
  const tr = useTr();
  const [therapistReq, setTherapistReq] = useState<{ status: string; rejectReason: string | null } | null | undefined>(undefined);
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqFullName, setReqFullName] = useState('');
  const [reqQual, setReqQual] = useState('');
  const [reqContacts, setReqContacts] = useState('');
  const [reqMsg, setReqMsg] = useState('');
  const [reqBusy, setReqBusy] = useState(false);
  const [reqError, setReqError] = useState('');

  useEffect(() => {
    api.getTherapistRequest().then(r => setTherapistReq(r)).catch(() => setTherapistReq(null));
  }, []);

  async function submitTherapistRequest() {
    setReqError('');
    if (!reqFullName.trim() || !reqQual.trim() || !reqContacts.trim()) {
      setReqError(
        tr(
          'Заполни ФИО, квалификацию и контакты',
          'Заполните ФИО, квалификацию и контакты',
        ),
      );
      return;
    }
    setReqBusy(true);
    try {
      await api.submitTherapistRequest({ fullName: reqFullName.trim(), qualification: reqQual.trim(), contacts: reqContacts.trim(), message: reqMsg.trim() || undefined });
      setTherapistReq({ status: 'pending', rejectReason: null });
      setShowReqForm(false);
    } catch (e) { setReqError(String(e).replace('Error: ', '')); }
    finally { setReqBusy(false); }
  }

  return (
    <>
      <SHead id="s-specialist" label="Стать специалистом" />
      <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.06)' }}>
        {therapistReq?.status === 'pending' ? (
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>
            Заявка на рассмотрении. Когда администратор одобрит — придёт уведомление в Telegram.
          </div>
        ) : therapistReq?.status === 'approved' ? (
          <div style={{ fontSize: 13, color: 'var(--accent-green)', lineHeight: 1.6 }}>
            {tr('Заявка одобрена. Перезайди в приложение, чтобы появился кабинет терапевта.', 'Заявка одобрена. Перезайдите в приложение, чтобы появился кабинет терапевта.')}
          </div>
        ) : !showReqForm ? (
          <div>
            {therapistReq?.status === 'rejected' && (
              <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 12 }}>
                Заявка отклонена{therapistReq.rejectReason ? `: ${therapistReq.rejectReason}` : ''}. {tr('Можешь подать снова.', 'Можете подать снова.')}
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, margin: '0 0 12px' }}>
              {tr('Если ты практикующий специалист — подай заявку. Администратор проверит и откроет доступ к кабинету.', 'Если вы практикующий специалист — подайте заявку. Администратор проверит и откроет доступ к кабинету.')}
            </p>
            <button onClick={() => setShowReqForm(true)}
              style={{ background: 'none', border: '1px solid rgba(var(--fg-rgb),0.15)', borderRadius: 7, padding: '7px 14px', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Подать заявку
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
            <input value={reqFullName} onChange={e => setReqFullName(e.target.value)} placeholder="ФИО" style={inputStyle} />
            <textarea value={reqQual} onChange={e => setReqQual(e.target.value)} rows={3}
              placeholder="Квалификация: образование, направление, опыт, сертификаты"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            <input value={reqContacts} onChange={e => setReqContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д." style={inputStyle} />
            <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={2}
              placeholder="Сообщение (необязательно)"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            {reqError && <div style={{ fontSize: 12, color: 'var(--accent-red)' }}>{reqError}</div>}
            <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
              <button onClick={() => { setShowReqForm(false); setReqError(''); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 7, border: '1px solid rgba(var(--fg-rgb),0.12)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Отмена
              </button>
              <button disabled={reqBusy} onClick={submitTherapistRequest}
                style={{ flex: 2, padding: '10px 0', borderRadius: 7, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: reqBusy ? 'default' : 'pointer', opacity: reqBusy ? 0.7 : 1, fontFamily: 'inherit' }}>
                {reqBusy ? 'Отправляю...' : 'Отправить заявку'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
