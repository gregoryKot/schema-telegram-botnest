import { useTr } from '../utils/addressForm';
import { hasAuthSeen } from '../../../shared/src/auth/authSeen';
import { useSafeTop } from '../utils/safezone';
import { buildWhyItWorks } from '../aboutData';
import { LoginProviderButtons } from './loginScreen/LoginProviderButtons';
import { LoginEmailForm } from './loginScreen/LoginEmailForm';

// Экран входа для web-хоста (MULTI_HOST_PLAN.md, шаг 2): мини-апп открыт
// обычным браузером на schemehappens.ru/app/ — ни подписи мессенджера, ни
// сессии ещё нет. До этого экрана 401 в браузере выглядел как «Сессия
// истекла» — враньё для человека, который никогда не входил (см. App.tsx).
//
// Правило онбординга CLAUDE.md «откуда это и зачем»: карточка ниже отвечает
// на оба вопроса ДО первого действия. Текст не новый — «что это» дословно из
// DisclaimerWelcomeStep (первый вход внутри мессенджера), «зачем и через
// сколько виден результат» — из aboutData.buildWhyItWorks (тот же источник,
// что и AboutSheet), чтобы не плодить третью формулировку.
const WHAT_IS_IT =
  '«Всё по схеме» — инструмент самопознания: трекер потребностей, дневники ' +
  'схем и режимов, тесты, практики и пространство для работы с терапевтом.';

export function LoginScreen() {
  const tr = useTr();
  const safeTop = useSafeTop();
  const whyText = buildWhyItWorks(tr);
  // Тот же экран показывался и новичку, и человеку, у которого истекла
  // сессия. Для второго «Войдите, чтобы продолжить» — это молчание о том, что
  // произошло: жалоба звучала как «приложение не сообщает, просто выкидывает».
  const returning = hasAuthSeen();

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: `${safeTop + 32}px 20px 32px`,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🧠</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          Всё по схеме
        </h1>
      </div>

      {returning ? (
        <div
          className="card"
          style={{ padding: '14px 18px', marginBottom: 12 }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            Вход устарел — такое бывает после долгого перерыва. Данные на месте,
            нужно только войти заново тем же способом.
          </p>
        </div>
      ) : (
        <div
          className="card"
          style={{ padding: '16px 18px', marginBottom: 12 }}
        >
          <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
            {WHAT_IS_IT}
          </p>
          <p
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--text-sub)',
              margin: '10px 0 0',
            }}
          >
            {whyText}
          </p>
        </div>
      )}

      <div className="card" style={{ padding: '20px 18px' }}>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            textAlign: 'center',
            margin: '0 0 4px',
          }}
        >
          {returning
            ? tr('Войди заново', 'Войдите заново')
            : tr('Войди, чтобы продолжить', 'Войдите, чтобы продолжить')}
        </p>
        <LoginProviderButtons />
        <LoginEmailForm />
      </div>
    </div>
  );
}
