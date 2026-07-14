import { useEffect, useMemo, useRef, useState } from 'react';

// Общая логика теста YSQ-R (116 утверждений, скоринг, персист прогресса и
// результата, история прохождений) — парный файл для webapp и schema-miniapp
// (правило №3 CLAUDE.md). UI (вёрстка/стили/тексты) остаётся в каждом
// YSQTestSheet.tsx отдельно; сюда вынесено только то, что должно совпадать
// побайтово: вопросы/страницы, вычисления скоринга, сохранение/восстановление
// прогресса, сабмит в api.
//
// Разница окружений (api-клиент конкретного фронтенда) приходит параметром
// хука — этот файл не импортирует ничего фронтенд-специфичного кроме react.

export const YSQ_RESULT_KEY = 'ysq_result';
export const YSQ_PROGRESS_KEY = 'ysq_progress';

export const QUESTIONS: string[] = [
  'Мне не хватало любви и тепла в жизни.',
  'В основном мне было не к кому обратиться – ни за советом, ни за поддержкой.',
  'На протяжении большей части жизни рядом не было человека, который хотел бы быть близко и проводить со мной время.',
  'На протяжении большей части жизни я не ощущал, что кто-то считает меня важным и ценным.',
  'Рядом редко оказывался зрелый, опытный человек, способный направить меня, когда я не знал, как поступить.',
  'Меня тревожит мысль о том, что близкие однажды уйдут или бросят меня.',
  'Мне кажется, что любые значимые отношения обречены – я жду, что они разрушатся.',
  'Я чувствую привязанность к людям, которые не могут дать мне той близости, которая мне нужна.',
  'Даже кратковременное одиночество выбивает меня из равновесия.',
  'Я избегаю настоящей близости, потому что не знаю, останется ли человек рядом.',
  'Близкие люди в моей жизни часто были непредсказуемы: то тёплые и открытые, то внезапно злые, раздражённые или погружённые в себя.',
  'Я так сильно нуждаюсь в людях, что постоянно боюсь их потерять.',
  'Если я покажу своё настоящее лицо или выражу то, что чувствую, – люди отвернутся.',
  'Я не могу расслабиться рядом с людьми – стоит ослабить бдительность, и меня обидят.',
  'Предательство неизбежно – вопрос лишь в том, когда это произойдёт.',
  'Мне тяжело открываться и доверять другим людям.',
  'Иногда я намеренно проверяю людей, чтобы понять, честны ли они и можно ли им верить.',
  'Я уверен: в отношениях всегда кто-то управляет, и лучше, чтобы это был я.',
  'Я принципиально другой – меня отличает что-то фундаментальное.',
  'Я не чувствую принадлежности ни к одному сообществу или группе.',
  'В любой компании я ощущаю себя лишним.',
  'Меня никто не понимает на самом деле.',
  'Я нередко ощущаю себя посторонним среди людей.',
  'Те, кого я хочу видеть рядом, ушли бы, узнав меня по-настоящему.',
  'В глубине я чувствую, что со мной что-то фундаментально не так.',
  'Я не верю, что достоин любви.',
  'Мои настоящие черты настолько неприятны, что я не могу открыться другим.',
  'Когда я кому-то нравлюсь, возникает ощущение, что я их обманываю.',
  'Я не понимаю, за что меня вообще можно любить.',
  'На работе (или учёбе) у меня почти всегда выходит хуже, чем у других.',
  'В сфере работы и достижений большинство людей превосходят меня.',
  'Я чувствую себя неудачником.',
  'В работе или учёбе у меня меньше таланта, чем у большинства.',
  'Среди других мне бывает неловко – мои достижения явно уступают их достижениям.',
  'Сравнивая себя с другими, я почти всегда прихожу к выводу, что они намного успешнее.',
  'Я не уверен, что справляюсь с обычными жизненными задачами в одиночку.',
  'Другие умеют позаботиться обо мне лучше, чем я сам.',
  'Без чьей-то помощи или направления мне сложно браться за новые дела вне привычных рамок.',
  'В большинстве вещей, за которые я берусь в жизни, у меня ничего не выходит.',
  'Если я буду опираться только на себя в обычных ситуациях – скорее всего ошибусь.',
  'Мне нужен кто-то, кому можно доверять и у кого спрашивать совета по практическим делам.',
  'В повседневных делах я чувствую себя скорее ребёнком, чем самостоятельным взрослым.',
  'Обычные бытовые задачи кажутся мне непосильными.',
  'Я живу в ожидании беды – катастрофы, несчастного случая, кризиса или преступления.',
  'Я боюсь физической угрозы со стороны других.',
  'Я очень тщательно оберегаю себя от болезней и травм.',
  'Даже когда врачи не находят ничего серьёзного, я не перестаю бояться тяжёлой болезни.',
  'Меня постоянно тревожат мировые проблемы: преступность, экология и тому подобное.',
  'Мир кажется мне опасным и враждебным.',
  'Мы с родителями слишком сильно вмешиваемся в жизнь и проблемы друг друга.',
  'Если я что-то скрываю от родителей, я чувствую себя виноватым – как будто предаю их.',
  'Когда мы с родителями пропускаем несколько дней без общения, кто-то из нас чувствует обиду, вину или одиночество.',
  'Мне часто трудно ощутить себя отдельной личностью – независимой от партнёра или родителей.',
  'Сохранять психологическую дистанцию в близких отношениях мне очень сложно – я словно растворяюсь в другом человеке.',
  'В отношениях с родителями или партнёром у меня почти не остаётся пространства для себя.',
  'Мне кажется, родителей очень обижает или обидело бы, если бы я жил отдельно и самостоятельно.',
  'Я убеждён, что действия по собственному желанию рано или поздно приводят к проблемам.',
  'В отношениях я, как правило, уступаю главенство другому человеку.',
  'Я так привык, что за меня решают другие, что потерял понимание собственных желаний.',
  'Меня сильно тревожит, не разочаровываю ли я других – лишь бы они меня не отвергли.',
  'Чтобы избежать открытого конфликта, я готов сделать значительно больше, чем большинство людей.',
  'Я вкладываю в отношения больше, чем получаю обратно.',
  'Как правило, именно на мне лежит забота о близких.',
  'Сколько бы дел у меня ни было, я всегда нахожу время для других.',
  'Я привык быть тем, кто слушает чужие проблемы.',
  'Окружающие говорят, что я чрезмерно жертвую собой ради других.',
  'Сколько бы я ни делал для других – ощущение, что недостаточно, не проходит.',
  'Мысль о том, что я могу утратить контроль над собой, пугает меня.',
  'Я опасаюсь, что если разозлюсь по-настоящему – могу причинить кому-то вред.',
  'Я убеждён, что обязан держать эмоции под контролем – иначе всё выйдет из-под контроля.',
  'Внутри накопилось много злости, обиды и раздражения, которые я не выражаю.',
  'Мне неловко проявлять тепло и привязанность к другим – даже когда это уместно.',
  'Показывать свои чувства другим людям мне очень тяжело.',
  'Мне трудно открываться и чувствовать себя свободно с людьми.',
  'Я так сдерживаю себя, что окружающим кажется, будто я вообще ничего не чувствую.',
  'Меня считают закрытым и зажатым в эмоциональном плане.',
  'Мне важно быть лучшим в том, что я делаю – второе место меня не устраивает.',
  'Я стараюсь, чтобы всё было близко к идеалу.',
  'Стремление к достижениям оставляет мало места для отдыха и расслабления.',
  'Я обязан выполнять все взятые на себя обязательства.',
  'Ради соответствия своим стандартам я нередко отказываюсь от радостей и удовольствий.',
  'Мне трудно простить себе ошибку или найти ей оправдание.',
  'Я стремлюсь быть лучшим по результатам и продуктивности.',
  'Когда мне отказывают в просьбе, мне очень сложно это принять.',
  'Любые ограничения или запреты вызывают у меня сильное раздражение.',
  'Я не считаю нужным следовать правилам и нормам, которые обязательны для всех.',
  'Увлёкшись собственными делами, я нередко забываю о времени для близких.',
  'Мне часто говорят, что я слишком стремлюсь контролировать, как всё происходит.',
  'Я плохо переношу, когда кто-то диктует мне, что делать.',
  'Рутинные и неинтересные задачи я почти не в состоянии выполнять регулярно.',
  'Я нередко поддаюсь порывам и выражаю эмоции, которые потом оборачиваются проблемами для меня или окружающих.',
  'Я быстро устаю от однообразия и начинаю скучать.',
  'Когда задача усложняется, мне обычно не хватает настойчивости, чтобы её закончить.',
  'Даже понимая, что это нужно, я не могу заставить себя делать то, что мне неприятно.',
  'Я часто не следую принятым решениям до конца.',
  'Я нередко действую импульсивно и впоследствии об этом сожалею.',
  'Мне важно, чтобы большинство знакомых хорошо относились ко мне.',
  'Я подстраиваю своё поведение под конкретного человека, чтобы произвести хорошее впечатление.',
  'То, как я себя воспринимаю, во многом определяется мнением окружающих.',
  'Я прилагаю усилия, чтобы понравиться и получить одобрение от важных для меня людей.',
  'Меня чрезмерно беспокоит вопрос: принимают ли меня окружающие.',
  'Я невольно замечаю плохое в жизни, а не хорошее.',
  'Я жду, что что-нибудь неизбежно сорвётся.',
  'Трудностей и неприятностей впереди больше, чем хорошего – я в этом уверен.',
  'Если мне не уделяют особого внимания, я ощущаю себя неважным и незначительным.',
  'Осторожности много не бывает – почти в любой ситуации что-то может пойти не так.',
  'Меня тревожит: одно неправильное решение – и всё рухнет.',
  'Когда я ошибаюсь, я считаю, что должен быть наказан.',
  'Если я сделал что-то не так – оправданий нет и быть не может.',
  'Не справился – значит, должен нести последствия, без исключений.',
  'Причина ошибки не имеет значения – сделал не так, значит должен за это ответить.',
  'В глубине я считаю себя плохим человеком, который заслуживает наказания.',
  'Тех, кто не выполняет свои обязательства, необходимо как-то наказать.',
  'Когда другие оправдываются – я обычно не верю: это просто нежелание брать на себя ответственность.',
  'Даже после извинений обида во мне не проходит.',
  'Меня раздражает, когда люди ищут оправдания или перекладывают вину на других.',
];

