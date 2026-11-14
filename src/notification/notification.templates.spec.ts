import { renderTemplate } from './notification.templates';

describe('renderTemplate', () => {
  it('returns text and keyboard for reminder', () => {
    const result = renderTemplate('reminder');
    expect(result).not.toBeNull();
    expect(result!.text).toBeTruthy();
    expect(result!.keyboard).toBeDefined();
  });

  // РКН, #1135: текст постоянный; старый payload.text (оценки) не читается.
  it('summary и weekly — постоянный текст с кнопкой, payload.text игнорируется', () => {
    for (const type of ['summary', 'weekly'] as const) {
      const plain = renderTemplate(type);
      const old = renderTemplate(type, { text: '🟩🟩🟩 9/10' });
      expect(plain!.text).toContain('в приложении');
      expect(old!.text).toBe(plain!.text);
      expect(old!.keyboard).toBeDefined();
    }
  });

  it('returns null for unknown type', () => {
    expect(renderTemplate('unknown_type' as any)).toBeNull();
  });

  it.each([
    'onboarding_1',
    'onboarding_3',
    'onboarding_7',
    'streak_7',
    'streak_14',
    'streak_30',
    'lapsing_3',
    'dormant_7',
    'reengagement_30',
    'comeback',
    'welcome_back',
    'nudge',
  ] as const)('returns non-null result for %s', (type) => {
    expect(renderTemplate(type)).not.toBeNull();
  });

  // legacy-строки в очереди на момент деплоя рендерятся мягким текстом
  it.each(['lapsing_2', 'lapsing_4'] as const)(
    'renders legacy %s with soft text',
    (type) => {
      const result = renderTemplate(type);
      expect(result!.text).toContain('ничего не портит');
    },
  );

  describe('reminder keyboard (кнопки саморегуляции)', () => {
    function callbacks(
      result: NonNullable<ReturnType<typeof renderTemplate>>,
    ): string[] {
      const rows = (result.keyboard as any).reply_markup
        .inline_keyboard as Array<Array<any>>;
      return rows
        .flat()
        .map((b) => b.callback_data)
        .filter(Boolean);
    }

    it('has snooze, skip, pause and slower buttons', () => {
      const result = renderTemplate('reminder')!;
      const cbs = callbacks(result);
      expect(cbs).toEqual(
        expect.arrayContaining([
          'snooze_reminder',
          'notify:skip',
          'notify:pause',
          'notify:slower',
        ]),
      );
    });

    it('компактные кнопки: только «открыть» и «реже», без snooze/skip/pause', () => {
      const result = renderTemplate('reminder', { compactControls: true })!;
      const cbs = callbacks(result);
      expect(cbs).toEqual(['notify:slower']);
      expect(cbs).not.toContain('snooze_reminder');
      expect(cbs).not.toContain('notify:skip');
      expect(cbs).not.toContain('notify:pause');
    });

    it('перерыв (onBreak) → перерыв-осознающий текст, без «за сегодня» и без «вчера»', () => {
      const result = renderTemplate('reminder', {
        onBreak: true,
        variant: 0,
        yesterdayAvg: 6.5,
      })!;
      expect(result.text).toContain('это нормально');
      expect(result.text).not.toContain('за сегодня');
      expect(result.text).not.toContain('Вчера индекс');
    });

    it('перерыв рендерится в обеих формах обращения', () => {
      const ty = renderTemplate(
        'reminder',
        { onBreak: true, variant: 0 },
        'ty',
      )!;
      const vy = renderTemplate(
        'reminder',
        { onBreak: true, variant: 0 },
        'vy',
      )!;
      expect(ty.text).toContain('Тебя не было');
      expect(vy.text).toContain('Вас не было');
    });

    it('активный тон (не перерыв) — без императива «отметь оценки за сегодня»', () => {
      for (let variant = 0; variant < 5; variant++) {
        const text = renderTemplate('reminder', { variant })!.text;
        expect(text).not.toContain('отметь оценки за сегодня');
        expect(text).not.toContain('отметьте оценки за сегодня');
      }
    });

    it('does not mention streak when 0-2 days', () => {
      for (const streak of [0, 1, 2]) {
        const result = renderTemplate('reminder', { streak })!;
        expect(result.text).not.toContain('Серия');
      }
    });

    it('mentions streak when alive and growing (>=3)', () => {
      const result = renderTemplate('reminder', { streak: 5 })!;
      expect(result.text).toContain('Серия: 5');
    });
  });

  describe('comeback', () => {
    it('mentions total days with correct pluralization', () => {
      expect(renderTemplate('comeback', { totalDays: 21 })!.text).toContain(
        '21 день',
      );
      expect(renderTemplate('comeback', { totalDays: 22 })!.text).toContain(
        '22 дня',
      );
      expect(renderTemplate('comeback', { totalDays: 25 })!.text).toContain(
        '25 дней',
      );
      expect(renderTemplate('comeback', { totalDays: 11 })!.text).toContain(
        '11 дней',
      );
    });

    it('never mentions broken streak or gap length', () => {
      const text = renderTemplate('comeback', { totalDays: 10 })!.text;
      expect(text).not.toMatch(/Серия|пропуст|сгорел/i);
    });

    it('works without totalDays', () => {
      const result = renderTemplate('comeback')!;
      expect(result.text).toContain('С возвращением');
    });
  });

  describe('welcome_back', () => {
    it('offers to extend the pause', () => {
      const result = renderTemplate('welcome_back')!;
      const rows = (result.keyboard as any).reply_markup
        .inline_keyboard as Array<Array<any>>;
      const cbs = rows
        .flat()
        .map((b) => b.callback_data)
        .filter(Boolean);
      expect(cbs).toContain('notify:pause');
    });
  });
});
