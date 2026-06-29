// Словарь ru→en для игрового текста. Ключ = русская строка как она доходит до
// вывода (с реальными \n). tr() (i18n.ts) подставляет английскую при lang==='en',
// иначе/если нет в словаре — возвращает русскую. Точки вывода (say/storyFrame/
// нарратив/развязки) пропущены через tr(), поэтому реплики врагов тоже переводятся.

export const EN: Record<string, string> = {
  // ── Пролог: управление и подсказки ──
  'A D идти · W прыжок': 'A D move · W jump',
  '◀ ▶ идти · ▲ прыжок': '◀ ▶ move · ▲ jump',
  'Z (тап) — рывок, увернись': 'Z (tap) — dash, dodge',
  'Z (держи) — залипни, отвлекись': 'Z (hold) — zone out, distract',
  'X — вырубить будильник': 'X — smash the alarm',
  'V — уступи, сдайся': 'V — give in, surrender',
  'E / клик — дальше': 'E / click — next',
  'любая клавиша — дальше': 'any key — next',
  'тапни — дальше': 'tap — next',
  'тапни': 'tap',
  'пропустить →': 'skip →',
  'пойдём — посмотрим на эти три способа': "let's go — see those three ways",
  'ИЗБЕГАЙ (тап) — рывок': 'AVOID (tap) — dash',
  'ИЗБЕГАЙ (держи) — залипни': 'AVOID (hold) — zone out',
  'ИЗБЕГАЙ — рывком проскользнуть мимо': 'AVOID — dash past it',
  'ИЗБЕГАЙ (держи) — отвлечься, и отступят': 'AVOID (hold) — distract, and they back off',
  'БЕЙ — вырубить, дать отпор': 'FIGHT — smash it, push back',
  'БЕЙ — по будильнику': 'FIGHT — hit the alarm',
  'УСТУПИ — сдайся': 'SURRENDER — give in',
  'УСТУПИ — согласиться, лишь бы отстали': 'SURRENDER — just say yes so they leave',
  'БЕЙ · ИЗБЕГАЙ · УСТУПИ\n\n...должно хватать. да?': 'FIGHT · AVOID · SURRENDER\n\n...should be enough. right?',

  // ── Пролог: повествование ──
  'Это кот Мистер.\nЖивёт, всем доволен.': "This is Mister the cat.\nLives his life, content.",
  'Когда накрывает, Мистер справляется\nтремя способами. Так научили —\nи это нормально.\n\n♥ слева — его силы. борьба их тратит.':
    "When it hits, Mister copes\nin three ways. That's how he learned —\nand that's okay.\n\n♥ on the left — his strength. fighting drains it.",
  'Понедельник. Дел — целая гора.\nМистер боится, что не успеет.\n\nКогда наваливается — можно увернуться.':
    "Monday. A mountain of tasks.\nMister is scared he won't make it.\n\nWhen it piles up — you can dodge.",
  'Ночь. В голове крутятся тревоги —\nне уснуть. Их не побить и не обогнать.\n\nМожно отвлечься, переждать.':
    "Night. Worries spin in his head —\ncan't sleep. Can't fight or outrun them.\n\nYou can distract yourself, wait it out.",
  'Утро. Будильник орёт и не унимается.\nЖуть как бесит.\n\nИногда хочется просто врезать.':
    "Morning. The alarm screams on and on.\nSo infuriating.\n\nSometimes you just want to hit something.",
  'Вечер. Соседка снова просит об одолжении.\nОтказать — неловко.\n\nПроще согласиться, лишь бы отстали.':
    "Evening. The neighbour asks for a favour again.\nSaying no feels awkward.\n\nEasier to agree, just to be left alone.",

  // ── Пролог: реплики на «не ту» кнопку (ДЕЛА) ──
  'по делам не ударишь — их только больше.': "you can't punch tasks — there only get more.",
  'бить бумаги? их не убавится.': 'hit the papers? they won\'t shrink.',
  'злись не злись — задачи не разбегутся.': "angry or not — the tasks won't scatter.",
  'кулаком отчёт не сдашь.': "you can't fist your way through a report.",
  'агрессия их не уберёт, только вымотает.': "aggression won't clear them, just drain you.",
  'дела не дерутся в ответ — просто ждут.': "tasks don't fight back — they just wait.",
  'сдаться делам? они и так на тебе.': 'surrender to the tasks? they\'re already on you.',
  'кому уступать — стопке бумаг?': 'give in — to a stack of paper?',
  'покорно сесть под ними — раздавят.': "sit meekly under them — they'll crush you.",
  'это не человек, уступать некому.': "it's not a person, no one to give in to.",
  'смирение дедлайн не подвинет.': "surrender won't move the deadline.",
  'замрёшь — дела сами себя не сделают.': "freeze — and tasks won't do themselves.",
  'залипнешь — гора только вырастет.': 'zone out — the pile only grows.',
  'отвлечёшься — дедлайн ближе.': 'distract yourself — the deadline gets closer.',
  'спрячешься в телефон — они дождутся.': "hide in the phone — they'll wait you out.",
  'застынешь — завтра их вдвое.': "freeze up — twice as many tomorrow.",
  'дела навалились! только рывок (Z) спасает.': 'the tasks piled on! only a dash (Z) saves you.',

  // ── Пролог: реплики на «не ту» кнопку (ТРЕВОГИ) ──
  'тревогу не ударишь — она внутри.': "you can't hit anxiety — it's inside.",
  'бить свои мысли? станет хуже.': 'fight your own thoughts? it gets worse.',
  'кулаком страх не выгонишь.': "you can't punch out fear.",
  'злость на тревогу — та же тревога.': 'anger at anxiety is just more anxiety.',
  'по переживаниям не попасть.': "you can't land a hit on worries.",
  'сдаться страху — он накроет с головой.': "surrender to fear — it swallows you whole.",
  'уступишь тревоге — она будет править.': "give in to anxiety — it takes over.",
  'покорность мыслям их не уймёт.': "submission won't quiet the thoughts.",
  'кому уступать — голосу в голове?': 'give in — to a voice in your head?',
  'согласишься с тревогой — поверишь ей.': "agree with anxiety — and you'll believe it.",
  'от своей головы не убежишь.': "you can't outrun your own head.",
  'бежишь — а мысли бегут с тобой.': 'you run — the thoughts run with you.',
  'рывок? тревога догонит на месте.': 'dash? anxiety catches you where you stand.',
  'сменишь комнату — мысли те же.': 'change rooms — same thoughts.',
  'быстрее ног они всё равно в голове.': "faster than your legs — they're in your head.",

  // ── Пролог: реплики на «не ту» кнопку (БУДИЛЬНИК) ──
  'убежал в другую комнату — всё равно слышно.': 'ran to another room — still hear it.',
  'рывком звон не выключишь.': "a dash won't switch off the ringing.",
  'спрячешься — орёт дальше.': 'hide — it keeps blaring.',
  'от будильника не убегают — он везде.': "you don't run from an alarm — it's everywhere.",
  'сбежишь — опоздаешь ещё и проспав.': "run — and you'll oversleep and be late too.",
  'отвлечься? оно ОРЁТ прямо в ухо.': "distract yourself? it's SCREAMING in your ear.",
  'залипнешь — звонит и звонит.': 'zone out — it rings and rings.',
  'замри хоть весь — звон не стихнет.': "freeze all you like — the ringing won't stop.",
  'в телефон? будильник громче.': 'into the phone? the alarm is louder.',
  'переждать не выйдет — он не устаёт.': "you can't wait it out — it never tires.",
  'уступить будильнику? это как?': 'surrender to an alarm? how exactly?',
  'сдаться звону — он не человек.': "give in to the ringing — it's not a person.",
  'покориться железке — звенит дальше.': "submit to a gadget — it keeps ringing.",
  'смирение его не выключит.': "surrender won't turn it off.",

  // ── Пролог: реплики на «не ту» кнопку (СОСЕДКА) ──
  'рявкнуть на соседку? ...язык не повернулся.': "snap at the neighbour? ...couldn't bring myself to.",
  'нагрубить ей — потом стыдно неделю.': "be rude to her — then ashamed for a week.",
  'злость на неё — не смог, воспитанный же.': "anger at her — couldn't, too well-raised.",
  'накричать? а жить с ней дальше.': 'yell at her? but we still live next door.',
  'огрызнуться — рука не поднялась.': "snap back — just couldn't.",
  'сорвёшься — будешь виноват сам.': "lose it — and you'll be the one to blame.",
  'сбежать? она догонит — она же соседка.': "run? she'll catch up — she's the neighbour.",
  'захлопнуть дверь — неудобно как-то.': 'slam the door — feels rude somehow.',
  'улизнуть — а завтра в лифте встречать.': 'slip away — meet her in the lift tomorrow.',
  'рывок? она просто придёт снова.': "dash? she'll just come back.",
  'спрячешься — постучит ещё раз.': "hide — she'll knock again.",
  'играю, не вижу... а она всё ждёт.': "playing, not looking... but she keeps waiting.",
  'сделать вид что нет дома — она слышит.': "pretend you're out — she can hear.",
  'залипнуть в телефон — не уйдёт.': "zone into the phone — she won't leave.",
  'отвернуться — стоит и смотрит.': "turn away — she stands and stares.",
  'тянуть время — она терпеливее.': "stall — she's more patient.",

  // ── Пролог: соседка давит на вину ──
  'ты же не откажешь?': "you won't refuse, will you?",
  'я на тебя рассчитываю...': "I'm counting on you...",
  'тебе что, трудно?': "is it really so hard for you?",
  'все бы согласились.': 'anyone would say yes.',
  'ну что тебе стоит.': "it's no trouble for you.",
  'я ведь обижусь.': "I'll be hurt, you know.",

  // ── Пролог: сценки/исходы ──
  '...фух. рывком — мимо. (но завтра снова)': "...phew. dashed past. (but again tomorrow)",
  'клубок важнее. а мысли... отстали?': 'the yarn matters more. and the thoughts... backed off?',
  'ДЗЗ-ДЗЗ-ДЗЗ!': 'RING-RING-RING!',
  'ВСТАВАЙ!': 'WAKE UP!',
  'ДЗЗЗЗ!': 'RIIING!',
  'ХРЯСЬ!': 'WHAM!',
  'ХРЯСЬ! ...тишина. наконец-то.': 'WHAM! ...silence. finally.',
  '«конечно... давайте ваш фикус»': '"sure... bring your plant over"',
  'уступил. все довольны — кроме Мистера. −1 жизнь.': 'gave in. everyone happy — except Mister. −1 life.',

  // ── Главы: названия / таглайны / развязки ──
  'Обычный день': 'An Ordinary Day',
  'Дома': 'Home',
  'Само пройдёт': "It'll Pass",
  'вечер. просто дойти до дома.': 'evening. just make it home.',
  'дома. но отдыха нет.': "home. but no rest.",
  'понял, что так нельзя. и тут же — «да ладно, не сегодня».': 'realised this can\'t go on. and at once — "eh, not today".',
  'Ты дрался. Бежал. Замирал.': 'You fought. Ran. Froze.',
  'Критик всё равно догонял.': 'The Critic caught up anyway.',
  'Он — твоя же тень.\nИ бил больнее всех.': 'It\'s your own shadow.\nAnd it hit the hardest.',
  'Одному с этим не справиться.': "You can't handle this alone.",
  'И не нужно. Этому учит терапия.': "And you don't have to. That's what therapy teaches.",
  'Дом должен был быть отдыхом.': 'Home was supposed to be rest.',
  'Но вечер сожрал телефон.': 'But the phone ate the evening.',
  'Диван держал. Злость жгла.': 'The couch held on. Anger burned.',
  'Ты не ленивый. Не сломанный.': "You're not lazy. Not broken.",
  'Просто слишком давно — один.': 'Just alone for far too long.',
  'Дальше — туда, где это началось.': 'Onward — to where it began.',
  'Самый хитрый враг не нападал.': "The slyest enemy never attacked.",
  'Он просто шептал: не сегодня.': 'It just whispered: not today.',
  'И день за днём — мимо.': 'And day after day — slips by.',
  'Пока не скажешь честно: пора.': "Until you say it honestly: it's time.",
  'весь вечер... опять в никуда.': 'the whole evening... wasted again.',
  'сколько можно... я так больше не могу.': "how long can this go on... I can't anymore.",
  'опять отговорил себя. ещё один день — мимо.': "talked myself out again. another day — gone.",

  // ── Имена врагов (стоп-кадры) ──
  'ТРЕВОГА': 'ANXIETY',
  'ПРОКРАСТИНАЦИЯ': 'PROCRASTINATION',
  'ТЕЛЕФОН': 'THE PHONE',
  'РАЗДРАЖЕНИЕ': 'IRRITATION',
  'ВНУТРЕННИЙ КРИТИК': 'THE INNER CRITIC',
  'САМО ПРОЙДЁТ': "IT'LL PASS",
  'КРИВОЕ ЗЕРКАЛО': 'THE CROOKED MIRROR',
  'Тревога': 'Anxiety',
  'Карающий Родитель': 'Punitive Parent',
  'Отстранённый Защитник': 'Detached Protector',

  // ── Враги: интро-описания и реплики ──
  'бьёшь — делится. избегаешь — отступит.\nно совсем не уходит.':
    'hit it — it splits. avoid — it backs off.\nbut it never truly leaves.',
  'липнет, тянет вниз.\nрывок снимает — на время.':
    'it clings, drags you down.\na dash shakes it — for a while.',
  'тянет в уют, крадёт время.\nвырубишь ударом — загорится снова.':
    'lures you into comfort, steals time.\nhit it off — it lights up again.',
  'вспыхивает из ничего.\nвыпустишь пар — вскипит опять.':
    'flares out of nowhere.\nblow off steam — it boils up again.',
  'тень Мистера. ходит следом, не отстаёт.\n\n': "Mister's shadow. follows you, never lags.\n\n",
  'рявкнешь (X) — притихнет на миг и станет громче.\n': 'snap (X) — it quiets a moment, then grows louder.\n',
  'убегаешь — растёт за спиной.\n': 'run — it grows behind your back.\n',
  'это ты сам. от себя не отмахнуться.': "it's you. you can't wave yourself away.",
  'не нападает — убаюкивает.\nзалипнешь рядом — уснёшь, −сердце.\nне слушай, просто пройди мимо.':
    "it doesn't attack — it lulls you.\nzone out near it — you fall asleep, −heart.\ndon't listen, just walk past.",
  'показывает приукрашенного тебя:\n«да всё норм». перегораживает путь.\nЗАМРИ (держи Z) — посмотри честно.':
    'shows a flattering you:\n"all fine". it blocks the way.\nFREEZE (hold Z) — look honestly.',

  // ── Враги: бой/исходы (тревога, прокрастинация, телефон, раздражение, критик) ──
  'бить бесполезно — их только больше!': "hitting is useless — there's only more!",
  'отступает... но она вернётся.': 'it backs off... but it will return.',
  'что-то... тянет вниз. двигаться лень.': 'something... drags you down. too lazy to move.',
  'мягкая... удар вязнет. лучше движение.': 'soft... the hit sinks in. movement is better.',
  'лупишь по ней — чуть отпускает. себя же бьёшь.': "you beat at it — eases a bit. you're hitting yourself.",
  'рывок — и отлипло. на чуть-чуть.': 'a dash — and unstuck. for a little while.',
  'залип ещё глубже — вот что её кормит.': "stuck even deeper — that's what feeds it.",
  'оторвался. но лень ещё вернётся.': "broke free. but the laziness will be back.",
  'одну минутку, только гляну...': 'just a minute, only a quick look...',
  '...два часа?! куда они делись?': '...two hours?! where did they go?',
  'погас... и снова загорелся. рука сама тянется.': 'went dark... and lit up again. the hand reaches on its own.',
  'выключил... до следующего «дзынь».': "switched off... until the next ping.",
  'жжётся! откуда столько злости?': "it burns! where's all this anger from?",
  'замер — а оно всё равно жжёт!': 'froze — and still it burns!',
  'выпустил пар! ...а оно снова вскипает.': 'let off steam! ...and it boils up again.',
  'задолбал... оседает. но это ненадолго.': "worn out... it settles. but not for long.",
  'выдохся... отпустило. до следующего раза.': 'spent... it let go. until next time.',
  'опять?! я же только что выдохнул...': "again?! I just caught my breath...",
  'рявкнул — притих. и стал громче. с собой не поспоришь.': "snapped — it hushed. then grew louder. you can't argue with yourself.",
  'убегаю — а он за спиной только громче...': 'I run — and behind me it only gets louder...',
  'клубок?! он же прямо ЗА тобой!': 'the yarn?! it\'s right BEHIND you!',
  '...вернулся. они всегда возвращаются.': '...it came back. they always come back.',
  '«ты опять не справился». чем ни ответь — он рядом.': '"you failed again." whatever you do — it\'s right there.',
  'ты опять не справился.': 'you failed again.',
  'все смогли. кроме тебя.': 'everyone managed. except you.',
  'я же говорил — не выйдет.': "told you — it won't work.",
  'и так каждый раз.': 'every single time.',
  'соберись уже.': 'pull yourself together.',
  'кому ты такой нужен.': 'who needs you like this.',
  'опять всё испортил.': 'ruined it again.',
  'стыдно должно быть.': 'you should be ashamed.',

  // ── Враги Акта II: Само-Пройдёт, Кривое зеркало ──
  'да всё нормально... у других хуже.': "it's all fine... others have it worse.",
  'по ней не ударишь — она просто баюкает.': "you can't hit it — it just lulls you.",
  '...задремал. и день прошёл.': '...dozed off. and the day was gone.',
  'прошёл мимо, не уснул. идём дальше.': "walked past, didn't fall asleep. onward.",
  'мимо не пройти. ЗАМРИ (держи Z) — посмотри честно.': "can't get past. FREEZE (hold Z) — look honestly.",
  '«да всё же норм. ты в порядке»...': '"come on, it\'s fine. you\'re okay"...',
  'смотрю честно... и правда не так уж «норм».': "looking honestly... and it's really not so \"fine\".",
  'отвернулся — и снова поверил, что норм.': 'turned away — and believed again it was fine.',
  'разбить зеркало? будешь врать себе и дальше.': "smash the mirror? you'll keep lying to yourself.",
  'увидел честно. остановиться и посмотреть —\nэто не слабость, а смелость. вот с этого и начинается.':
    "saw it honestly. to stop and look —\nthat's not weakness, it's courage. this is where it starts.",
  'надо что-то менять... или нет?': "I need to change something... or not?",
  'ну вот, уже легче. может, само и пройдёт?': "see, easier already. maybe it'll just pass?",

  // ── Гейты / общие реплики ──
  'не пройти. сначала — с этим.': "can't pass. deal with this first.",
  '...отпустило. ненадолго.': '...it let go. not for long.',
  'пока залип — не достают. но и не уйду.': "while zoned out — they can't reach me. but I'm stuck too.",
  'уступать... да некому пока.': 'surrender... but there\'s no one to yet.',
  'уступил — и тень отстала. пока что.': 'gave in — and the shadow backed off. for now.',
  '«ладно-ладно, как скажете...» — и правда отстали. но чего это стоило.':
    '"fine, fine, whatever you say..." — and they did back off. but at what cost.',
  'ай! да я ничего не могу — только бежать!': "ow! I can't do anything — just run!",

  // ── Сбор/жизни/падение ──
  'тёплое... хорошее тоже есть. собери их.': "warm... good things exist too. gather them.",
  'все тёплые мысли с тобой. их тоже стоит замечать.': 'every warm thought is with you. those are worth noticing too.',
  'сорвался... −1 жизнь.': 'fell... −1 life.',

  // ── Финал: game over / реализация / контакт ──
  'так больше нельзя...': "this can't go on...",
  'но это лишь попытка. вставай.': "but it's only a try. get up.",
  'клавиша / клик — ещё раз': 'key / click — try again',
  'нажми любую клавишу': 'press any key',
  'тапни — ещё раз': 'tap — try again',
  'бил, бежал, уступал — он всё равно тут.\nостался один ход: повернуться к нему.':
    "fought, ran, gave in — it's still here.\none move left: turn to face it.",
  'E / клик — ПОВЕРНУТЬСЯ': 'E / click — TURN TO IT',
  'тапни — ПОВЕРНУТЬСЯ': 'tap — TURN TO IT',
  'это — Карающий Родитель.\nчужой голос, что тебя стыдил.\n\n':
    'this is the Punitive Parent.\na borrowed voice that shamed you.\n\n',
  'это — Отстранённый Защитник.\nуводил в телефон, лишь бы не чувствовать.\n\n':
    "this is the Detached Protector.\nit pulled you into the phone, anything but feeling.\n\n",
  'ты повернулся — и он сел рядом, а не навис.\nодному так не суметь. этому учит терапия.':
    "you turned — and it sat beside you, not above.\nyou couldn't do this alone. that's what therapy teaches.",
  'ты повернулся — и он рядом, а не сверху.\nна миг, но по-другому.':
    'you turned — and it\'s beside you, not above.\nfor a moment, but different.',

  // ── HUD / CTA / развилка ──
  'X бей · Z избегай (тап рывок / держи залипни) · V уступи':
    'X fight · Z avoid (tap dash / hold zone out) · V surrender',
  'так дальше — нельзя.': "this can't go on.",
  'и Мистер впервые подумал:\n«может... пора за помощью?»':
    'and for the first time Mister thought:\n"maybe... it\'s time to get help?"',
  'или — идти дальше за Мистером →': 'or — keep going with Mister →',
  'узнать про схема-терапию →': 'learn about schema therapy →',
  '🐈‍⬛  ты прошёл сквозь свою голову.': '🐈‍⬛  you ran through your own mind.',
  'твой главный враг —': 'your biggest enemy —',
  'его не одолеть в одиночку.\nно рядом — можно. дальше — терапия.':
    "you can't beat it alone.\nbut with someone — you can. next: therapy.",
  'поделиться →': 'share →',
  'или — в меню': 'or — back to menu',

  // ── Чат-вопросы по дому ──
  'дома. наконец выдохнуть... да?': 'home. finally a breath... right?',
  'почему дома — тяжелее всего?': 'why is home the hardest of all?',
  'опять это чувство...': 'that feeling again...',
  'всё ещё за спиной.': 'still right behind you.',
};
