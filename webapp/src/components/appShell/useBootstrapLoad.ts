import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { api, reportClientError } from '../../api';
import type { PracticePlan, TherapyClientSummary } from '../../api';
import type { Need } from '../../types';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { MY_SCHEMA_IDS_KEY, CHILDHOOD_DONE_KEY, YSQ_PROGRESS_KEY } from '../../utils/storageKeys';

// Константы дат — из shared (правило №3); ре-экспорт для потребителей AppShell.
export { TODAY_DATE, TODAY_KEY } from '../../../../shared/src/utils/todayConstants';
import { TODAY_KEY, YESTERDAY_DATE } from '../../../../shared/src/utils/todayConstants';

interface Params {
  navigate: NavigateFunction;
  initialPathname: string;
}

// Одиннадцать фоновых источников грузятся на монтировании AppShell. Раньше
// каждый глушился `.catch(() => {})` — обработанная авария невидимее
// необработанной (CLAUDE.md, правило №14). Дороже всех getProfile(): упав
// молча, он оставлял терапевта в клиентском интерфейсе без кабинета и без
// объяснения. Экран по-прежнему не роняем — фолбэки те же, что были — но
// имена упавших источников копим и шлём ОДНИМ отчётом на монтирование
// (троттлинг: авария валит всё разом, отчёт на каждый источник = шум).
export function useBootstrapLoad({ navigate, initialPathname }: Params) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [yesterdayRatings, setYesterdayRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'CLIENT' | 'THERAPIST'>('CLIENT');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pendingPlans, setPendingPlans] = useState<PracticePlan[]>([]);
  const [childhoodRatings, setChildhoodRatings] = useState<Record<string, number>>({});
  const [therapistClients, setTherapistClients] = useState<TherapyClientSummary[]>([]);

  useEffect(() => {
    const failed: string[] = [];
    const fail = (name: string) => { failed.push(name); };

    const initPromise = !sessionStorage.getItem('init_done')
      ? api.init(Math.round(-new Date().getTimezoneOffset() / 60))
          .then(() => sessionStorage.setItem('init_done', '1'))
          .catch(() => fail('init'))
      : Promise.resolve();

    const activityPromise = api.recordActivity().catch(() => fail('активность'));

    // Очередь отложенных оценок (сеть легла в прошлый визит, правило №3 —
    // тот же outbox, что в мини-аппе) — один флаш на старте, как там.
    const outboxPromise = api.flushOutbox().catch(() => fail('отложенные оценки'));

    // Mirror disclaimer acceptance to server so the Telegram mini-app can skip
    // its consent screen for users who are already active on the website.
    // Вложенный acceptDisclaimer возвращается из .then — как и запросы под
    // профилем ниже: не вернуть его = флаш отчёта не дождётся его исхода.
    const disclaimerPromise = api.getDisclaimer().then(d => {
      if (!d.accepted) return api.acceptDisclaimer().catch(() => fail('дисклеймер'));
    }).catch(() => fail('дисклеймер'));

    const needsRatingsPromise = Promise.all([api.needs(), api.ratings(), api.ratings(YESTERDAY_DATE)])
      .then(([n, r, yR]) => {
        setNeeds(n);
        setRatings(r);
        setYesterdayRatings(yR);
        const initialSaved: Record<string, boolean> = {};
        for (const key of Object.keys(r)) initialSaved[key] = true;
        setSaved(initialSaved);
        if (n.length > 0 && n.every((need: Need) => r[need.id] !== undefined)) {
          localStorage.setItem(TODAY_KEY, '1');
        }
      })
      .catch((e) => { setError(String(e)); fail('needs/ratings'); })
      .finally(() => setLoading(false));

    const plansPromise = api.getPendingPlans().then(setPendingPlans).catch(() => fail('задания'));

    const childhoodPromise = api.getChildhoodRatings().then(r => {
      if (Object.keys(r).length > 0) {
        setChildhoodRatings(r);
        localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
      }
    }).catch(() => fail('колесо детства'));

    const ysqPromise = Promise.all([api.getYsqProgress(), api.getYsqResult()]).then(([prog, result]) => {
      if (prog?.answers && !result?.answers) {
        localStorage.setItem(YSQ_PROGRESS_KEY, JSON.stringify({ answers: prog.answers, page: prog.page }));
      }
    }).catch(() => fail('YSQ'));

    // Серверное предпочтение «кабинет vs клиент» (правило №16 — GET
    // /api/user-flags был доступен только мини-аппу; тот же therapistMode
    // читает и пишет /api/therapy/therapist-view, здесь только читаем для
    // дефолтного роутинга). Не блокируем профиль её отказом — фолбэк ниже
    // ведёт себя как раньше (пусто = «начинать с кабинета»).
    // Аннотация возврата, а не каст: без неё фолбэк даёт `{}`, тип
    // схлопывается в объединение и therapistMode перестаёт читаться (поймано
    // сборкой webapp после слияния с #411).
    const flagsPromise = api
      .getUserFlags()
      .catch((): { therapistMode?: boolean } => {
        fail('флаги');
        return {};
      });

    const profilePromise = Promise.all([api.getProfile(), flagsPromise]).then(([p, serverFlags]) => {
      setUserRole(p.role);
      // Психолог по умолчанию попадает в кабинет (запрос: «если я психолог —
      // всегда начинать со странички психолога»). Уважаем явный выбор
      // клиентского режима: локальный (localStorage '0') или, если этот
      // браузер видит терапевта впервые, сделанный на другой площадке
      // (мини-апп) — тот же аккаунт, серверный therapistMode===false.
      if (p.role === 'THERAPIST') {
        const pref = localStorage.getItem('therapist_mode');
        const wantsCabinet = pref !== null ? pref !== '0' : serverFlags.therapistMode !== false;
        const onDefaultLanding =
          initialPathname === '/' || initialPathname === '/today';
        if (wantsCabinet && !initialPathname.startsWith('/cabinet') && onDefaultLanding) {
          localStorage.setItem('therapist_mode', '1');
          navigate('/cabinet');
        } else if (pref === null) {
          localStorage.setItem('therapist_mode', wantsCabinet ? '1' : '0');
        }
      }
      if (p.role !== 'THERAPIST' && initialPathname.startsWith('/cabinet')) {
        navigate('/today');
      }
      if (p.name) setDisplayName(p.name);
      if (p.mySchemaIds?.length > 0) {
        localStorage.setItem(MY_SCHEMA_IDS_KEY, JSON.stringify(p.mySchemaIds));
      }
      // Дальше — вложенные запросы. Возвращаем их промис из колбэка: иначе
      // profilePromise резолвится раньше, чем клиенты/связь с терапевтом
      // отработают, и их сбой не попадёт во флаш отчёта ниже.
      if (p.role === 'THERAPIST') {
        cacheTherapistContact({ role: 'THERAPIST', partnerId: null, partnerName: null, myId: null, myName: p.name });
        return api.getTherapyClients().then(setTherapistClients).catch(() => fail('клиенты терапевта'));
      } else {
        return api.getTherapyRelation().then(rel => {
          cacheTherapistContact({ role: 'CLIENT', partnerId: rel?.partnerId ?? null, partnerName: rel?.partnerName ?? null, myId: null, myName: null });
        }).catch(() => fail('связь с терапевтом'));
      }
    }).catch(() => fail('профиль'));

    Promise.allSettled([initPromise, activityPromise, outboxPromise, disclaimerPromise, needsRatingsPromise, plansPromise, childhoodPromise, ysqPromise, profilePromise])
      .then(() => {
        if (failed.length) {
          reportClientError({ message: `appshell bootstrap fail: ${failed.join(', ')}`, section: 'appshell.bootstrap' });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  return {
    needs, ratings, setRatings, saved, setSaved, yesterdayRatings,
    loading, error,
    userRole, setUserRole,
    displayName, setDisplayName,
    pendingPlans, setPendingPlans,
    childhoodRatings, setChildhoodRatings,
    therapistClients, setTherapistClients,
  };
}
