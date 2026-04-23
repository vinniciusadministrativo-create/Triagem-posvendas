@echo off
echo ===========================================
echo  Instalador Python + Libs NF-e Extractor
echo ===========================================
echo.

REM Verifica se Python ja esta instalado
python --version >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Python ja esta instalado!
    python --version
    goto :install_libs
)

py --version >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Python ja esta instalado via py launcher!
    py --version
    goto :install_libs_py
)

echo [INFO] Python nao encontrado. Baixando e instalando...
echo.

REM Baixa o instalador do Python 3.12
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe' -OutFile '%TEMP%\python_installer.exe'"

echo [INFO] Instalando Python (adiciona ao PATH automaticamente)...
"%TEMP%\python_installer.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

echo [OK] Python instalado com sucesso!
echo [INFO] Reiniciando o PATH...

REM Atualizar PATH para o processo atual
for /f "tokens=*" %%i in ('powershell -Command "[Environment]::GetEnvironmentVariable(\"Path\", \"Machine\")"') do set PATH=%%i;%PATH%

:install_libs
echo.
echo [INFO] Instalando bibliotecas Python: pdfplumber e reportlab...
python -m pip install --upgrade pip
python -m pip install pdfplumber reportlab
echo.
echo [OK] Tudo instalado com sucesso!
echo.
echo Teste executando:
echo   python backend\scripts\nf_espelho_citel.py --help
goto :end

:install_libs_py
echo.
echo [INFO] Instalando bibliotecas Python: pdfplumber e reportlab...
py -m pip install --upgrade pip
py -m pip install pdfplumber reportlab
echo.
echo [OK] Tudo instalado com sucesso!

:end
echo.
pause
