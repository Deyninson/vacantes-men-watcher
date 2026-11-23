const { chromium } = require('playwright');
const fs = require('fs');
const URL = 'https://sistemamaestro.mineducacion.gov.co/SistemaMaestro/busquedaVacantes.xhtml';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    userAgent: UA, locale: 'es-CO', viewport: { width: 1400, height: 1000 },
    extraHTTPHeaders: { 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8' }
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await context.newPage();

  const resp = await page.goto(URL, { waitUntil: 'load', timeout: 120000 });
  console.log('MAIN:', resp.status());
  await page.waitForTimeout(3000);

  const snap = async () => page.evaluate(() => ({
    heading: document.querySelector('#tabGeneral h4')?.innerText?.trim() || null,
    gridText: document.querySelector('#form-busqueda\\:tabla-vacantes_content')?.innerText?.trim() || null,
    gridHtml: document.querySelector('#form-busqueda\\:tabla-vacantes_content')?.innerHTML || null,
    paginator: document.querySelector('.ui-paginator-current')?.innerText?.trim() || null,
  }));

  const initial = await snap();
  console.log('INICIO heading:', initial.heading);
  console.log('INICIO paginator:', initial.paginator);
  fs.writeFileSync('initial.html', initial.gridHtml || '', 'utf8');

  await page.locator('[id="form-busqueda:idInputArea_input"]').selectOption('15');
  console.log('Area value:', await page.locator('[id="form-busqueda:idInputArea_input"]').inputValue());
  await page.evaluate(() => document.getElementById('form-busqueda:busqueda').click());
  console.log('Click Buscar OK');
  await page.waitForTimeout(7000);

  const after = await snap();
  console.log('MATEMATICAS heading:', after.heading);
  console.log('MATEMATICAS paginator:', after.paginator);
  console.log('MATEMATICAS gridText:', (after.gridText || '').slice(0, 1500));
  fs.writeFileSync('matematicas.html', after.gridHtml || '', 'utf8');

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
