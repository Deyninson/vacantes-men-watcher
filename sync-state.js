/** Persistencia del estado en el repositorio de GitHub (para GitHub Actions).
 *  Los runners son efímeros: guardamos state.json en la rama por defecto vía REST API. */

function headers() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'VacantesWatcher',
  };
}

function repoUrl() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('Falta GITHUB_REPOSITORY');
  return `https://api.github.com/repos/${repo}/contents/state.json`;
}

async function loadRemoteState() {
  const url = repoUrl();
  const res = await fetch(url, { headers: headers() });
  if (res.status === 404) {
    return { state: { seen: {}, lastCheck: null }, sha: null };
  }
  if (!res.ok) throw new Error(`GitHub GET state.json: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const raw = Buffer.from(data.content || '', 'base64').toString('utf8').replace(/^\uFEFF/, '');
  let state;
  try { state = JSON.parse(raw); } catch (_) { state = { seen: {}, lastCheck: null }; }
  state.seen = state.seen || {};
  return { state, sha: data.sha };
}

async function saveRemoteState(state, sha) {
  const url = repoUrl();
  const content = Buffer.from(JSON.stringify(state, null, 2), 'utf8').toString('base64');
  const body = {
    message: `chore: actualizar estado vacantes [skip ci] ${new Date().toISOString()}`,
    content,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub PUT state.json: ${res.status} ${await res.text()}`);
}

module.exports = { loadRemoteState, saveRemoteState };
