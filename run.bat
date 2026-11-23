@echo off
cd /d "C:\Users\User\VacantesWatcher"
node watcher.js >> watcher-scheduler.log 2>&1
exit /b 0
