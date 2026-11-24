// Записи поезда в GitHub: auto-merge (только GraphQL), комментарий, метка,
// закрытие PR, удаление ветки. Отказ записи — предупреждение, не падение:
// прогон обязан дойти до конца и вернуть пассажирам auto-merge.
const AUTO_ON = 'mutation($id: ID!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: SQUASH }) { clientMutationId } }';
const AUTO_OFF = 'mutation($id: ID!) { disablePullRequestAutoMerge(input: { pullRequestId: $id }) { clientMutationId } }';

export function trainApi({ call, R }) {
  const soft = async (what, res) => {
    const r = await res;
    const err = r.data?.errors?.[0]?.message;
    if (!r.ok || err) console.log(`::warning::${what}: ${err ?? `HTTP ${r.status}`}`);
    return r.ok && !err;
  };
  return {
    /** Включает или снимает auto-merge; true — получилось. */
    autoMerge: (pr, on) =>
      soft(
        `auto-merge #${pr.number} ${on ? 'не вернулся' : 'не снят'}`,
        call('POST', '/graphql', { query: on ? AUTO_ON : AUTO_OFF, variables: { id: pr.node } }),
      ),
    comment: (number, body) => soft(`комментарий в #${number}`, call('POST', `${R}/issues/${number}/comments`, { body })),
    label: (number, name) => soft(`метка ${name} на #${number}`, call('POST', `${R}/issues/${number}/labels`, { labels: [name] })),
    close: (number) => soft(`закрытие #${number}`, call('PATCH', `${R}/pulls/${number}`, { state: 'closed' })),
    dropBranch: (branch) => soft(`удаление ветки ${branch}`, call('DELETE', `${R}/git/refs/heads/${branch}`)),
  };
}
