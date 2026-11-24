// Поезд очереди мержа: ≥2 отставших зелёных PR едут одной веткой — один круг CI
// и один мерж вместо N. Зовётся из merge-queue.mjs; выключатель — MERGE_TRAIN=on.
// Состояние — сам PR-поезд (ветка merge-train/*, автор — бот, состав в теле):
//   собран   — ветка и PR есть, auto-merge пассажиров снят; бейслайны пересчитывает
//              вторая джоба, отправляет третья (merge-train-depart.mjs);
//   в пути   — очередь ждёт только его; main ушёл, пассажир изменился или CI
//              красный — поезд распускается и собирается заново без выпавших;
//   приехал  — зелёный и свежий: squash, пассажиры закрыты комментарием.
// Правила — merge-train-plan.mjs, сборка ветки — merge-train-build.mjs.
import { appendFileSync } from 'fs';
import { trainApi } from './merge-train-api.mjs';
import { buildTrain, pushTrain } from './merge-train-build.mjs';
import { NO_TRAIN, TRAIN_PREFIX, blame, carsOf, isTrain, pickCars, squashTitle, trainBody, trainTitle, trainVerdict } from './merge-train-plan.mjs';

const RED = new Set(['failure', 'timed_out']);
const nums = (cars) => cars.map((c) => `#${c.number}`).join(', ');
const output = (line) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);

