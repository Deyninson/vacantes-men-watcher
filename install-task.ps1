$ErrorActionPreference = 'Stop'

$dir = 'C:\Users\User\VacantesWatcher'
$taskName = 'VacantesMEN_Watcher'
$bat = Join-Path $dir 'run.bat'

if (-not (Test-Path $bat)) { throw "No existe $bat" }

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$bat`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
  -RepetitionInterval (New-TimeSpan -Minutes 30) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 12) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description 'Revisa cada 30 min las vacantes nuevas del Sistema Maestro (MEN) y avisa por Telegram.' `
  -Force | Out-Null

Write-Output "TAREA REGISTRADA: $taskName"
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State, @{n='Proxima';e={(Get-ScheduledTaskInfo -TaskName $taskName).NextRunTime}} | Format-List
