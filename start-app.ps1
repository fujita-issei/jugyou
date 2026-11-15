# パーソナルログ起動ランチャ
# - localhost:8765 が応答しなければ、server.ps1 を隠れたウィンドウで起動
# - Chrome を --app モードで http://localhost:8765/ に向けて開く
# - Chrome を閉じてもサーバは残るので、手動で止めたい場合はタスクマネージャから終了

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$url  = "http://localhost:$port/"

# サーバが既に動いているか
$alreadyUp = $false
try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 -MaximumRedirection 0
    if ($r.StatusCode -ge 200) { $alreadyUp = $true }
} catch { }

if (-not $alreadyUp) {
    $serverPath = Join-Path $root 'server.ps1'
    # 別プロセスでサーバを無窓起動
    Start-Process powershell.exe -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-WindowStyle', 'Hidden',
        '-File', $serverPath
    ) -WindowStyle Hidden | Out-Null

    # 待ち受け開始を確認
    for ($i = 0; $i -lt 50; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1 -MaximumRedirection 0
            if ($r.StatusCode -ge 200) { break }
        } catch { Start-Sleep -Milliseconds 100 }
    }
}

# Chrome を --app で開く
$chrome = $null
foreach ($c in @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)) {
    if (Test-Path $c) { $chrome = $c; break }
}

if ($chrome) {
    Start-Process -FilePath $chrome -ArgumentList "--app=$url", '--new-window' | Out-Null
} else {
    Start-Process $url | Out-Null
}
