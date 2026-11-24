#!/usr/bin/env node
// Отправление поезда — третья джоба merge-queue.yml. Вторая (без права записи)
// собрала дерево поезда и пересчитала бейслайны штатным `--update`; сюда
// приходит её патч. Он коммитится в ветку поезда, прогон CI на итоговой голове
// получает одобрение. Патча нет (сборка упала) — поезд уходит как есть: CI скажет сам.
//
//   TRAIN_PR=123 TRAIN_PATCH=<base64 git diff> node scripts/merge-train-depart.mjs
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { client } from './merge-queue-api.mjs';
import { queueSteps } from './merge-queue-steps.mjs';
import { applyBaselines } from './merge-train-build.mjs';
import { isTrain } from './merge-train-plan.mjs';

const PATCH_MAX = 200_000;

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const number = Number(process.env.TRAIN_PR);
  const repoDir = process.env.MERGE_QUEUE_GIT_DIR;
  if (!repo || !token || !number) throw new Error('нужны GITHUB_REPOSITORY, GITHUB_TOKEN и TRAIN_PR');
  const { call, get } = client(process.env.GITHUB_API_URL || 'https://api.github.com', token);
  const R = `/repos/${repo}`;
  const { settle } = queueSteps({ call, get, R, repo, pollMs: Number(process.env.MERGE_QUEUE_POLL_MS ?? 5000) });

  const pr = await get(`${R}/pulls/${number}`);
  if (pr.state !== 'open' || !isTrain(pr)) return console.log(`#${number}: не открытый поезд — отправлять нечего`);
  let head = pr.head.sha;
  const patch = Buffer.from(process.env.TRAIN_PATCH ?? '', 'base64').toString('utf8');
  if (!patch.trim()) console.log(`Поезд #${number}: бейслайны без изменений`);
  else if (!repoDir || patch.length > PATCH_MAX) console.log(`::warning::поезд #${number}: патч бейслайнов не применён (нет клона или патч больше ${PATCH_MAX} знаков)`);
  else {
    const r = applyBaselines({ repoDir, scriptsDir: dirname(fileURLToPath(import.meta.url)), branch: pr.head.ref, sha: head, patch });
    if (r.head) head = r.head;
    else console.log(`::warning::поезд #${number}: бейслайны не пересчитаны (${r.reason})`);
  }
  await settle({ number, sha: pr.head.sha, behind: 0 }, head, 'поезд отправлен');
}

main().catch((e) => {
  console.error(`::error::merge-train-depart: ${e.message}`);
  process.exit(1);
});