export function trainEngine({ call, get, R, on, dryRun, repoDir, scriptsDir }) {
  const api = trainApi({ call, R });

  /** Пассажир возвращается в обычную очередь: auto-merge, комментарий, виновному — метка. */
  const release = async (car, text, guilty) => {
    await api.autoMerge(car, true);
    await api.comment(car.number, text);
    if (guilty) await api.label(car.number, NO_TRAIN);
  };

  /** Собирает и открывает поезд; вошедшие пассажиры (пусто — поезда нет). */
  const assemble = async (picked) => {
    if (!repoDir) return [];
    if (dryRun) return console.log(`dry-run: собрал бы поезд из ${nums(picked)}`) ?? picked;
    const built = buildTrain({ repoDir, scriptsDir, cars: picked });
    for (const s of built.skipped) console.log(`#${s.number}: в поезд не вошёл (${s.why})`);
    if (built.reason) console.log(`::warning::поезд не собран: ${built.reason}`);
    // Первый по очереди не вошёл — его ведёт обычный путь, поезд его не обгоняет.
    if (!built.head || built.cars[0] !== picked[0]) return [];
    const branch = TRAIN_PREFIX + Date.now().toString(36);
    const cars = built.cars;
    const off = [];
    let number = 0;
    try {
      pushTrain(repoDir, built.head, branch);
      const pr = await call('POST', `${R}/pulls`, { title: trainTitle(cars), head: branch, base: 'main', body: trainBody(cars) });
      if (!pr.ok) throw new Error(`PR-поезд не открылся: HTTP ${pr.status}`);
      number = pr.data.number;
      // Auto-merge снимается до отправления (одобрения CI), но после PR: состав уже
      // записан в его теле, и оборванный прогон не оставит пассажира без auto-merge молча.
      for (const c of cars.filter((x) => x.auto)) {
        if (!(await api.autoMerge(c, false))) throw new Error(`auto-merge #${c.number} не снят`);
        off.push(c);
      }
      output(`train_pr=${number}`);
      output(`train_ref=${branch}`);
      console.log(`Поезд #${number} собран: ${nums(cars)}`);
      return cars;
    } catch (e) {
      console.log(`::warning::${String(e.stderr || e.message).trim().split('\n').pop()} — пассажиры идут обычным путём`);
      if (number) await api.close(number);
      await api.dropBranch(branch);
      for (const c of off) await api.autoMerge(c, true);
      return [];
    }
  };

  /**
   * Закрытый поезд. Смержен: пассажир с той же головой закрывается. Остальным
   * открытым пассажирам без auto-merge (новые коммиты, поезд закрыт руками,
   * прогон оборвался) он возвращается — раз: с auto-merge PR сюда не попадает.
   */
  const arrive = async (train, open, riding) => {
    for (const c of carsOf(train.body)) {
      const raw = open.find((p) => p.number === c.number);
      if (!raw || riding.has(c.number)) continue;
      if (train.merged_at && raw.head.sha === c.sha) {
        await api.comment(c.number, `Смержено в составе поезда #${train.number}.`);
        if (await api.close(c.number)) await api.dropBranch(raw.head.ref);
      } else if (!raw.auto_merge && !raw.draft && !raw.labels.some((l) => l.name === 'do-not-merge') && (await api.autoMerge({ number: c.number, node: raw.node_id }, true))) {
        const why = train.merged_at ? `вошла голова ${c.sha.slice(0, 7)}, коммиты после неё не смержены` : 'PR не вошёл';
        await api.comment(c.number, `Поезд #${train.number} закрыт: ${why} — PR идёт обычным путём, auto-merge возвращён.`);
      }
    }
  };

  /** Файлы, названные в аннотациях упавших проверок поезда, и имена этих проверок. */
  const failures = async (train) => {
    const failed = train.runs.filter((r) => RED.has(r.conclusion)).slice(0, 5);
    const paths = [];
    for (const r of failed) {
      const notes = await get(`${R}/check-runs/${r.id}/annotations?per_page=50`);
      paths.push(...notes.map((a) => a.path).filter((p) => p && p !== '.github'));
    }
    return { paths, names: failed.map((r) => r.name).join(', ') };
  };

  /** Открытый поезд: 'done' — прогон занят им, 'ride' — очередь ждёт только его, 'walk' — распущен, null — поезда нет. */
  const drive = async (prs, open) => {
    // Закрытые поезда доводятся здесь: смерженный без нас, закрытый руками, оборванный прогон.
    const closed = await get(`${R}/pulls?state=closed&base=main&sort=updated&direction=desc&per_page=20`);
    const riding = new Set(open.filter(isTrain).flatMap((t) => carsOf(t.body).map((c) => c.number)));
    if (!dryRun) for (const t of closed.filter(isTrain)) await arrive(t, open, riding);
    const train = prs.find((p) => p.train);
    if (!train) return null;
    const cars = carsOf(train.body).map((c) => ({ ...c, ...prs.find((p) => p.number === c.number && p.sha === c.sha) }));
    const v = trainVerdict(train, cars, prs, Date.now(), on);
    if (v.act === 'ride') return 'ride';
    if (dryRun) return console.log(`dry-run: поезд #${train.number} — ${v.act}${v.why ? ` (${v.why})` : ''}`) ?? 'done';
    const alive = cars.filter((c) => !v.gone.includes(c));
    if (v.act === 'merge') {
      const r = await call('PUT', `${R}/pulls/${train.number}/merge`, { merge_method: 'squash', commit_title: squashTitle(cars, train.number), sha: train.sha });
      if (!r.ok) return console.log(`::warning::поезд #${train.number}: мерж HTTP ${r.status} — следующий прогон повторит`) ?? 'done';
      console.log(`Поезд #${train.number} смержен: ${nums(cars)}`);
      await arrive({ number: train.number, body: train.body, merged_at: true }, open, new Set());
      // Мерж от GITHUB_TOKEN событие push не порождает — следующий круг очереди зовём сами.
      await call('POST', `${R}/actions/workflows/merge-queue.yml/dispatches`, { ref: 'main' });
      return 'done';
    }
    let out = { guilty: [], split: [] };
    let names = '';
    if (v.red) {
      const f = await failures(train);
      const filesOf = {};
      for (const c of alive) filesOf[c.number] = (await get(`${R}/pulls/${c.number}/files?per_page=100`)).map((x) => x.filename);
      out = blame(alive, filesOf, f.paths);
      names = f.names;
    }
    const tag = `Поезд #${train.number}`;
    await api.comment(train.number, `Поезд распущен: ${v.why}.`);
    if (await api.close(train.number)) await api.dropBranch(train.branch);
    console.log(`${tag} распущен: ${v.why}`);
    for (const c of v.gone) {
      const raw = open.find((p) => p.number === c.number);
      if (raw) await release({ number: c.number, node: raw.node_id }, `${tag}: PR изменился в пути и вышел из поезда — идёт обычным путём.`);
    }
    for (const c of out.guilty) {
      await release(c, `${tag} красный (${names}), PR вышел из поезда и идёт обычным путём. Метка \`${NO_TRAIN}\` не пускает его в следующие поезда — сними её после починки.`, true);
    }
    for (const c of out.split) await release(c, `${tag} красный (${names}), виновный не найден: состав разделён, PR возвращён в обычную очередь.`);
    const rest = alive.filter((c) => !out.guilty.includes(c) && !out.split.includes(c));
    const again = v.act === 'rebuild' && rest.length >= 2 ? await assemble(rest) : [];
    for (const c of rest.filter((x) => !again.includes(x))) await release(c, `${tag} распущен (${v.why}) — PR идёт обычным путём.`);
    // Распущенные в этом прогоне в новый поезд не садятся: их данные (метки, auto-merge) уже устарели.
    return again.length ? 'done' : 'walk';
  };

  return {
    /** PR, которые видит очередь: поезд и его пассажиры — и без auto-merge. */
    riders(open) {
      const train = open.find(isTrain);
      const keep = new Set(train ? [train.number, ...carsOf(train.body).map((c) => c.number)] : []);
      return open.map((p) => (keep.has(p.number) && !p.auto_merge ? { ...p, auto_merge: {}, kept: true } : p));
    },
    drive,
    /** Отставших зелёных ≥2 — поезд вместо одиночного update-branch; true — прогон занят. */
    board: async (candidates) => {
      const picked = on ? pickCars(candidates) : [];
      return picked.length >= 2 && (await assemble(picked)).length > 0;
    },
  };
}
