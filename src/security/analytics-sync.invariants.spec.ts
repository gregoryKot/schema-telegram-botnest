// Security-трипваер: рассинхрон имён продуктовых событий между фронтом и
// бэком (правило №8 CLAUDE.md, этап 2.5 TEST_IMPROVEMENT_PLAN.md). Бэк
// валидирует событие по allow-list ANALYTICS_EVENTS
// (src/analytics/analytics.constants.ts) и молча дропает всё незнакомое
// (AnalyticsService.track) — опечатка в имени события на фронте не падает
// нигде, метрика просто тихо никогда не появляется в /stats. Инвариант:
// каждое имя события, которое фронт шлёт строковым литералом через
// trackEvent('...')/api.trackEvent('...'), обязано быть в ANALYTICS_EVENTS.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { ANALYTICS_EVENTS } from '../analytics/analytics.constants';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// Директории фронтендов, где вообще есть трекинг (правило №3: пайплайн
// событий общий, но реализация вызова живёт в каждом фронте + shared).
const FRONTEND_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];

// Литералы вида trackEvent('name'...) / api.trackEvent('name'...). НЕ ловит
// вызовы через импортируемую константу (SHARE_CARD_EVENT и т.п.) и НЕ ловит
// api.trackPublicEvent(...) — это осознанное ограничение грепа по литералам,
// см. BACKEND_ONLY ниже с реальной причиной для каждого такого события.
const TRACK_EVENT_RE = /trackEvent\(\s*['"]([^'"]+)['"]/g;

function findTrackedEvents(): Set<string> {
  const names = new Set<string>();
  for (const rel of FRONTEND_DIRS) {
    const dir = join(ROOT, rel);
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      TRACK_EVENT_RE.lastIndex = 0;
      while ((m = TRACK_EVENT_RE.exec(src))) names.add(m[1]);
    }
  }
  return names;
}

// (обратная сверка) События бэкенда, которые грепом по литералам не найти —
// каждое с реальной причиной. Список может только СОКРАЩАТЬСЯ (если событие
// перейдёт на литерал вместо константы — можно убрать отсюда).
const BACKEND_ONLY: Record<string, string> = {
  share_card:
    'шлётся через импортируемую константу SHARE_CARD_EVENT ' +
    '(shared/src/share/analytics.ts), не строковым литералом — ' +
    'WeeklyCardSheet.tsx/Celebration.tsx/ShareCardSheet.tsx (оба фронта)',
  share_result:
    'константа SHARE_RESULT_EVENT, та же группа файлов, что и share_card',
  crisis_card_shown:
    'шлётся из общего хука shared/src/analytics/useCrisisCardTracking.ts ' +
    "вызовом track('crisis_card_shown', …), где track — параметр функции " +
    '(в реальности api.trackEvent), а не литеральный вызов trackEvent(',
  crisis_hotline_tapped:
    'та же причина, что и crisis_card_shown — useCrisisCardTracking.ts',
  today_streak_toggle:
    'легаси-имя: заменено на today_block_toggle (см. комментарий в ' +
    'analytics.constants.ts), фронт больше не шлёт — оставлено в allow-list ' +
    'только ради уже накопленных исторических строк в БД',
  onboarding_step:
    'константа ONBOARDING_STEP_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из useOnboardingStepTracking.ts',
  journey_open:
    'константа JOURNEY_OPEN_EVENT, шлётся через deps.trackEvent в ' +
    'shared/src/journey/useJourney.ts',
  quiz_started:
    'шлётся через api.trackPublicEvent (анонимный путь /api/public-event, ' +
    'QuizPage.tsx), а не api.trackEvent; дублируется прямым server-side ' +
    'track() из бота (telegram.quiz.service.ts)',
  quiz_completed: 'та же причина, что и quiz_started — QuizPage.tsx + бот',
  practice_link_click:
    'шлётся только через api.trackPublicEvent (анонимный клик с ' +
    'лендинга, practiceLink.ts), не через api.trackEvent',
};

describe('трипваер: имена событий фронта ⊆ allow-list бэкенда (правило №8)', () => {
  const tracked = findTrackedEvents();

  it('санити: парсер живой — найдено ≥5 уникальных событий', () => {
    expect(tracked.size).toBeGreaterThanOrEqual(5);
  });

  it.each([...tracked])(
    'событие "%s", отправляемое фронтом, есть в ANALYTICS_EVENTS',
    (name) => {
      expect(ANALYTICS_EVENTS).toContain(name);
    },
  );

  it('каждое незасвеченное грепом событие бэка задокументировано в BACKEND_ONLY', () => {
    const undocumented = ANALYTICS_EVENTS.filter(
      (name) => !tracked.has(name) && !BACKEND_ONLY[name],
    );
    expect(undocumented).toEqual([]);
  });

  it('BACKEND_ONLY не разросся сверх известного (может только сокращаться)', () => {
    expect(Object.keys(BACKEND_ONLY).length).toBeLessThanOrEqual(10);
  });
});
