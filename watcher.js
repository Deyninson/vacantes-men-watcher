/**
 * Vigilante de vacantes del Sistema Maestro (MEN)
 * - Revisa las vacantes publicadas hoy
 * - Revisa las vacantes disponibles de Matemáticas y Tecnología e informática
 * - Avisa por Telegram solo de las que aún no ha visto
 *
 * Uso:
 *   node watcher.js            -> ejecuta y envía por Telegram
 *   node watcher.js --dry-run  -> ejecuta pero NO envía (solo log)
 *   node watcher.js --dump     -> guarda el HTML crudo de las rejillas en dumps/
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { loadRemoteState, saveRemoteState } = require('./sync-state');

const DIR = __dirname;
const CONFIG_PATH = path.join(DIR, 'config.json');
const STATE_PATH = path.join(DIR, 'state.json');
const LOG_PATH = path.join(DIR, 'watcher.log');
const DUMPS_DIR = path.join(DIR, 'dumps');

const DRY_RUN = process.argv.includes('--dry-run');
const DUMP = process.argv.includes('--dump');

const TARGET_URL = 'https://sistemamaestro.mineducacion.gov.co/SistemaMaestro/busquedaVacantes.xhtml';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const AREAS = [
  { key: 'MATEMATICAS', label: 'Matemáticas', value: '15' },
  { key: 'TECNOLOGIA', label: 'Tecnología e informática', value: '16' },
];

function log(level, msg) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n', 'utf8'); } catch (_) {}
}

function loadJson(file, fallback) {
  try {
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // quitar BOM de PowerShell
    return JSON.parse(raw);
  } catch (_) { return fallback; }
}

function saveJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** Extrae tarjetas de vacantes desde el contenido de la rejilla PrimeFaces.
 *  Soporta: .ui-datagrid-item, celdas td, divs hijos directos y texto plano. */
function parseGrid(gridHtml, gridText) {
  const cards = [];
  const seenText = new Set();

  const add = (text, html) => {
    const clean = normalize(text);
    if (!clean || clean.length < 8) return;
    if (seenText.has(clean)) return;
    seenText.add(clean);

    // ID preferente: un código numérico dentro de la tarjeta
    const codeMatch = clean.match(/(?:c[oó]digo|n[úu]mero|no\.?|id|vacante)[^0-9]{0,12}(\d{4,})/i)
      || clean.match(/(?:^|\s)(\d{5,})(?:\s|$)/);
    const id = codeMatch ? codeMatch[1] : ('h' + require('crypto').createHash('sha1').update(clean).digest('hex').slice(0, 16));
    cards.push({ id, text: clean.slice(0, 1200), html: html || '' });
  };

  if (gridHtml) {
    // 1) tarjetas explícitas de PrimeFaces
    const itemRe = /<(?:div|td|li)[^>]*class="[^"]*ui-datagrid-item[^"]*"[^>]*>([\s\S]*?)<\/(?:div|td|li)>/gi;
    let m;
    while ((m = itemRe.exec(gridHtml)) !== null) {
      add(m[1].replace(/<[^>]+>/g, ' '), m[0]);
    }
    // 2) filas de tabla
    if (cards.length === 0) {
      const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      while ((m = rowRe.exec(gridHtml)) !== null) {
        const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x => x[1]);
        if (cells.length) add(cells.map(c => c.replace(/<[^>]+>/g, ' ')).join(' | '), m[0]);
      }
    }
    // 3) hijos directos del contenido
    if (cards.length === 0) {
      const childRe = /<div[^>]*class="[^"]*(?:vacante|card|ui-datagrid-content-item)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      while ((m = childRe.exec(gridHtml)) !== null) add(m[1].replace(/<[^>]+>/g, ' '), m[0]);
    }
  }

  // 4) fallback: texto plano separado por líneas/párrafos
  if (cards.length === 0 && gridText) {
    gridText.split(/\n{2,}|\r\n/).forEach(chunk => {
      const t = normalize(chunk);
      if (t && !/no existen|no hay|seleccione/i.test(t)) add(t, '');
    });
  }

  return cards;
}

async function createPage(browser) {
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'es-CO',
    viewport: { width: 1400, height: 1000 },
    extraHTTPHeaders: { 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8' },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  return context.newPage();
}

async function goto(page) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 120000 });
    const title = await page.title().catch(() => '');
    if (resp && resp.status() === 200 && /sistema maestro/i.test(title)) {
      await page.waitForTimeout(2500);
      return;
    }
    lastErr = new Error(`HTTP ${resp && resp.status()} / título="${title}"`);
    log('WARN', `Intento ${attempt} bloqueado: ${lastErr.message}. Reintentando...`);
    await page.waitForTimeout(3000);
  }
  throw lastErr;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const content = document.querySelector('#form-busqueda\\:tabla-vacantes_content');
    return {
      heading: [...document.querySelectorAll('#tabGeneral h4')].map(x => x.innerText.trim()).find(x => /VACANTES/i.test(x)) || '',
      paginator: document.querySelector('.ui-paginator-current')?.innerText?.trim() || '',
      gridText: content?.innerText?.trim() || '',
      gridHtml: content?.innerHTML || '',
    };
  });
}

