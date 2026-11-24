@echo off
REM Doppio clic: pubblica tutte le modifiche. Netlify aggiorna il sito in circa un minuto.
cd /d "%~dp0"
git add -A
git commit -m "Aggiornamento presentazioni"
git push
echo.
echo Pubblicato. Tra un minuto le modifiche sono online.
pause
