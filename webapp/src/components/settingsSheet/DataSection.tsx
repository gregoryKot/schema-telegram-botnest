import { useState } from 'react';
import { authedFetch } from '../../apiClient';
import { useTr } from '../../utils/addressForm';
import { SSection, SRow, InfoModal } from './ui';
import { YsqDataDeleteButton } from './YsqDataDeleteButton';
import { privacyStorageText, PRIVACY_NO_SHARE_TEXT } from '../../../../shared/src/settings/privacyText';
import { useDataExport } from '../../../../shared/src/account/useDataExport';
import { deleteAccountCopy } from '../../../../shared/src/account/accountDeletion';
import { DeleteAccountDialog } from '../DeleteAccountDialog';
import { ResignTherapistBlock } from './ResignTherapistBlock';

// Раздел «Данные» (конфиденциальность + удаление аккаунта) — вынесен из
// SettingsSheet.tsx (правило №10). Удаление — тот же диалог, что в «Профиле»
// (QA 2026-11, К2): строка называет действие честно — уходит аккаунт целиком.
export function DataSection({ onResign }: { onResign?: () => Promise<void> | void }) {
  const tr = useTr();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const deleteCopy = deleteAccountCopy(tr);
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
          {tr('Не удалось скачать файл. Проверь связь и попробуй ещё раз.', 'Не удалось скачать файл. Проверьте связь и попробуйте ещё раз.')}
        </div>
      )}
      {dataExport.status === 'unsupported' && (
        <div role="alert" className="st-text st-text--faint">
          {tr('Тут скачать не получится — открой schemehappens.ru в браузере и попробуй там', 'Тут скачать не получится — откройте schemehappens.ru в браузере и попробуйте там')}
        </div>
      )}
      {onResign && <ResignTherapistBlock onResign={onResign} />}
      <SRow title={deleteCopy.row} sub={deleteCopy.rowSub} danger onClick={() => setShowDelete(true)} />
      </SSection>

      {/* ── Privacy modal ── */}
      {showPrivacy && (
        <InfoModal title="Данные и конфиденциальность" onClose={() => setShowPrivacy(false)}>
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
          <YsqDataDeleteButton onDeleted={() => setShowPrivacy(false)} />
          <div className="st-fine st-center">Это образовательный инструмент.</div>
        </InfoModal>
      )}

      {showDelete && <DeleteAccountDialog onClose={() => setShowDelete(false)} />}
    </>
  );
}
