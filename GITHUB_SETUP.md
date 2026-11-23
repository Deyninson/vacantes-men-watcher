# Pasar el agente a GitHub Actions (nube, gratis)

## 1. Crear el repositorio

1. Entra a https://github.com/new (si no tienes cuenta, regístrate en https://github.com/signup).
2. Nombre: por ejemplo `vacantes-men-watcher`.
3. Elige **Public** (minutos ilimitados gratis) o **Private** (2.000 min/mes, más que suficiente).
4. **No** marques "Initialize this repository with a README" (así evitamos conflictos al subir).
5. Crea el repo y copia la URL HTTPS que aparece, tipo:
   `https://github.com/TU_USUARIO/vacantes-men-watcher.git`

## 2. Subir el código

En PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File 'C:\Users\User\VacantesWatcher\push-to-github.ps1' -RepoUrl 'https://github.com/TU_USUARIO/vacantes-men-watcher.git'
```

Si te pide iniciar sesión, GitHub ya no acepta contraseña: necesitas un **Personal Access Token**.
Créalo en https://github.com/settings/tokens → "Generate new token (classic)" → marca solo `repo` → pégalo cuando pida la contraseña.

> El archivo `config.json` NO se sube (está en `.gitignore`), así que tu token de Telegram nunca queda expuesto.

## 3. Agregar los secretos

En tu repo: **Settings → Secrets and variables → Actions → New repository secret**.

Crea estos dos:

| Nombre | Valor |
|---|---|
| `TELEGRAM_TOKEN` | el token que te dio BotFather |
| `TELEGRAM_CHAT_ID` | tu chat ID de Telegram |

## 4. Activar permisos de escritura

**Settings → Actions → General → Workflow permissions** → selecciona **Read and write permissions** y guarda.

Esto permite que el workflow guarde `state.json` en el repo para no avisar dos veces la misma vacante.

## 5. Probar

**Actions** → a la izquierda **"Vacantes MEN Watcher"** → botón **Run workflow** → **Run workflow**.

Entra al run y revisa los logs. Debe terminar con:

```
Vacantes encontradas en pantalla: 0
Nuevas (no vistas): 0
Sin novedades. Estado actualizado.
```

Cuando haya vacantes nuevas verás `Mensaje enviado a Telegram.` y te llegará el aviso al celular.

## 6. Ya está

El workflow corre **cada 30 minutos** automáticamente. No depende de tu PC.

Notas:
- GitHub puede retrasar unos minutos los workflows programados en horas pico; es normal.
- Puedes ver el historial en la pestaña **Actions**.
- Para cambiar la frecuencia, edita `.github/workflows/vacantes.yml` (línea `cron`) y sube el cambio.
- Para detenerlo: **Actions → Vacantes MEN Watcher → ⋮ → Disable workflow**.
- Si los logs muestran "Web Page Blocked", el WAF del MEN está bloqueando las IPs de GitHub; avísame y ajustamos el acceso (por ejemplo con un proxy o pasando a Oracle Cloud).
