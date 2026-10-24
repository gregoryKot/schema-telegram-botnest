import { useState } from 'react';
import { api } from '../../api';
import { authedFetch } from '../../apiClient';
import { useTr } from '../../utils/addressForm';
import { SSection, SRow, InfoModal } from './ui';
import { YsqDataDeleteButton } from './YsqDataDeleteButton';
import { hasLocalYsqData } from '../../../../shared/src/hooks/ysqDataDelete';
import { privacyStorageText, PRIVACY_NO_SHARE_TEXT } from '../../../../shared/src/settings/privacyText';
import { useDataExport } from '../../../../shared/src/account/useDataExport';
import { DeleteAccountConfirm } from '../../../../shared/src/components/DeleteAccountConfirm';

// Раздел «Данные» (конфиденциальность + полное удаление аккаунта) — вынесен
// из SettingsSheet.tsx (правило №10). Состояние обеих модалок полностью
// локально: снаружи оно нигде больше не используется.
export function DataSection() {
  const tr = useTr();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]     = useState(false); const [deleteError, setDeleteError] = useState(false); // отказ раньше не был виден
  const dataExport = useDataExport({ authedFetch });

  return (
    <>
      <SSection id="s-data" label="Данные">
      <SRow title="Конфиденциальность" sub="Что и как хранится" onClick={() => setShowPrivacy(true)} />
      <SRow
        title={dataExport.status === 'loading' ? 'Собираю…' : 'Скачать мои данные'}
        sub={tr(
          'Дневники, оценки, заметки, настройки — всё, что храним, соберётся в файл. Скачай, если хочешь сохранить копию себе или показать терапевту',
          'Дневники, оценки, заметки, настройки — всё, что храним, соберётся в файл. Скачайте, если хотите сохранить копию себе или показать терапевту',
        )}
        onClick={dataExport.status === 'loading' ? undefined : () => void dataExport.exportData()}
      />
      {dataExport.status === 'done' && (
        <div role="status" className="st-text st-text--faint">
          {tr('Файл ушёл в загрузки. Если его там нет — открой schemehappens.ru в браузере и попробуй оттуда', 'Файл ушёл в загрузки. Если его там нет — откройте schemehappens.ru в браузере и попробуйте оттуда')}
        </div>
      )}
      {dataExport.status === 'error' && (
        <div role="alert" className="st-err">
          {tr('Не удалось скачать файл. Проверь связь и попробуй ещё раз', 'Не удалось скачать файл. Проверьте связь и попробуйте ещё раз')}
        </div>
      )}
      {dataExport.status === 'unsupported' && (
        <div role="alert" className="st-text st-text--faint">
          {tr('Тут скачать не получится — открой schemehappens.ru в браузере и попробуй там', 'Тут скачать не получится — откройте schemehappens.ru в браузере и попробуйте там')}
        </div>
      )}
      <SRow title="Удалить все данные" danger onClick={() => { setDeleteConfirm(false); setDeleteError(false); setShowDeleteSheet(true); }} />
      </SSection>

      {/* ── Privacy modal ── */}
      {showPrivacy && (
        <InfoModal onClose={() => setShowPrivacy(false)}>
          <h2 className="dialog-title st-modal-title">Данные и конфиденциальность</h2>
          {[
            { title: 'Что хранится', text: privacyStorageText('аккаунту') },
            { title: 'Передача третьим лицам', text: PRIVACY_NO_SHARE_TEXT },
          ].map(b => (
            <div key={b.title} className="st-info">
              <b>{b.title}</b>
              <div className="st-text">{b.text}</div>
            </div>
          ))}
          {/* Всё про тест — итог, история, прогресс — после подтверждения (решение владельца 2026-10-22). */}
          {hasLocalYsqData() && <YsqDataDeleteButton onDeleted={() => setShowPrivacy(false)} />}
          <div className="st-fine st-center">Это образовательный инструмент.</div>
        </InfoModal>
      )}

      {/* ── Delete modal ── */}
      {showDeleteSheet && (
        <InfoModal onClose={() => { setShowDeleteSheet(false); setDeleteConfirm(false); }}>
          <h2 className="dialog-title st-modal-title--danger">Удалить все данные</h2>
          <div className="st-text st-mb20">
            Дневники, оценки, практики, тесты, заметки, задания — всё удалится с сервера. Необратимо.
          </div>
          {deleteError && !deleteConfirm && <div className="st-err st-center st-mb10">{tr('Не удалось удалить данные. Проверь связь и попробуй ещё раз', 'Не удалось удалить данные. Проверьте связь и попробуйте ещё раз')}</div>}
          {!deleteConfirm ? (
            <div className="st-modal-actions">
              <button className="ds-btn ds-btn--secondary" onClick={() => setShowDeleteSheet(false)}>Отмена</button>
              <button className="ds-btn ds-btn--secondary st-btn-danger" onClick={() => setDeleteConfirm(true)}>Удалить</button>
            </div>
          ) : (
            <DeleteAccountConfirm tr={tr} deleting={deleting} setDeleting={setDeleting} deleteAllUserData={api.deleteAllUserData}
              onFailed={() => { setDeleteConfirm(false); setDeleteError(true); }}
              onDeleted={() => { const t = localStorage.getItem('app_theme'); const cc = localStorage.getItem('cookie_consent'); localStorage.clear(); sessionStorage.clear(); if (t) localStorage.setItem('app_theme', t); if (cc) localStorage.setItem('cookie_consent', cc); window.location.reload(); }} />
          )}
        </InfoModal>
      )}
    </>
  );
}
