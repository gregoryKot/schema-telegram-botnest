import { useState, useEffect, useCallback } from 'react';
import { api, PracticePlan } from '../api';
import { SkeletonList } from './Skeleton';
import { LoadErrorBanner } from './LoadErrorBanner';
import { PlanCard } from './PlanCard';
import { useSafeTop } from '../utils/safezone';
import { useTr } from '../utils/addressForm';
import { hitboxStyle } from '../utils/hitbox';

interface Props {
  onClose: () => void;
  onOpenTracker?: () => void;
}

export function PlansScreen({ onClose, onOpenTracker }: Props) {
  const tr = useTr();
  const safeTop = useSafeTop();
  const [plans, setPlans] = useState<PracticePlan[] | null>(null);
  // Сбой ≠ пусто (зеркало webapp-фикса #369): раньше .catch(() => setPlans([]))
  // рисовал «Планов пока нет» человеку, у которого планы есть, просто запрос
  // не прошёл. plans остаётся null — экран рисует явную ошибку с ретраем.
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    setPlans(null);
    setLoadFailed(false);
    api
      .getPlanHistory(30)
      .then(setPlans)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = (plans ?? []).filter((p) => p.done === null);
  const completed = (plans ?? []).filter((p) => p.done !== null);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        overflowY: 'auto',
        paddingTop: safeTop,
      }}
    >
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-color)',
          padding: '16px 20px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-12)',
          }}
        >
          <button
            onClick={onClose}
            aria-label="Назад"
            style={hitboxStyle(34, 34).outer}
          >
            <span
              style={{
                ...hitboxStyle(34, 34).inner,
                borderRadius: 'var(--r-10)',
                background: 'var(--surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-sub)',
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ‹
            </span>
          </button>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '-0.3px',
              }}
            >
              История планов
            </div>
            {plans !== null && plans.length > 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  marginTop: 1,
                }}
              >
                {pending.length} активных · {completed.length} завершённых
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px 140px' }}>
        {loadFailed ? (
          // Сбой ≠ пусто: не путать с «Планов пока нет» ниже — там реальный
          // пустой ответ, здесь запрос не прошёл вовсе.
          <LoadErrorBanner
            message={tr(
              'Не удалось загрузить планы. Проверь соединение',
              'Не удалось загрузить планы. Проверьте соединение',
            )}
            onRetry={load}
          />
        ) : !plans ? (
          <SkeletonList rows={4} h={96} />
        ) : plans.length === 0 ? (
          /* Empty state */
          <div style={{ paddingTop: 60, textAlign: 'center' }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
              }}
            >
              Планов пока нет
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--text-sub)',
                lineHeight: 1.65,
                marginBottom: 24,
                maxWidth: 280,
                margin: '0 auto 24px',
              }}
            >
              {tr(
                'Планы создаются в трекере — выбери потребность с низкой оценкой и нажми «Запланировать практику»',
                'Планы создаются в трекере — выберите потребность с низкой оценкой и нажмите «Запланировать практику»',
              )}
            </div>
            {onOpenTracker && (
              <button
                onClick={() => {
                  onClose();
                  onOpenTracker();
                }}
                style={{
                  padding: '12px 28px',
                  borderRadius: 'var(--r-14)',
                  border: 'none',
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                  outline: '1px solid var(--border-color)',
                  color: 'var(--accent)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Открыть трекер →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Pending plans */}
            {pending.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 10,
                  }}
                >
                  Ожидают выполнения
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-10)',
                  }}
                >
                  {pending.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onUpdate={setPlans} />
                  ))}
                </div>
              </div>
            )}

            {/* Completed plans */}
            {completed.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                    marginBottom: 10,
                  }}
                >
                  Выполненные
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-10)',
                  }}
                >
                  {completed.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} onUpdate={setPlans} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