export interface SchemaInfo {
  name: string;
  questions: number[]; // 1-indexed
  color: string;
  desc: string;
  tip: string;
  needId: string;
}

export const SCHEMAS: SchemaInfo[] = [
  {
    name: 'Эмоциональная депривация',
    questions: [1, 2, 3, 4, 5],
    color: 'var(--accent-red)',
    desc: 'Ощущение, что никто по-настоящему не понимает и не заботится так, как нужно.',
    tip: 'Попробуй прямо попросить о поддержке – не намёком, а словами.',
    needId: 'attachment',
  },
  {
    name: 'Покинутость/Нестабильность',
    questions: [6, 7, 8, 9, 10, 11, 12, 13],
    color: 'var(--accent-red)',
    desc: 'Страх что близкие уйдут или окажутся ненадёжными – даже если сейчас всё хорошо.',
    tip: 'Замечай, когда партнёр рядом – это реальный факт, а не случайность.',
    needId: 'attachment',
  },
  {
    name: 'Недоверие/Ожидание жестокого обращения',
    questions: [14, 15, 16, 17, 18],
    color: 'var(--accent-red)',
    desc: 'Убеждённость что люди в конечном счёте причинят боль, обманут или используют.',
    tip: 'Выбери одного человека которому доверяешь – и сделай один маленький шаг навстречу.',
    needId: 'attachment',
  },
  {
    name: 'Социальная отчужденность',
    questions: [19, 20, 21, 22, 23],
    color: 'var(--accent-red)',
    desc: 'Ощущение собственной инаковости и непринадлежности ни к какой группе.',
    tip: 'Найди одно сообщество по интересу – не для дружбы, просто чтобы быть среди своих.',
    needId: 'attachment',
  },
  {
    name: 'Дефективность/Стыд',
    questions: [24, 25, 26, 27, 28, 29],
    color: 'var(--accent-red)',
    desc: 'Глубокое ощущение собственной дефективности: если узнают настоящего – отвернутся.',
    tip: 'Поделись чем-то личным с одним человеком которому доверяешь – и посмотрите что будет.',
    needId: 'attachment',
  },
  {
    name: 'Неуспешность',
    questions: [30, 31, 32, 33, 34, 35],
    color: 'var(--accent-orange)',
    desc: 'Убеждённость в неизбежном провале и отставании от других в работе или учёбе.',
    tip: 'Запиши три реальных достижения за последний год – маленьких, но своих.',
    needId: 'autonomy',
  },
  {
    name: 'Зависимость/Беспомощность',
    questions: [36, 37, 38, 39, 40, 41, 42, 43],
    color: 'var(--accent-orange)',
    desc: 'Чувство что не способен справляться с жизнью самостоятельно без чьей-то помощи.',
    tip: 'Реши одну бытовую задачу без совета – любую, самую маленькую.',
    needId: 'autonomy',
  },
  {
    name: 'Уязвимость',
    questions: [44, 45, 46, 47, 48, 49],
    color: 'var(--accent-orange)',
    desc: 'Хроническое ожидание катастрофы: болезни, финансового краха, опасности.',
    tip: 'Когда возникает тревога – спроси себя: какова реальная вероятность этого прямо сейчас?',
    needId: 'autonomy',
  },
  {
    name: 'Спутанность/Неразвитая идентичность',
    questions: [50, 51, 52, 53, 54, 55, 56],
    color: 'var(--accent-orange)',
    desc: 'Трудно ощущать себя отдельной личностью – слишком много слияния с близкими.',
    tip: 'Сделай что-то только для себя – без объяснений и разрешения.',
    needId: 'autonomy',
  },
  {
    name: 'Покорность',
    questions: [57, 58, 59, 60, 61],
    color: 'var(--accent-green)',
    desc: 'Привычка уступать и подавлять свои желания из страха конфликта или отвержения.',
    tip: 'Выскажи одно своё мнение сегодня – даже если оно отличается от чужого.',
    needId: 'expression',
  },
  {
    name: 'Самопожертвование',
    questions: [62, 63, 64, 65, 66, 67],
    color: 'var(--accent-green)',
    desc: 'Постоянная забота о других за счёт собственных потребностей, с накопленной обидой.',
    tip: 'Откажи кому-то в одной просьбе – и заметьте, что ничего страшного не произошло.',
    needId: 'expression',
  },
  {
    name: 'Страх потери контроля над эмоциями',
    questions: [68, 69, 70, 71],
    color: 'var(--accent-indigo)',
    desc: 'Страх что если дать волю чувствам – они выйдут из-под контроля и навредят.',
    tip: 'Назови вслух одну эмоцию которую сейчас чувствуешь – просто назови, не действуй.',
    needId: 'expression',
  },
  {
    name: 'Эмоциональная скованность',
    questions: [72, 73, 74, 75, 76],
    color: 'var(--accent-indigo)',
    desc: 'Подавление спонтанных чувств из стыда или убеждения что эмоции – слабость.',
    tip: 'Позволь себе что-то почувствовать сегодня – смех, злость, нежность – не сдерживай.',
    needId: 'expression',
  },
  {
    name: 'Жёсткие стандарты/Придирчивость',
    questions: [77, 78, 79, 80, 81, 82, 83],
    color: 'var(--accent-indigo)',
    desc: 'Постоянное давление соответствовать очень высоким стандартам, жертвуя радостью.',
    tip: 'Сделай что-то «достаточно хорошо» – не идеально – и остановись на этом.',
    needId: 'play',
  },
  {
    name: 'Привилегированность/Грандиозность',
    questions: [84, 85, 86, 87, 88, 89],
    color: 'var(--accent-yellow)',
    desc: 'Ощущение особых прав, нетерпимость к ограничениям и чужим нуждам.',
    tip: 'Спроси кого-то что им нужно – и сделай это, даже если тебе не хочется.',
    needId: 'limits',
  },
  {
    name: 'Недостаточность самоконтроля',
    questions: [90, 91, 92, 93, 94, 95, 96],
    color: 'var(--accent-yellow)',
    desc: 'Трудно сдерживать импульсы или доводить дела до конца когда скучно.',
    tip: 'Поставь таймер на 20 минут и сделай одно неприятное дело до сигнала.',
    needId: 'limits',
  },
  {
    name: 'Поиск одобрения',
    questions: [97, 98, 99, 100, 101],
    color: 'var(--accent-indigo)',
    desc: 'Самооценка зависит от чужой оценки, подстройка под других чтобы понравиться.',
    tip: 'Прими одно решение исходя только из своих желаний – без оглядки на реакцию других.',
    needId: 'expression',
  },
  {
    name: 'Негативизм/Пессимизм',
    questions: [102, 103, 104, 105, 106, 107],
    color: 'var(--accent-indigo)',
    desc: 'Устойчивый фокус на негативном, хроническое ожидание плохого исхода.',
    tip: 'Запиши одну хорошую вещь которая случилась сегодня – даже маленькую.',
    needId: 'play',
  },
  {
    name: 'Пунитивность (на себя)',
    questions: [108, 109, 110, 111, 112],
    color: 'var(--accent-indigo)',
    desc: 'Жёсткая самокритика за ошибки, убеждённость в заслуженности наказания.',
    tip: 'Скажи себе то, что сказал бы другу в такой же ситуации – без осуждения.',
    needId: 'play',
  },
  {
    name: 'Пунитивность (на других)',
    questions: [113, 114, 115, 116],
    color: 'var(--accent-indigo)',
    desc: 'Нетерпимость к чужим ошибкам, гнев когда другие не соответствуют ожиданиям.',
    tip: 'Спроси себя: что стоит за поведением этого человека? Что он чувствовал?',
    needId: 'limits',
  },
];