async function collect(browser) {
  const results = [];
  const page = await createPage(browser);

  // 1) Vacantes del día (vista inicial)
  await goto(page);
  let snap = await snapshot(page);
  log('INFO', `Vista inicial: ${snap.heading.slice(0, 80)} | ${snap.paginator}`);
  if (DUMP) fs.writeFileSync(path.join(DUMPS_DIR, 'hoy.html'), snap.gridHtml, 'utf8');
  if (!/no existen vacantes publicadas con fecha del d[ií]a de hoy/i.test(snap.gridText)) {
    parseGrid(snap.gridHtml, snap.gridText).forEach(v => results.push({ ...v, source: 'NUEVAS HOY' }));
  }

  // 2) Matemáticas y Tecnología e informática
  for (const area of AREAS) {
    await goto(page);
    await page.evaluate((value) => {
      const sel = document.getElementById('form-busqueda:idInputArea_input');
      sel.value = value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }, area.value);
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.getElementById('form-busqueda:busqueda').click());
    await page.waitForTimeout(5000);

    snap = await snapshot(page);
    log('INFO', `${area.label}: ${snap.heading.slice(0, 60)} | ${snap.paginator} | ${snap.gridText.slice(0, 70)}`);
    if (DUMP) fs.writeFileSync(path.join(DUMPS_DIR, area.key + '.html'), snap.gridHtml, 'utf8');
    if (!/no existen resultados|datagrid-content-empty/i.test(snap.gridText)) {
      parseGrid(snap.gridHtml, snap.gridText).forEach(v => results.push({ ...v, source: area.key, area: area.label }));
    }
  }

  await page.close();
  return results;
}

async function sendTelegram(config, text) {
  if (DRY_RUN) {
    log('DRY', `Telegram NO enviado (--dry-run). Longitud: ${text.length}\n${text}`);
    return;
  }
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(config.chatId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(`Telegram ${res.status}: ${data.description || JSON.stringify(data)}`);
  log('INFO', 'Mensaje enviado a Telegram.');
}

function chunkText(text, max = 3800) {
  const lines = text.split('\n');
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    if ((cur + '\n' + line).length > max) {
      if (cur) chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function main() {
  if (DUMP && !fs.existsSync(DUMPS_DIR)) fs.mkdirSync(DUMPS_DIR, { recursive: true });
  const fileConfig = loadJson(CONFIG_PATH, {});
  const config = {
    telegramToken: process.env.TELEGRAM_TOKEN || fileConfig.telegramToken,
    chatId: process.env.TELEGRAM_CHAT_ID || fileConfig.chatId,
  };
  const USE_GITHUB_STATE = process.env.USE_GITHUB_STATE === 'true';
  log('INFO', `=== Inicio (dry-run=${DRY_RUN}, estado=${USE_GITHUB_STATE ? 'GitHub' : 'local'}) ===`);

  if (!DRY_RUN && (!config.telegramToken || !config.chatId || /PEGAR_/.test(config.telegramToken))) {
    log('ERROR', 'config.json sin telegramToken/chatId. Usa --dry-run o configura el bot.');
    process.exit(1);
  }

  const launchArgs = ['--disable-blink-features=AutomationControlled'];
  if (process.platform === 'linux') launchArgs.push('--no-sandbox', '--disable-dev-shm-usage');
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: launchArgs,
  });

  let state;
  let remoteSha = null;

  try {
    if (USE_GITHUB_STATE) {
      const remote = await loadRemoteState();
      state = remote.state;
      remoteSha = remote.sha;
      log('INFO', `Estado remoto cargado (${Object.keys(state.seen).length} vacantes vistas).`);
    } else {
      state = loadJson(STATE_PATH, { seen: {}, lastCheck: null });
      state.seen = state.seen || {};
    }

    const vacancies = await collect(browser);
    log('INFO', `Vacantes encontradas en pantalla: ${vacancies.length}`);

    const newOnes = vacancies.filter(v => !state.seen[v.id]);
    log('INFO', `Nuevas (no vistas): ${newOnes.length}`);

    if (newOnes.length) {
      const header = `🚨 <b>Sistema Maestro - ${newOnes.length} vacante(s) nueva(s)</b>\n🕐 ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })} (CO)\n`;
      const body = newOnes.map((v, i) => {
        const tag = v.source === 'NUEVAS HOY' ? '🆕 PUBLICADA HOY' : `📘 ${v.source === 'MATEMATICAS' ? 'MATEMÁTICAS' : 'TECNOLOGÍA E INFORMÁTICA'}`;
        return `${i + 1}. ${tag}\n${escapeHtml(v.text)}`;
      }).join('\n\n──────────\n\n');
      const message = header + '\n' + body + `\n\n🔗 https://sistemamaestro.mineducacion.gov.co/SistemaMaestro/busquedaVacantes.xhtml`;

      const ts = new Date().toISOString();
      newOnes.forEach(v => { state.seen[v.id] = ts; });
      if (USE_GITHUB_STATE) await saveRemoteState(state, remoteSha);
      else saveJson(STATE_PATH, state);

      for (const chunk of chunkText(message)) {
        await sendTelegram(config, chunk);
        if (!DRY_RUN) await new Promise(r => setTimeout(r, 700));
      }
    } else {
      state.lastCheck = new Date().toISOString();
      if (!USE_GITHUB_STATE) saveJson(STATE_PATH, state);
      log('INFO', 'Sin novedades. Estado actualizado.');
    }
  } finally {
    await browser.close();
  }
}

module.exports = { parseGrid, normalize };

if (require.main === module) {
  main().catch(e => {
    log('ERROR', 'FATAL: ' + (e && e.stack ? e.stack : e));
    process.exit(1);
  });
}
