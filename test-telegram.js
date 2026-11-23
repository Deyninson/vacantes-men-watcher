const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));

(async () => {
  const res = await fetch(`https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(cfg.chatId),
      text: '✅ <b>VacantesWatcher</b> configurado correctamente.\n\nTe avisaré cuando publiquen vacantes nuevas del Sistema Maestro, con destacado de 📘 Matemáticas y 💻 Tecnología e informática.',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  console.log(`ENVIADO=${data.ok} MENSAJE_ID=${data.result && data.result.message_id}`);
  if (!data.ok) console.log('DETALLE:', data.description);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
