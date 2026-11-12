// Вид на компьютере (1280) в каждом PR (docs/open/frontend-ux.md, «Снимок 1280
// рядом с 393»). Класс «телефонное правило без медиа» держит сверка исходников
// webapp/src/styles/desktopLayout.test.ts, но вид целиком на компьютере никто не
// снимал: правка вида проверялась на 393 (инцидент 2026-11-04 — экраны стали
// телефонными на ≥768).
//
// Здесь на 1280×800 у ключевых страниц: нет горизонтальной прокрутки; ни один
// видимый блок не обрезан краем окна (целиком вынесенное за край — приём
// «скрыто для глаз», как ловушка для ботов в форме доната, — не в счёт);
// колонка страниц без боковой навигации стоит по центру. Снимок каждой
// страницы пишется в test-results/**/desktop-1280.png, джоба browser-smoke
// выкладывает их артефактом `desktop-1280` всегда — вид на компьютере виден в
// PR без локального запуска. Попиксельной сверки с эталоном нет осознанно
// (причина — в той же записи реестра).
import type { Page } from '@playwright/test';
import { test, expect } from './support/test';

type Spec = {
  name: string;
  path: string;
  ready: (p: Page) => ReturnType<Page['getByRole']>;
  centered?: string;
};
const PAGES: Spec[] = [
  {
    name: 'подписка',
    path: '/subscribe',
    ready: (p) => p.getByRole('heading', { name: 'Подписка скоро' }),
    centered: '.pa-outcome-card', // подписка выключена — лист исхода PaperOutcome (b28)
  },
  {
    name: 'пожертвование',
    path: '/donate',
    ready: (p) => p.getByRole('heading', { name: 'Поддержать проект' }),
    centered: '.ap-main', // колонка PayLayout (b28)
  },
  {
    name: 'аккаунт',
    path: '/account',
    ready: (p) => p.getByRole('heading', { name: 'Вход и защита' }),
  },
  {
    // Новичку без истории лист «Зачем это всё» открывается сам.
    name: 'Зачем это всё',
    path: '/today',
    ready: (p) => p.getByRole('heading', { name: /Три вещи/ }),
    centered: '.cw-inner',
  },
  {
    name: 'Ещё',
    path: '/more',
    ready: (p) => p.getByRole('heading', { name: 'Всё остальное' }),
  },
];

for (const s of PAGES) {
  test(`1280, ${s.name}: без прокрутки вбок и обрезанных блоков`, async ({
    page,
  }, testInfo) => {
    if (s.path === '/more') {
      await page.addInitScript(() => localStorage.setItem('why_seen_v1', '1'));
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(s.path);
    await expect(s.ready(page)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('desktop-1280.png'),
      fullPage: true,
    });

    const m = await page.evaluate((centered) => {
      const iw = window.innerWidth;
      const cut = [...document.querySelectorAll('body *')]
        .filter((e) => {
          const st = getComputedStyle(e);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.right <= 0 || r.left >= iw) return false;
          return r.left < -1 || r.right > iw + 1;
        })
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.className)}`);
      const col = centered ? document.querySelector(centered) : null;
      const r = col?.getBoundingClientRect();
      return {
        scroll: document.documentElement.scrollWidth - iw,
        cut,
        skew: r ? Math.abs(r.left - (iw - r.right)) : null,
      };
    }, s.centered ?? null);

    expect(m.scroll, 'горизонтальная прокрутка на 1280').toBeLessThanOrEqual(0);
    expect(m.cut, 'блоки, обрезанные краем окна').toEqual([]);
    if (s.centered) {
      expect(m.skew, `${s.centered} не найден`).not.toBeNull();
      expect(m.skew!, `${s.centered} не по центру`).toBeLessThanOrEqual(2);
    }
  });
}
