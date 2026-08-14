// Security-трипваер: рассинхрон имён продуктовых событий между фронтом и
// бэком (правило №8 CLAUDE.md, этап 2.5 TEST_IMPROVEMENT_PLAN.md). Бэк
// валидирует событие по allow-list ANALYTICS_EVENTS
// (src/analytics/analytics.constants.ts) и молча дропает всё незнакомое
// (AnalyticsService.track) — опечатка в имени события на фронте не падает
// нигде, метрика просто тихо никогда не появляется в /stats. Инвариант:
// каждое имя события, которое фронт шлёт строковым литералом через
// trackEvent('...')/api.trackEvent('...'), обязано быть в ANALYTICS_EVENTS.
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from './collect-source-files';
import { ANALYTICS_EVENTS } from '../analytics/analytics.constants';

const ROOT = join(__dirname, '..', '..');

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
    for (const file of collectSourceFiles(dir, {
      extensions: ['.ts', '.tsx'],
    })) {
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
  auth_rejected:
    'серверное событие: пишет только TelegramAuthGuard, когда мини-апп ' +
    'пришёл с пустой подписью (src/api/auth-failure.report.ts). Фронт его ' +
    'не шлёт и не должен — отчёт /stats считает только строки с userId = null',
  auth_success:
    'серверное событие: пишет только TelegramAuthGuard после подтверждённого ' +
    'JWT/Telegram/MAX входа (src/api/auth-success.report.ts), с троттлингом ' +
    'per userId+host. Фронт его не шлёт и не должен — та же защита userId = ' +
    'null, что и у auth_rejected',
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
  mode_card_saved:
    'константа MODE_CARD_SAVED_EVENT (shared/src/share/analytics.ts), ' +
    'та же группа, что и share_card/onboarding_step — грепом по литералу не ловится',
  mode_entry_saved:
    'константа MODE_ENTRY_SAVED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из ModeEntrySheet.tsx (оба фронта) через api.trackEvent',
  mode_test_completed:
    'константа MODE_TEST_COMPLETED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из ModeFeelingBrowse.tsx (оба фронта) — единственный вход выбора ' +
    'режима после удаления окна-теста (ModeTestSheet/ModeTestScreen)',
  warm_words_open:
    'константа WARM_WORDS_OPEN_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из WarmWords.tsx (мини-апп) и WarmWordsEx.tsx (сайт) — ' +
    'грепом по литералу не ловится',
  mode_chain_followup:
    'константа MODE_CHAIN_FOLLOWUP_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из ModeEntrySheet.tsx (оба фронта) при принятой подсказке ' +
    '«разобрать связанный режим»',
  mode_doubt_opened:
    'константа MODE_DOUBT_OPENED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из ModeDoubtButton.tsx (оба фронта) при открытии листа ' +
    '«С чем путают режим»',
  mode_doubt_switched:
    'константа MODE_DOUBT_SWITCHED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из ModeDoubtButton.tsx (оба фронта) при нажатии «Это ближе»',
  account_link_started:
    'константа ACCOUNT_LINK_STARTED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из useAccountLink.ts (мини-апп) при нажатии «У меня уже есть ' +
    'аккаунт»',
  account_link_confirmed:
    'константа ACCOUNT_LINK_CONFIRMED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из LinkDevicePage.tsx (сайт) — подтверждение происходит в ' +
    'браузере, а не в мессенджере, поэтому фронт тут только один',
  account_link_failed:
    'константа ACCOUNT_LINK_FAILED_EVENT (shared/src/share/analytics.ts), ' +
    'шлётся из useAccountLink.ts (мини-апп), когда код протух или сервер ' +
    'не ответил',
  client_error:
    'серверное событие: пишет только ClientErrorsController при ' +
    'POST /api/client-errors (src/api/client-errors.controller.ts), не ' +
    'trackEvent() — фронт шлёт reportClientError(), а не аналитику напрямую. ' +
    'userId = null и троттлинг по source+section+ip — тот же приём, что у ' +
    'auth_rejected/auth_success',
  signup_source:
    'серверное событие: пишет только бот в /start, когда payload — ' +
    'deep-link `src_<slug>` (parseSourceSlug, src/telegram/start-source.ts), ' +
    'ровно один раз при первом касании нового юзера. Фронт его не шлёт и не ' +
    'должен — атрибуция посева живёт только на сервере, иначе её можно ' +
    'подделать через POST /api/event',
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
    // Потолок поднят с 11 до 13 (mode_entry_saved/mode_test_completed, 2026-07),
    // затем до 15 (warm_words_open/mode_chain_followup, 2026-08), затем до 17
    // (mode_doubt_opened/mode_doubt_switched, 2026-08), затем до 20
    // (account_link_*, 2026-08) осознанно: те же кросс-фронтовые события
    // через именованные константы — тот же легитимный паттерн, что и
    // share_card/onboarding_step/mode_card_saved, не обход правила.
    // 21 — auth_rejected: единственное СЕРВЕРНОЕ событие в списке, фронт его
    // слать не может по замыслу (отказ входа фиксирует guard). 22 —
    // auth_success: пара к нему, тот же guard, тот же приём userId = null.
    // 23 — client_error (волна 9 щита покрытия): пишет ClientErrorsController,
    // а не trackEvent(), тот же приём userId = null, что у auth_rejected.
    // 24 — signup_source (атрибуция посевов, 2026-08): пишет только бот в
    // /start, тот же приём (серверное событие, фронт не шлёт).
    expect(Object.keys(BACKEND_ONLY).length).toBeLessThanOrEqual(24);
  });
});
