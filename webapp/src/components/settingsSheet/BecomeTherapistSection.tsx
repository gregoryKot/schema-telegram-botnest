import { useState, useEffect } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { SSection } from './ui';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import * as LIM from '../../../../shared/src/limits/textLimits';
import { TherapistRequestRejectedNote } from '../../../../shared/src/therapy/TherapistRequestRejectedNote';

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
    <SSection id="s-specialist" label="Стать специалистом">
      <div className="st-body-block">
        {therapistReq?.status === 'pending' ? (
          <div className="st-text">
            Заявка на рассмотрении. Решение появится здесь.
          </div>
        ) : therapistReq?.status === 'approved' ? (
          <div className="st-text st-text--ok">
            {tr('Заявка одобрена. Перезайди в приложение, чтобы появился кабинет терапевта.', 'Заявка одобрена. Перезайдите в приложение, чтобы появился кабинет терапевта.')}
          </div>
        ) : !showReqForm ? (
          <div>
            <TherapistRequestRejectedNote request={therapistReq} className="st-err" />
            <p className="st-text">
              {tr('Если ты практикующий специалист — подай заявку. Администратор проверит и откроет доступ к кабинету.', 'Если вы практикующий специалист — подайте заявку. Администратор проверит и откроет доступ к кабинету.')}
            </p>
            <button className="ds-btn ds-btn--sm ds-btn--secondary" onClick={() => setShowReqForm(true)}>
              Я психолог — подать заявку
            </button>
          </div>
        ) : (
          <div className="st-form">
            <input value={reqFullName} onChange={e => setReqFullName(e.target.value)} placeholder="ФИО" maxLength={LIM.THERAPIST_REQUEST_NAME_MAX} className="ds-input" />
            <LimitedTextarea max={LIM.THERAPIST_REQUEST_QUAL_MAX} value={reqQual} onChange={e => setReqQual(e.target.value)} rows={3} placeholder="Квалификация: образование, направление, опыт, сертификаты" className="ds-textarea" />
            <input value={reqContacts} onChange={e => setReqContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д." maxLength={LIM.THERAPIST_REQUEST_CONTACTS_MAX} className="ds-input" />
            <LimitedTextarea max={LIM.THERAPIST_REQUEST_MESSAGE_MAX} value={reqMsg} onChange={e => setReqMsg(e.target.value)} rows={2} placeholder="Сообщение (необязательно)" className="ds-textarea" />
            {reqError && <div className="st-err">{reqError}</div>}
            <div className="st-modal-actions">
              <button className="ds-btn ds-btn--secondary" onClick={() => { setShowReqForm(false); setReqError(''); }}>
                Отмена
              </button>
              <button className="ds-btn ds-btn--accent" style={{ flex: 2 }} disabled={reqBusy} onClick={submitTherapistRequest}>
                {reqBusy ? 'Отправляю...' : 'Отправить заявку'}
              </button>
            </div>
          </div>
        )}
      </div>
    </SSection>
  );
}
