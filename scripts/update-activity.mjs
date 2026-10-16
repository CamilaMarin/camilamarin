import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const START = '<!--RECENT_ACTIVITY:start-->';
const END = '<!--RECENT_ACTIVITY:end-->';
export function renderActivity(events, username = 'CamilaMarin') {
  if (!Array.isArray(events)) throw new Error('La respuesta de actividad no es una lista.');
  const lines = [];
  const seen = new Set();
  for (const event of events) {
    const repo = event?.repo?.name;
    if (event?.public !== true || event.actor?.login?.toLowerCase() !== username.toLowerCase()
      || typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)
      || repo.toLowerCase() === `${username}/${username}`.toLowerCase()) continue;
    const payload = event.payload ?? {};
    let verb;
    switch (event.type) {
      case 'PushEvent': verb = 'Actualicé código en'; break;
      case 'CreateEvent': verb = 'Creé ' + (payload.ref_type === 'repository' ? 'el repositorio' : 'una referencia en'); break;
      case 'PullRequestEvent':
        if (!['opened', 'closed', 'reopened'].includes(payload.action)) continue;
        verb = payload.pull_request?.merged ? 'Integré una pull request en' : payload.action === 'closed' ? 'Cerré una pull request en' : 'Abrí una pull request en'; break;
      case 'IssuesEvent':
        if (!['opened', 'closed', 'reopened'].includes(payload.action)) continue;
        verb = payload.action === 'closed' ? 'Cerré un issue en' : 'Abrí un issue en'; break;
      case 'ReleaseEvent':
        if (payload.action !== 'published') continue;
        verb = 'Publiqué una versión de'; break;
      default: continue;
    }
    const key = `${verb}:${repo.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${verb} [${repo}](https://github.com/${repo}).`);
    if (lines.length === 5) break;
  }
  return lines.join('\n') || 'No hay actividad pública reciente para mostrar.';
}
export function replaceActivity(readme, content) {
  const start = readme.indexOf(START), end = readme.indexOf(END);
  if (start < 0 || end < start || readme.indexOf(START, start + START.length) !== -1
    || readme.indexOf(END, end + END.length) !== -1) throw new Error('Marcadores de actividad ausentes o duplicados.');
  return readme.slice(0, start + START.length) + '\n' + content + '\n' + readme.slice(end);
}
export async function fetchPublicEvents(username, token, request = fetch) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'profile-activity' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await request(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, { headers, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`No se pudo consultar actividad pública (HTTP ${response.status}).`);
  const events = await response.json();
  if (!Array.isArray(events)) throw new Error('Formato inesperado de la API.');
  return events;
}
async function main() {
  const events = await fetchPublicEvents('CamilaMarin', process.env.GITHUB_TOKEN);
  const path = process.argv[2] ?? 'README.md';
  const readme = await readFile(path, 'utf8');
  const next = replaceActivity(readme, renderActivity(events));
  if (next !== readme) await writeFile(path, next);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
