import { useState } from 'react';
import { api } from '../../api';
import { useTr } from '../../utils/addressForm';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../../utils/storageKeys';
import { SHead, SRow, InfoModal } from './ui';
import { privacyStorageText, PRIVACY_NO_SHARE_TEXT } from '../../../../shared/src/settings/privacyText';

// Раздел «Данные» (конфиденциальность + полное удаление аккаунта) — вынесен
// из SettingsSheet.tsx (правило №10). Состояние обеих модалок полностью
// локально: снаружи оно нигде больше не используется.
export function DataSection() {
  const tr = useTr();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [ysqDeleting, setYsqDeleting] = useState(false); const [ysqDeleteError, setYsqDeleteError] = useState(false); // раньше локально стиралось раньше запроса к серверу
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false); const [deleteError, setDeleteError] = useState(false); // отказ раньше не был виден

  return (
    <>
      <SHead id="s-data" label="Данные" />
      <SRow title="Конфиденциальность" sub="Что и как хранится" onClick={() => setShowPrivacy(true)} />
      <SRow title="Удалить все данные" danger onClick={() => { setDeleteConfirm(false); setDeleteError(false); setShowDeleteSheet(true); }} />

      {/* ── Privacy modal ── */}
      {showPrivacy && (
        <InfoModal onClose={() => setShowPrivacy(false)}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Данные и конфиденциальность</div>
          {[
            { title: 'Что хранится', text: privacyStorageText('аккаунту') },
            { title: 'Передача третьим лицам', text: PRIVACY_NO_SHARE_TEXT },
          ].map(b => (
            <div key={b.title} style={{ marginBottom: 10, background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 'var(--r-8)', padding: '12px 14px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{b.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}>{b.text}</div>
            </div>
          ))}
          {(!!localStorage.getItem(YSQ_PROGRESS_KEY) || !!localStorage.getItem(YSQ_RESULT_KEY)) && (<>
            {/* Раньше localStorage чистился ДО ответа сервера — при отказе api
                пользователь видел «удалено», хотя результаты теста оставались
                на сервере (приватность). Теперь локально чистим только после
                подтверждённого удаления. */}
            <button disabled={ysqDeleting} onClick={async () => {
              setYsqDeleting(true); setYsqDeleteError(false);
              try {
                await api.deleteYsqResult();
                localStorage.removeItem(YSQ_PROGRESS_KEY); localStorage.removeItem(YSQ_RESULT_KEY);
                setShowPrivacy(false);
              } catch { setYsqDeleteError(true); } finally { setYsqDeleting(false); }
            }}
              style={{ width: '100%', padding: '12px 0', borderRadius: 'var(--r-8)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--accent-red)', fontSize: 13, fontWeight: 500, cursor: ysqDeleting ? 'default' : 'pointer', marginBottom: 10, fontFamily: 'inherit' }}>
              {ysqDeleting ? 'Удаляю...' : 'Удалить результаты теста'}
            </button>
            {ysqDeleteError && <div role="alert" style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: -4, marginBottom: 10 }}>{tr('Не удалось удалить. Попробуй ещё раз', 'Не удалось удалить. Попробуйте ещё раз')}</div>}
          </>)}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6, textAlign: 'center' }}>Это образовательный инструмент.</div>
        </InfoModal>
      )}

      {/* ── Delete modal ── */}
      {showDeleteSheet && (
        <InfoModal onClose={() => { setShowDeleteSheet(false); setDeleteConfirm(false); }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-red)', marginBottom: 8 }}>Удалить все данные</div>
          <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: 20 }}>
            Дневники, оценки, практики, тесты, заметки, задания — всё удалится с сервера. Необратимо.
          </div>
          {deleteError && !deleteConfirm && <div style={{ fontSize: 12, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 12 }}>{tr('Не удалось удалить данные. Проверь связь и попробуй ещё раз', 'Не удалось удалить данные. Проверьте связь и попробуйте ещё раз')}</div>}
          {!deleteConfirm ? (
            <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
              <button onClick={() => setShowDeleteSheet(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-10)', border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Отмена</button>
              <button onClick={() => setDeleteConfirm(true)} style={{ flex: 1, padding: '12px 0', borderRadius: 'var(--r-10)', border: 'none', background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Удалить</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 14, color: 'var(--accent-red)', textAlign: 'center', marginBottom: 16, fontWeight: 500 }}>Точно? Восстановить невозможно.</div>
              <button disabled={deleting} onClick={async () => {
                setDeleting(true); setDeleteError(false);
                try { await api.deleteAllUserData(); const t = localStorage.getItem('app_theme'); const cc = localStorage.getItem('cookie_consent'); localStorage.clear(); sessionStorage.clear(); if (t) localStorage.setItem('app_theme', t); if (cc) localStorage.setItem('cookie_consent', cc); window.location.reload(); }
                catch { setDeleting(false); setDeleteConfirm(false); setDeleteError(true); }
              }} style={{ width: '100%', padding: '13px 0', borderRadius: 'var(--r-10)', border: 'none', background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700, cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {deleting ? 'Удаляем...' : 'Да, удалить всё навсегда'}
              </button>
            </div>
          )}
        </InfoModal>
      )}
    </>
  );
}
