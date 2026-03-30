@echo off
cd /d %~dp0

set PY_EXE=C:\Users\HANSUNG\anaconda3\python.exe
if exist "%PY_EXE%" goto run

where python >nul 2>nul
if %errorlevel%==0 (
  for /f "delims=" %%i in ('where python') do (
    set PY_EXE=%%i
    goto run
  )
)

echo Python executable not found.
echo Install Python or edit run_server.bat to point to your python.exe.
echo.
pause
exit /b 1

:run
echo Using Python: %PY_EXE%
"%PY_EXE%" server.py

echo.
echo Server exited. Press any key to close this window.
pause >nul
