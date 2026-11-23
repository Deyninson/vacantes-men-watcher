# Vigilante de Vacantes — Sistema Maestro (MEN)

Agente local que revisa la página de vacantes del MEN cada 30 minutos y avisa por Telegram.

## Qué hace

1. Consulta la vista **"Vacantes cargadas en el día"** (recién publicadas hoy).
2. Consulta las vacantes disponibles filtradas por **Matemáticas** y **Tecnología e informática**.
3. Compara con `state.json` y **solo avisa de las que no ha visto antes** (sin duplicados).
4. Envía el aviso a tu bot de Telegram con el texto de cada vacante y el enlace al sistema.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `watcher.js` | Lógica principal (extracción, deduplicación, Telegram) |
| `config.json` | Token del bot y chat ID (mantener privado) |
| `state.json` | Memoría de vacantes ya notificadas (se crea solo) |
| `watcher.log` | Historial de ejecuciones manuales |
| `watcher-scheduler.log` | Historial de ejecuciones automáticas |
| `run.bat` | Lanzador usado por el Programador de Tareas |
| `install-task.ps1` | Registra la tarea cada 30 min |
| `uninstall-task.ps1` | Quita la tarea |
| `dumps/` | HTML crudo de la rejilla (solo con `--dump`) |

## Uso manual

```bat
cd /d C:\Users\User\VacantesWatcher
node watcher.js              &rem ejecuta y envía a Telegram
node watcher.js --dry-run    &rem no envía, solo escribe en la consola/log
node watcher.js --dump       &rem guarda el HTML de la rejilla en dumps/
```

Prueba rápida de Telegram:

```bat
node test-telegram.js
```

## Tarea programada

- Nombre: `VacantesMEN_Watcher`
- Frecuencia: cada 30 minutos, empieza 2 min después de instalar
- Se ejecuta con tu usuario **solo cuando la PC esté encendida y con sesión iniciada**

Ver estado:

```powershell
Get-ScheduledTaskInfo -TaskName 'VacantesMEN_Watcher' | Format-List
Get-ScheduledTask -TaskName 'VacantesMEN_Watcher' | Select-Object State
```

Cambiar frecuencia: edita `install-task.ps1` (`-RepetitionInterval`) y vuelve a ejecutarlo.

Desinstalar:

```powershell
powershell -ExecutionPolicy Bypass -File uninstall-task.ps1
```

## Notas

- El sitio tiene un WAF que bloquea navegadores headless "genéricos"; por eso se usan headers realistas y Chrome instalado. Si la página cambia su estructura, revisa `dumps/` para ajustar el parser en `parseGrid()`.
- A la fecha de instalación el sistema no tenía vacantes publicadas; el agente sigue revisando y avisará en cuanto aparezcan.
- Si quieres agregar otra materia, añade su ID en el array `AREAS` de `watcher.js` (los IDs salen del `<select>` de "Área" de la página).
