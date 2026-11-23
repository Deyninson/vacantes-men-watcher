$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'VacantesMEN_Watcher' -Confirm:$false
Write-Output 'Tarea VacantesMEN_Watcher eliminada.'
