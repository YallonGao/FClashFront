# 本地启动 FClashFront 开发服务器。默认 http://localhost:5180，/api 代理到 8780。
# 需要 Node 18+，首次运行会安装依赖。
param(
    [int]$Port = 5180
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "node_modules")) {
    Write-Host "installing dependencies" -ForegroundColor Cyan
    if (Test-Path "package-lock.json") { npm ci } else { npm install }
}

Write-Host ""
$address = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1).IPAddress
Write-Host "  Console  http://localhost:$Port" -ForegroundColor Green
if ($address) { Write-Host "  LAN      http://$address`:$Port" -ForegroundColor Yellow }
Write-Host "  API      proxied to http://127.0.0.1:8780 (start FClashBack first)" -ForegroundColor DarkGray
Write-Host ""

npm run dev -- --port $Port
