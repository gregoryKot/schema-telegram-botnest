// Клиент GitHub REST для scripts/merge-queue.mjs: `call` отдаёт статус, `get` бросает на отказе.
export function client(api, token) {
  const call = async (method, path, body) => {
    const res = await fetch(api + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, ok: res.ok, data: text ? JSON.parse(text) : null };
  };
  const get = async (path) => {
    const r = await call('GET', path);
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    return r.data;
  };
  return { call, get };
}
