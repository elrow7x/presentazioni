@echo off
REM Da usare UNA sola volta, dopo aver creato su GitHub il repository privato "presentazioni".
cd /d "%~dp0"
git init
git add -A
git commit -m "Prime presentazioni"
git branch -M main
git remote add origin https://github.com/elrow7x/presentazioni.git
git push -u origin main
echo.
echo Fatto. Ora collega il repository a Netlify (una volta sola).
pause
