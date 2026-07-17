import { api } from '../../api';
import { BottomSheet } from '../BottomSheet';

export function DeleteOverlay({
  onClose,
  onCancel,
  deleteConfirm,
  setDeleteConfirm,
  deleting,
  setDeleting,
}: {
  onClose: () => void;
  onCancel: () => void;
  deleteConfirm: boolean;
  setDeleteConfirm: (v: boolean) => void;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--accent-red)',
            marginBottom: 8,
          }}
        >
          Удалить все данные
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          Дневники, оценки, практики, колесо детства, результаты тестов,
          заметки, задания, связи с терапевтом — всё удалится с сервера. Это
          действие необратимо.
        </div>
        {!deleteConfirm ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                border: '1px solid rgba(var(--fg-rgb),0.1)',
                background: 'transparent',
                color: 'var(--text-sub)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={() => setDeleteConfirm(true)}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                background: 'rgba(239,68,68,0.15)',
                color: 'var(--accent-red)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Удалить
            </button>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--accent-red)',
                textAlign: 'center',
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              Точно? Восстановить невозможно.
            </div>
            <button
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  await api.deleteAllUserData();
                  const theme = localStorage.getItem('app_theme');
                  localStorage.clear();
                  sessionStorage.clear();
                  if (theme) localStorage.setItem('app_theme', theme);
                  window.location.reload();
                } catch {
                  setDeleting(false);
                  setDeleteConfirm(false);
                }
              }}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                background: '#ef4444',
                color: 'var(--text)',
                fontSize: 15,
                fontWeight: 700,
                cursor: deleting ? 'default' : 'pointer',
              }}
            >
              {deleting ? 'Удаляем...' : 'Да, удалить всё навсегда'}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
