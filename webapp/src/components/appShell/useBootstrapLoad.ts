import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { api, reportClientError, type PracticePlan, type TherapyClientSummary } from '../../api';
import type { Need } from '../../types';
import { cacheClientRelation, cacheTherapistContact } from '../../utils/therapistContact';
import { humanizeThrown } from '../../../../shared/src/api/humanizeError';
import { MY_SCHEMA_IDS_KEY, CHILDHOOD_DONE_KEY, YSQ_PROGRESS_KEY, THERAPIST_MODE_KEY } from '../../utils/storageKeys';
import { useDayRatings } from '../../../../shared/src/today/useDayRatings';
import { deviceTimeZone } from '../../../../shared/src/utils/deviceTimeZone';
// Ре-экспорт для AppShell. Это день ЗАГРУЗКИ бандла; живой день, который
// сменяется в полночь, — `todayDate` из хука ниже.
export { TODAY_DATE, TODAY_KEY } from '../../../../shared/src/utils/todayConstants';

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
  const [error, setError] = useState<string | null>(null);
  // Оценки дня: день устройства явной датой, перечитывание в полночь, офлайн-
  // очередь поверх ответа — shared/today/useDayRatings (одна механика с мини-аппом).
  // Исход первой загрузки идёт в общий отчёт ниже (один отчёт на монтирование).
  const [dayLoad] = useState(() => {
    let resolve: (ok: boolean) => void = () => {};
    const promise = new Promise<boolean>((r) => { resolve = r; });
    return { promise, resolve };
  });
  const day = useDayRatings<Need>(api, {
    onLoaded: () => dayLoad.resolve(true),
    onError: (e, initial) => {
      if (!initial) {
        reportClientError({ message: 'appshell: оценки нового дня не загрузились', section: 'appshell.bootstrap' });
        return;
      }
      setError(humanizeThrown(e, 'Не удалось загрузить потребности и оценки'));
      dayLoad.resolve(false);
    },
  });
  const [userRole, setUserRole] = useState<'CLIENT' | 'THERAPIST'>('CLIENT');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pendingPlans, setPendingPlans] = useState<PracticePlan[]>([]);
  const [childhoodRatings, setChildhoodRatings] = useState<Record<string, number>>({});
  const [therapistClients, setTherapistClients] = useState<TherapyClientSummary[]>([]);

  useEffect(() => {
    const failed: string[] = [];
    const fail = (name: string) => { failed.push(name); };

    const initPromise = !sessionStorage.getItem('init_done')
      ? api.init(deviceTimeZone())
          .then(() => sessionStorage.setItem('init_done', '1'))
          .catch(() => fail('init'))
      : Promise.resolve();

    const activityPromise = api.recordActivity().catch(() => fail('активность'));

    // Очередь отложенных оценок (сеть легла в прошлый визит, правило №3 —
    // тот же outbox, что в мини-аппе) — один флаш на старте, как там.
    const outboxPromise = api.flushOutbox().catch(() => fail('отложенные оценки'));

    // Согласия (getDisclaimer/acceptDisclaimer) — hooks/useConsentGate: молча
    // принимать их нельзя, нужен экран.

    const needsRatingsPromise = dayLoad.promise.then((ok) => { if (!ok) fail('needs/ratings'); });

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
        const pref = localStorage.getItem(THERAPIST_MODE_KEY);
        const wantsCabinet = pref !== null ? pref !== '0' : serverFlags.therapistMode !== false;
        const onDefaultLanding = initialPathname === '/' || initialPathname === '/today';
        if (wantsCabinet && !initialPathname.startsWith('/cabinet') && onDefaultLanding) {
          localStorage.setItem(THERAPIST_MODE_KEY, '1');
          navigate('/cabinet');
        } else if (pref === null) {
          localStorage.setItem(THERAPIST_MODE_KEY, wantsCabinet ? '1' : '0');
        }
      } else {
        // Не терапевт: флаг '1' мог остаться от снятой роли (её сняли на другой площадке) —
        // сбрасываем, иначе «← Назад» с /account ведёт в /cabinet. replace: запись /cabinet
        // не остаётся в истории, и браузерный «Назад» не вернёт клиента в кабинет.
        if (localStorage.getItem(THERAPIST_MODE_KEY) === '1') localStorage.setItem(THERAPIST_MODE_KEY, '0');
        if (initialPathname.startsWith('/cabinet')) navigate('/today', { replace: true });
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
        return api.getTherapyRelation().then(cacheClientRelation).catch(() => fail('связь с терапевтом'));
      }
    }).catch(() => fail('профиль'));

    Promise.allSettled([initPromise, activityPromise, outboxPromise, needsRatingsPromise, plansPromise, childhoodPromise, ysqPromise, profilePromise])
      .then(() => {
        if (failed.length) {
          reportClientError({ message: `appshell bootstrap fail: ${failed.join(', ')}`, section: 'appshell.bootstrap' });
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- намеренно неполные зависимости (mount-only / стабильные ссылки); добавление рискует ре-фетч-циклами
  }, []);

  return {
    needs: day.needs, ratings: day.ratings, setRatings: day.setRatings,
    saved: day.saved, setSaved: day.setSaved, yesterdayRatings: day.yesterdayRatings,
    todayDate: day.today,
    loading: day.loading, error,
    userRole, setUserRole,
    displayName, setDisplayName,
    pendingPlans, setPendingPlans,
    childhoodRatings, setChildhoodRatings,
    therapistClients, setTherapistClients,
  };
}
