import { api } from '../../api';
import { YSQ_PROGRESS_KEY, YSQ_RESULT_KEY } from '../YSQTestSheet';
import { BottomSheet } from '../BottomSheet';

export function PrivacyOverlay({
  onClose,
  onCloseAfterYsqDelete,
}: {
  onClose: () => void;
  onCloseAfterYsqDelete: () => void;
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
            text: 'Дневник, оценки, заметки, практики, результаты тестов — всё привязано к Telegram-аккаунту и доступно с любого устройства.',
          },
          {
            title: 'Передача третьим лицам',
            text: 'Данные не продаются и не передаются рекламным сетям или третьим лицам. Никогда.',
          },
        ].map((block) => (
          <div
            key={block.title}
            style={{
              marginBottom: 12,
              background: 'rgba(var(--fg-rgb),0.04)',
              borderRadius: 12,
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
                api.deleteYsqResult().catch(() => {});
                onCloseAfterYsqDelete();
              }}
              style={{
                width: '100%',
                padding: '13px 0',
                borderRadius: 12,
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
          Разработано для образовательных целей. Не является медицинским или
          психологическим сервисом.
        </div>
      </div>
    </BottomSheet>
  );
}
