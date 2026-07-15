import { useEffect, useMemo, useRef, useState } from 'react';

// Общая логика теста на схемы (116 утверждений, скоринг, персист прогресса и
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
  'Рядом почти не было тех, с кем можно поделиться самым важным и почувствовать отклик.',
  'Мне часто недоставало тепла и нежности в отношениях с близкими.',
  'В трудные минуты я обычно оставался со своими переживаниями наедине.',
  'Мало кто по-настоящему интересовался тем, что я чувствую и что мне нужно.',
  'Мне не хватало человека, который направлял бы меня и поддерживал советом.',
  'Я часто опасаюсь, что дорогие мне люди однажды исчезнут из моей жизни.',
  'Мне трудно поверить, что тёплые отношения могут длиться и не разрушиться.',
  'Меня тянет к людям, которые не готовы быть настолько близкими, насколько мне хотелось бы.',
  'Даже короткая разлука с близким выбивает меня из колеи.',
  'Я держусь на расстоянии, потому что не уверен, останется ли человек рядом.',
  'В детстве настроение близких резко менялось: то теплота, то холод и раздражение.',
  'Из-за сильной потребности в людях меня почти не отпускает страх их лишиться.',
  'Стоит мне с кем-то сблизиться, как появляется тревога, что всё это ненадолго.',
  'Если люди узнают меня настоящего, кто-нибудь непременно обратит это мне во вред.',
  'Рядом с другими я будто на страже: расслабишься — и тебя заденут.',
  'В глубине души я жду, что близкие рано или поздно предадут.',
  'Открываться и доверять людям мне по-настоящему трудно.',
  'Мне спокойнее держать контроль в отношениях — так меня сложнее использовать.',
  'Я чувствую себя не таким, как остальные, будто устроен иначе.',
  'Мне сложно ощутить принадлежность хоть к какой-то группе или компании.',
  'В любом коллективе я скорее чувствую себя лишним.',
  'Мне кажется, что по-настоящему меня понимают немногие.',
  'Среди людей я нередко ощущаю себя посторонним.',
  'Если бы люди узнали меня по-настоящему, они бы отдалились.',
  'Внутри живёт ощущение, что со мной что-то не так на самом глубоком уровне.',
  'Мне сложно поверить, что меня можно любить таким, какой я есть.',
  'Свои настоящие качества я считаю настолько неприглядными, что прячу их.',
  'Когда я кому-то нравлюсь, внутри шевелится чувство, будто я ввожу человека в заблуждение.',
  'Мне не вполне понятно, за что меня вообще можно ценить.',
  'В делах и работе у меня, как правило, выходит слабее, чем у окружающих.',
  'По части достижений большинство людей, кажется, оставляют меня позади.',
  'Порой я ощущаю себя человеком, у которого мало что получилось.',
  'Мне кажется, способностей и таланта у меня меньше, чем у других.',
  'Рядом с чужими успехами мои достижения выглядят для меня блёкло.',
  'Сравнивая себя с другими, я чаще прихожу к выводу, что заметно им уступаю.',
  'Мне не хватает уверенности, что я справлюсь с повседневными задачами сам.',
  'Кажется, другие способны позаботиться обо мне лучше, чем я сам.',
  'Браться за незнакомое дело без чьей-то поддержки мне тяжело.',
  'Часто мне чудится, что за что бы я ни взялся, толком ничего не выйдет.',
  'Опираясь только на себя в обычных делах, я, скорее всего, ошибусь.',
  'Мне нужен кто-то надёжный, у кого можно спросить совета по житейским вопросам.',
  'В бытовых делах я порой чувствую себя скорее ребёнком, чем взрослым.',
  'Обыденные обязанности иногда кажутся мне неподъёмными.',
  'Я будто всё время жду беды — аварии, болезни или другого несчастья.',
  'Мысль о том, что мне могут причинить физический вред, не отпускает меня.',
  'Я очень настороженно оберегаю себя от травм и болезней.',
  'Даже когда обследования спокойны, страх серьёзной болезни во мне остаётся.',
  'Меня то и дело тревожат большие угрозы — от преступности до экологии.',
  'Мир нередко видится мне местом опасным и ненадёжным.',
  'Мы с близкими слишком вовлечены в дела и переживания друг друга.',
  'Скрывая что-то от близких, я испытываю вину, будто предаю их.',
  'Если мы с близким долго не общаемся, кто-то из нас начинает переживать обиду или одиночество.',
  'Мне бывает трудно ощутить себя отдельным человеком, независимым от близких.',
  'В тесных отношениях я словно растворяюсь и теряю границу между собой и другим.',
  'Рядом с близкими у меня почти не остаётся собственного внутреннего пространства.',
  'Мне кажется, мои близкие тяжело переживали бы мою полную самостоятельность.',
  'Я привык уступать другим право решать за меня.',
  'За меня так часто выбирали, что я и сам перестал понимать, чего хочу.',
  'Меня сильно беспокоит, не разочарую ли я других, — лишь бы не оттолкнуть.',
  'Чтобы не доводить до конфликта, я готов терпеть куда больше обычного.',
  'Свои желания я нередко отодвигаю, лишь бы никого не задеть.',
  'Я вкладываю в отношения больше, чем получаю в ответ.',
  'Забота о близких почти всегда ложится именно на меня.',
  'Как бы я ни был занят, для чужих нужд время находится всегда.',
  'Я привычно оказываюсь тем, кто выслушивает чужие беды.',
  'Мне говорят, что я слишком многим жертвую ради других.',
  'Сколько бы я ни делал для людей, внутри остаётся чувство, что этого мало.',
  'Мысль, что я могу потерять контроль над собой, меня пугает.',
  'Я побаиваюсь, что в сильном гневе способен кому-то навредить.',
  'Мне кажется, эмоции нужно крепко держать в узде, иначе всё разладится.',
  'Внутри копится много невыраженной злости и обиды.',
  'Проявлять тепло и нежность к людям мне неловко, даже когда это к месту.',
  'Показывать свои чувства другим для меня тяжело.',
  'Мне трудно раскрепоститься и вести себя свободно рядом с людьми.',
  'Я так себя сдерживаю, что со стороны могу казаться безэмоциональным.',
  'Меня нередко считают закрытым и зажатым человеком.',
  'Мне важно быть лучшим в том, чем занимаюсь; второе место меня не устраивает.',
  'Я стремлюсь довести всё до почти идеального состояния.',
  'Из-за гонки за результатом у меня почти не остаётся места для отдыха.',
  'Я чувствую себя обязанным выполнить всё, за что взялся.',
  'Ради своих высоких планок я часто отказываю себе в удовольствиях.',
  'Простить себе промах или найти ему оправдание мне очень сложно.',
  'Я постоянно тянусь быть максимально продуктивным и результативным.',
  'Когда мне отказывают, мне крайне трудно это принять.',
  'Любые ограничения и запреты вызывают во мне сильное раздражение.',
  'Правила, обязательные для всех, я не всегда считаю обязательными для себя.',
  'Увлёкшись своим, я легко забываю уделить время близким.',
  'Мне говорят, что я слишком стремлюсь всё держать под своим контролем.',
  'Я плохо переношу, когда мне указывают, как поступать.',
  'Однообразные, скучные дела мне почти не удаётся выполнять регулярно.',
  'Я нередко поддаюсь порыву, а после расплачиваюсь за это.',
  'Монотонность быстро меня утомляет, и я начинаю скучать.',
  'Когда дело усложняется, мне обычно не хватает упорства довести его до конца.',
  'Даже понимая необходимость, я с трудом заставляю себя делать неприятное.',
  'Свои же решения я часто не выдерживаю до конца.',
  'Я склонен действовать импульсивно и потом об этом жалеть.',
  'Мне важно, чтобы большинство знакомых относились ко мне хорошо.',
  'Я подстраиваю поведение под собеседника, чтобы понравиться.',
  'То, как я себя оцениваю, сильно зависит от мнения окружающих.',
  'Я немало стараюсь, чтобы заслужить одобрение значимых для меня людей.',
  'Вопрос, принимают ли меня другие, тревожит меня чрезмерно.',
  'Я скорее замечаю в жизни плохое, чем хорошее.',
  'Внутри почти всегда живёт ожидание, что что-то пойдёт не так.',
  'Мне кажется, трудностей впереди больше, чем поводов для радости.',
  'Без особого внимания к себе я начинаю чувствовать себя незначительным.',
  'Осторожности, по-моему, много не бывает — подвох возможен почти везде.',
  'Меня не отпускает мысль, что одно неверное решение способно всё разрушить.',
  'Ошибившись, я считаю, что заслуживаю за это наказания.',
  'Если я оступился, никаких оправданий для меня быть не может.',
  'Не справился — значит, должен без исключений понести последствия.',
  'Причина промаха для меня не так важна: сделал не так — отвечай.',
  'В глубине души я порой считаю себя плохим и достойным наказания.',
  'Тех, кто не держит обязательства, по-моему, стоит призвать к ответу.',
  'Когда люди оправдываются, я обычно вижу в этом лишь нежелание отвечать за себя.',
  'Даже после извинений обида во мне держится долго.',
  'Меня раздражает, когда человек ищет оправдания или сваливает вину на других.',
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