export const NEED_LABELS: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение',
  play: 'Игра/Радость',
  limits: 'Границы',
};

export const DOMAIN_ORDER = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
];

export const PAGE_SIZE = 1;
export const TOTAL_PAGES = Math.ceil(QUESTIONS.length / PAGE_SIZE);

export const ANSWER_LABELS = [
  'Совсем не про меня',
  'Редко про меня',
  'Иногда бывает',
  'Часто так',
  'Очень похоже',
  'Полностью про меня',
];

export function getSchemaForQuestion(qIdx: number): SchemaInfo | undefined {
  return SCHEMAS.find((s) => s.questions.includes(qIdx + 1));
}

export type Phase = 'intro' | 'test' | 'result';

export interface SchemaScore {
  sum: number;
  max: number;
  pct: number;
  pct5plus: number;
}

export function computeScores(answers: number[]): Record<string, SchemaScore> {
  const result: Record<string, SchemaScore> = {};
  for (const schema of SCHEMAS) {
    const vals = schema.questions
      .map((q) => answers[q - 1] ?? 0)
      .filter((v) => v > 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    const max = schema.questions.length * 6;
    const pct = Math.round((sum / max) * 100);
    const pct5plus =
      vals.length > 0
        ? Math.round(
            (vals.filter((v) => v >= 5).length / schema.questions.length) * 100,
          )
        : 0;
    result[schema.name] = { sum, max, pct, pct5plus };
  }
  return result;
}

export const TIP_VY: Record<string, string> = {
  'Эмоциональная депривация':
    'Попробуйте прямо попросить о поддержке – не намёком, а словами.',
  'Покинутость/Нестабильность':
    'Замечайте, когда партнёр рядом – это реальный факт, а не случайность.',
  'Недоверие/Ожидание жестокого обращения':
    'Выберите одного человека которому доверяете – и сделайте один маленький шаг навстречу.',
  'Социальная отчужденность':
    'Найдите одно сообщество по интересу – не для дружбы, просто чтобы быть среди своих.',
  'Дефективность/Стыд':
    'Поделитесь чем-то личным с одним человеком которому доверяете – и посмотрите что будет.',
  Неуспешность:
    'Запишите три реальных достижения за последний год – маленьких, но своих.',
  'Зависимость/Беспомощность':
    'Решите одну бытовую задачу без совета – любую, самую маленькую.',
  Уязвимость:
    'Когда возникает тревога – спросите себя: какова реальная вероятность этого прямо сейчас?',
  'Спутанность/Неразвитая идентичность':
    'Сделайте что-то только для себя – без объяснений и разрешения.',
  Покорность:
    'Выскажите одно своё мнение сегодня – даже если оно отличается от чужого.',
  Самопожертвование:
    'Откажите кому-то в одной просьбе – и заметьте, что ничего страшного не произошло.',
  'Страх потери контроля над эмоциями':
    'Назовите вслух одну эмоцию которую сейчас чувствуете – просто назовите, не действуйте.',
  'Эмоциональная скованность':
    'Позвольте себе что-то почувствовать сегодня – смех, злость, нежность – не сдерживайте.',
  'Жёсткие стандарты/Придирчивость':
    'Сделайте что-то «достаточно хорошо» – не идеально – и остановитесь на этом.',
  'Привилегированность/Грандиозность':
    'Спросите кого-то что им нужно – и сделайте это, даже если вам не хочется.',
  'Недостаточность самоконтроля':
    'Поставьте таймер на 20 минут и сделайте одно неприятное дело до сигнала.',
  'Поиск одобрения':
    'Примите одно решение исходя только из своих желаний – без оглядки на реакцию других.',
  'Негативизм/Пессимизм':
    'Запишите одну хорошую вещь которая случилась сегодня – даже маленькую.',
  'Пунитивность (на себя)':
    'Скажите себе то, что сказали бы другу в такой же ситуации – без осуждения.',
  'Пунитивность (на других)':
    'Спросите себя: что стоит за поведением этого человека? Что он чувствовал?',
};

// Соответствие названия схемы её id в истории (`YsqHistoryEntry.scores`),
// нужно только для дельты «изменилось с прошлого прохождения».
const SCHEMA_NAME_TO_ID: Record<string, string> = {
  'Эмоциональная депривация': 'emotional_deprivation',
  'Покинутость/Нестабильность': 'abandonment',
  'Недоверие/Ожидание жестокого обращения': 'mistrust',
  'Социальная отчужденность': 'social_isolation',
  'Дефективность/Стыд': 'defectiveness',
  Неуспешность: 'failure',
  'Зависимость/Беспомощность': 'dependence',
  Уязвимость: 'vulnerability',
  'Спутанность/Неразвитая идентичность': 'enmeshment',
  Покорность: 'subjugation',
  Самопожертвование: 'self_sacrifice',
  'Страх потери контроля над эмоциями': 'emotion_inhibition_fear',
  'Эмоциональная скованность': 'emotional_inhibition',
  'Жёсткие стандарты/Придирчивость': 'unrelenting_standards',
  'Привилегированность/Грандиозность': 'entitlement',
  'Недостаточность самоконтроля': 'insufficient_self_control',
  'Поиск одобрения': 'approval_seeking',
  'Негативизм/Пессимизм': 'negativity',
  'Пунитивность (на себя)': 'punitiveness_self',
  'Пунитивность (на других)': 'punitiveness_others',
};

export interface YsqHistoryEntry {
  id: number;
  completedAt: string;
  scores: { id: string; pct5plus: number }[];
}

export interface YsqApi {
  getYsqHistory: () => Promise<YsqHistoryEntry[] | null | undefined>;
  getYsqResult: () => Promise<
    { answers: number[]; completedAt: string } | null | undefined
  >;
  getYsqProgress: () => Promise<
    { answers: number[]; page: number } | null | undefined
  >;
  saveYsqProgress: (answers: number[], page: number) => Promise<unknown>;
  saveYsqResult: (answers: number[]) => Promise<unknown>;
  deleteYsqProgress: () => Promise<unknown>;
  deleteYsqResult: () => Promise<unknown>;
}

export interface UseYsqTestOptions {
  api: YsqApi;
  autoResume?: boolean;
}

export interface ResultViewDomain {
  needId: string;
  label: string;
  schemas: SchemaInfo[];
}

export interface ResultView {
  activeSchemas: SchemaInfo[];
  inactiveSchemas: SchemaInfo[];
  activeByDomain: ResultViewDomain[];
  dateLabel: string | null;
  activeCount: number;
  activeLabel: string;
  getSchemaDelta: (schemaName: string) => number | null;
}

// Ответ выбран, но переход на следующий вопрос (или сабмит результата)
// откладывается на длительность анимации выбора ответа в UI теста.
const ANSWER_ADVANCE_DELAY = 160;

export function useYsqTest({ api, autoResume }: UseYsqTestOptions) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [answers, setAnswers] = useState<number[]>(
    Array(QUESTIONS.length).fill(0),
  );
  const [page, setPage] = useState(0);
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<YsqHistoryEntry[]>([]);
  const userStartedRef = useRef(false);
  const [hasProgress, setHasProgress] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);
  const [retakeConfirm, setRetakeConfirm] = useState(false);

  const progressAnswered = answers.filter((a) => a > 0).length;

  const goToPage = (newPage: number, dir: 'forward' | 'back') => {
    setSlideDir(dir);
    setSlideKey((k) => k + 1);
    setPage(newPage);
  };

  useEffect(() => {
    try {
      if (!autoResume) {
        const result = localStorage.getItem(YSQ_RESULT_KEY);
        if (result) {
          const parsed = JSON.parse(result);
          if (
            parsed.answers &&
            Array.isArray(parsed.answers) &&
            parsed.answers.length === QUESTIONS.length
          ) {
            setAnswers(parsed.answers);
            setPhase('result');
            if (parsed.date) setCompletedAt(parsed.date);
          }
        }
      }
      const saved = localStorage.getItem(YSQ_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: number[]; page: number };
        if (
          Array.isArray(parsed.answers) &&
          parsed.answers.length === QUESTIONS.length
        ) {
          setHasProgress(true);
          setAnswers(parsed.answers);
          if (autoResume) {
            setPage(parsed.page ?? 0);
            setPhase('test');
          }
        }
      }
    } catch {
      /* ignore */
    }

    if (!autoResume) {
      api
        .getYsqHistory()
        .then((h) => {
          if (h) setHistory(h);
        })
        .catch(() => {});

      Promise.all([api.getYsqResult(), api.getYsqProgress()])
        .then(([serverResult, serverProgress]) => {
          if (userStartedRef.current) return;
          if (
            serverResult?.answers &&
            Array.isArray(serverResult.answers) &&
            serverResult.answers.length === QUESTIONS.length
          ) {
            const dateStr =
              serverResult.completedAt ?? new Date().toISOString();
            localStorage.setItem(
              YSQ_RESULT_KEY,
              JSON.stringify({ date: dateStr, answers: serverResult.answers }),
            );
            setAnswers(serverResult.answers);
            setCompletedAt(dateStr);
            setPhase('result');
          } else if (
            serverProgress?.answers &&
            Array.isArray(serverProgress.answers) &&
            serverProgress.answers.length === QUESTIONS.length
          ) {
            localStorage.setItem(
              YSQ_PROGRESS_KEY,
              JSON.stringify({
                answers: serverProgress.answers,
                page: serverProgress.page,
              }),
            );
            setAnswers(serverProgress.answers);
            setPage(serverProgress.page);
            setHasProgress(true);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProgress = (newAnswers: number[], newPage: number) => {
    localStorage.setItem(
      YSQ_PROGRESS_KEY,
      JSON.stringify({ answers: newAnswers, page: newPage }),
    );
  };

  const handleContinue = () => {
    userStartedRef.current = true;
    try {
      const saved = localStorage.getItem(YSQ_PROGRESS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: number[]; page: number };
        if (
          Array.isArray(parsed.answers) &&
          parsed.answers.length === QUESTIONS.length
        ) {
          setAnswers(parsed.answers);
          setPage(parsed.page ?? 0);
        }
      }
    } catch {
      /* ignore */
    }
    setPhase('test');
  };

  const handleStartFresh = () => {
    userStartedRef.current = true;
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    setAnswers(Array(QUESTIONS.length).fill(0));
    setPage(0);
    setHasProgress(false);
    setPhase('test');
  };

  const handleAnswer = (qIndex: number, value: number) => {
    const next = [...answers];
    next[qIndex] = value;
    setAnswers(next);
    saveProgress(next, page);
  };

  // Выбор ответа на текущий вопрос: сохраняет ответ сразу, а через
  // ANSWER_ADVANCE_DELAY переходит к следующему вопросу либо (на последнем
  // вопросе) сабмитит результат.
  const selectAnswer = (qIdx: number, value: number) => {
    handleAnswer(qIdx, value);
    setTimeout(() => {
      const newAnswers = answers.map((a, idx) => (idx === qIdx ? value : a));
      if (page < TOTAL_PAGES - 1) {
        const next = page + 1;
        goToPage(next, 'forward');
        saveProgress(newAnswers, next);
        api.saveYsqProgress(newAnswers, next).catch(() => {});
      } else {
        const dateStr = new Date().toISOString();
        localStorage.setItem(
          YSQ_RESULT_KEY,
          JSON.stringify({ date: dateStr, answers: newAnswers }),
        );
        api
          .saveYsqResult(newAnswers)
          .then(() =>
            api
              .getYsqHistory()
              .then((h) => {
                if (h) setHistory(h);
              })
              .catch(() => {}),
          )
          .catch(() => {});
        api.deleteYsqProgress().catch(() => {});
        localStorage.removeItem(YSQ_PROGRESS_KEY);
        setAnswers(newAnswers);
        setCompletedAt(dateStr);
        setPhase('result');
      }
    }, ANSWER_ADVANCE_DELAY);
  };

  const handleBack = () => {
    if (page > 0) {
      const prev = page - 1;
      goToPage(prev, 'back');
      saveProgress(answers, prev);
      api.saveYsqProgress(answers, prev).catch(() => {});
    } else {
      setPhase('intro');
    }
  };

  const handleRetake = () => {
    localStorage.removeItem(YSQ_RESULT_KEY);
    localStorage.removeItem(YSQ_PROGRESS_KEY);
    api.deleteYsqResult().catch(() => {});
    api.deleteYsqProgress().catch(() => {});
    setAnswers(Array(QUESTIONS.length).fill(0));
    setPage(0);
    setHasProgress(false);
    setInactiveExpanded(false);
    setCompletedAt(null);
    setRetakeConfirm(false);
    setPhase('intro');
  };

  const scores = phase === 'result' ? computeScores(answers) : null;

  const resultView = useMemo<ResultView | null>(() => {
    if (!scores) return null;
    const sortedSchemas = [...SCHEMAS].sort(
      (a, b) => scores[b.name].pct5plus - scores[a.name].pct5plus,
    );
    const activeSchemas = sortedSchemas.filter(
      (s) => scores[s.name].pct5plus > 50,
    );
    const inactiveSchemas = sortedSchemas.filter(
      (s) => scores[s.name].pct5plus <= 50,
    );

    const activeByDomain = DOMAIN_ORDER.map((needId) => ({
      needId,
      label: NEED_LABELS[needId],
      schemas: activeSchemas.filter((s) => s.needId === needId),
    })).filter((d) => d.schemas.length > 0);

    const dateLabel = completedAt
      ? new Date(completedAt).toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;

    const activeCount = activeSchemas.length;
    const activeLabel =
      activeCount === 0
        ? 'Активных схем не найдено'
        : `${activeCount} ${activeCount === 1 ? 'выраженная схема' : activeCount < 5 ? 'выраженные схемы' : 'выраженных схем'}`;

    const prevEntry = history.length >= 2 ? history[1] : null;
    const getSchemaDelta = (schemaName: string): number | null => {
      if (!prevEntry) return null;
      const id = SCHEMA_NAME_TO_ID[schemaName];
      if (!id) return null;
      const prev = prevEntry.scores.find((s) => s.id === id);
      if (prev == null) return null;
      return (scores[schemaName]?.pct5plus ?? 0) - prev.pct5plus;
    };

    return {
      activeSchemas,
      inactiveSchemas,
      activeByDomain,
      dateLabel,
      activeCount,
      activeLabel,
      getSchemaDelta,
    };
  }, [scores, history, completedAt]);

  return {
    phase,
    setPhase,
    answers,
    page,
    slideKey,
    slideDir,
    completedAt,
    history,
    hasProgress,
    inactiveExpanded,
    setInactiveExpanded,
    retakeConfirm,
    setRetakeConfirm,
    progressAnswered,
    handleContinue,
    handleStartFresh,
    selectAnswer,
    handleBack,
    handleRetake,
    scores,
    resultView,
  };
}
