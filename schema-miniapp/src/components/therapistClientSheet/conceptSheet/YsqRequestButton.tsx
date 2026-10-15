import { TherapyClientSummary } from '../../../api';
import { isVirtualId } from '../../../../../shared/src/utils/sameId';
import { ClientDetail } from '../types';
import { cm } from '../../../sections/schemas/utils';
// Кнопка «Запросить тест на схемы» с ошибкой запроса. Вынесено из
// ConceptSheet.tsx (правило №10). Пока показано «✓ Запрос отправлен», кнопка
// заблокирована: раньше её можно было жать сколько угодно, и клиент получал
// серию одинаковых сообщений (аудит 2026-10). Виртуальному клиенту слать некуда.
export function YsqRequestButton({
  selectedClient,
  detail,
}: {
  selectedClient: TherapyClientSummary;
  detail: ClientDetail;
}) {
  const { ysqRequested, ysqError, handleRequestYsq } = detail;
  if (isVirtualId(selectedClient.telegramId)) return null;
  return (
    <div className="u-mb12">
      <button
        onClick={handleRequestYsq}
        disabled={ysqRequested}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 'var(--r-12)',
          border: `1px solid ${cm('var(--accent-blue)', 20)}`,
          background: cm('var(--accent-blue)', 6),
          color: ysqRequested
            ? 'var(--accent-green)'
            : cm('var(--accent-blue)', 80),
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        {ysqRequested ? '✓ Запрос отправлен' : 'Запросить тест на схемы'}
      </button>
      {ysqError && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--accent-red)',
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {ysqError}
        </div>
      )}
    </div>
  );
}
