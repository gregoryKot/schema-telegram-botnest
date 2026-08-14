import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { api, reportClientError } from '../../api';
import type { Need, PracticePlan, TherapyClientSummary } from '../../api';
import { cacheTherapistContact } from '../../utils/therapistContact';
import { MY_SCHEMA_IDS_KEY, CHILDHOOD_DONE_KEY, YSQ_PROGRESS_KEY } from '../../utils/storageKeys';
import { todayStr } from '../../utils/format';

export const TODAY_DATE = todayStr();
export const TODAY_KEY = 'celebrated_' + TODAY_DATE;
const YESTERDAY_DATE = (() => {
  const [y, m, d] = TODAY_DATE.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
})();

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

    // Mirror disclaimer acceptance to server so the Telegram mini-app can skip
    // its consent screen for users who are already active on the website.
    // Вложенный acceptDisclaimer возвращается из .then — как и запросы под
    // профилем ниже: не вернуть его = флаш отчёта не дождётся его исхода.
    const disclaimerPromise = api.getDisclaimer().then(d => {
      if (!d.accepted) return api.acceptDisclaimer().catch(() => fail('дисклеймер'));
    }).catch(() => fail('дисклеймер'));

    Promise.all([api.needs(), api.ratings(), api.ratings(YESTERDAY_DATE)])
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
      .catch((e) => setError(String(e)))
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

    const profilePromise = api.getProfile().then(p => {
      setUserRole(p.role);
      // Психолог по умолчанию попадает в кабинет (запрос: «если я психолог —
      // всегда начинать со странички психолога»). Уважаем явный выбор
      // клиентского режима (localStorage '0'); при заходе на дефолтный лендинг
      // (/, /today) без такого выбора — ведём в кабинет.
      if (p.role === 'THERAPIST') {
        const pref = localStorage.getItem('therapist_mode');
        const onDefaultLanding =
          initialPathname === '/' || initialPathname === '/today';
        if (pref !== '0' && !initialPathname.startsWith('/cabinet') && onDefaultLanding) {
          localStorage.setItem('therapist_mode', '1');
          navigate('/cabinet');
        } else if (pref === null) {
          localStorage.setItem('therapist_mode', '1');
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

    Promise.allSettled([initPromise, activityPromise, disclaimerPromise, plansPromise, childhoodPromise, ysqPromise, profilePromise])
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
