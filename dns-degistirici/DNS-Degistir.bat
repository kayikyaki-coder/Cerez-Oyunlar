@echo off
chcp 65001 >nul
title Google DNS Degistirici
setlocal

:: --- Yonetici izni yoksa kendini yonetici olarak yeniden baslat ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Yonetici izni isteniyor...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo  ==========================================
echo           GOOGLE DNS DEGISTIRICI
echo  ==========================================
echo.

:: --- Su an Google DNS kullaniliyor mu? ---
powershell -NoProfile -Command "$a = Get-NetAdapter | Where-Object Status -eq 'Up'; $d = $a | Get-DnsClientServerAddress -AddressFamily IPv4; if ($d.ServerAddresses -contains '8.8.8.8') { exit 1 } else { exit 0 }"
if %errorlevel% equ 1 goto ZATEN_AKTIF

:AYARLA
echo  DNS 8.8.8.8 / 8.8.4.4 olarak ayarlaniyor...
powershell -NoProfile -Command "Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses ('8.8.8.8','8.8.4.4','2001:4860:4860::8888','2001:4860:4860::8844'); Write-Host ('   [OK] ' + $_.Name) }"
ipconfig /flushdns >nul
echo.
echo  Tamamlandi! Google DNS aktif.
goto DURUM

:ZATEN_AKTIF
echo  Google DNS zaten aktif.
echo.
choice /C EH /M " Eski (otomatik) DNS ayarlarina geri donulsun mu"
if errorlevel 2 goto DURUM
echo.
echo  DNS otomatik (DHCP) ayarlara donduruluyor...
powershell -NoProfile -Command "Get-NetAdapter | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ResetServerAddresses; Write-Host ('   [OK] ' + $_.Name) }"
ipconfig /flushdns >nul
echo.
echo  Tamamlandi! Otomatik DNS geri yuklendi.

:DURUM
echo.
echo  --- Guncel DNS sunuculari ---
powershell -NoProfile -Command "Get-NetAdapter | Where-Object Status -eq 'Up' | Get-DnsClientServerAddress -AddressFamily IPv4 | ForEach-Object { Write-Host ('   ' + $_.InterfaceAlias + ': ' + ($_.ServerAddresses -join ', ')) }"
echo.
pause
