import { api } from '../../api';
import { logErr } from '../../utils/logErr';
import { BottomSheet } from '../BottomSheet';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../YSQTestSheet';
import {
  privacyStorageText,
  PRIVACY_NO_SHARE_TEXT,
} from '../../../../shared/src/settings/privacyText';

// 3 состояния кнопки «Скопировать» (copied/failed/idle) — индекс вместо копипасты ternary.
const FG = ['#06d6a0', 'var(--accent-red)', 'rgba(var(--fg-rgb),0.7)'];
const LABEL = ['✓ Скопировано', 'Не получилось', 'Скопировать'];

export function ExportOverlay({
  exportText,
  exportCopied,
  exportFailed,
  onCopy,
  onClose,
}: {
  exportText: string;
  exportCopied: boolean;
  exportFailed: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const st = exportCopied ? 0 : exportFailed ? 1 : 2;
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          Сводка для терапевта
        </div>
        <pre
          style={{
            fontSize: 11,
            color: 'var(--text-sub)',
            lineHeight: 1.6,
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 'var(--r-12)',
            padding: '12px 14px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginBottom: 14,
            userSelect: 'all',
            fontFamily: 'monospace',
          }}
        >
          {exportText}
        </pre>
        <button
          onClick={onCopy}
          style={{
            width: '100%',
            padding: '13px 0',
            border: 'none',
            borderRadius: 'var(--r-12)',
            background: exportCopied
              ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
              : 'rgba(var(--fg-rgb),0.08)',
            color: FG[st],
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {LABEL[st]}
        </button>
      </div>
    </BottomSheet>
  );
}

export function PrivacyOverlay({
  onClose,
  onDeletedYsq,
}: {
  onClose: () => void;
  onDeletedYsq: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          Данные и конфиденциальность
        </div>
        {[
          {
            title: 'Что хранится на сервере',
            text: privacyStorageText('Telegram-аккаунту'),
          },
          {
            title: 'Передача третьим лицам',
            text: PRIVACY_NO_SHARE_TEXT,
          },
        ].map((block) => (
          <div
            key={block.title}
            style={{
              marginBottom: 12,
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 'var(--r-12)',
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(var(--fg-rgb),0.8)',
                marginBottom: 6,
              }}
            >
              {block.title}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
              }}
            >
              {block.text}
            </div>
          </div>
        ))}

        {(!!localStorage.getItem(YSQ_PROGRESS_KEY) ||
          !!localStorage.getItem(YSQ_RESULT_KEY)) && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(var(--fg-rgb),0.8)',
                marginBottom: 10,
              }}
            >
              Удалить данные теста
            </div>
            <button
              onClick={() => {
                localStorage.removeItem(YSQ_PROGRESS_KEY);
                localStorage.removeItem(YSQ_RESULT_KEY);
                api.deleteYsqResult().catch(logErr('deleteYsq'));
                onDeletedYsq();
              }}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 'var(--r-12)',
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'rgba(239,68,68,0.08)',
                color: 'var(--accent-red)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Удалить результаты теста
            </button>
          </div>
        )}

        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          Это образовательный инструмент — не медицинский и не психологический
          сервис.
        </div>
      </div>
    </BottomSheet>
  );
}

export function DeleteOverlay({
  deleteConfirm,
  setDeleteConfirm,
  deleting,
  setDeleting,
  onBackdropClose,
  onCancel,
}: {
  deleteConfirm: boolean;
  setDeleteConfirm: (v: boolean) => void;
  deleting: boolean;
  setDeleting: (v: boolean) => void;
  onBackdropClose: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet onClose={onBackdropClose} zIndex={300}>
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
          <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '14px 0',
                borderRadius: 'var(--r-14)',
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
                borderRadius: 'var(--r-14)',
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
                borderRadius: 'var(--r-14)',
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
