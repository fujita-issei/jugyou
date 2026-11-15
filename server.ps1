# パーソナルログ用の静的ファイルサーバ
# 起動: powershell.exe -NoProfile -ExecutionPolicy Bypass -File server.ps1
# ポート: 8765

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765
$prefix = "http://localhost:$port/"

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.wasm' = 'application/wasm'
    '.map'  = 'application/json'
    '.txt'  = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Listening on $prefix (root: $root)"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch { break }

    $req = $ctx.Request
    $res = $ctx.Response
    try {
        $path = [uri]::UnescapeDataString($req.Url.AbsolutePath)
        if ($path -eq '/' -or $path -eq '') { $path = '/index.html' }
        $full = Join-Path $root ($path -replace '^/','' -replace '/','\')
        $fullResolved = [System.IO.Path]::GetFullPath($full)
        $rootResolved = [System.IO.Path]::GetFullPath($root)
        if (-not $fullResolved.StartsWith($rootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
            $res.StatusCode = 403
            $res.Close()
            continue
        }
        if (Test-Path -LiteralPath $fullResolved -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullResolved).ToLowerInvariant()
            $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $res.ContentType = $ct
            $res.Headers.Add('Cache-Control','no-store')
            $bytes = [System.IO.File]::ReadAllBytes($fullResolved)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
    } catch {
        try {
            $res.StatusCode = 500
            $msg = [System.Text.Encoding]::UTF8.GetBytes("500: $_")
            $res.OutputStream.Write($msg, 0, $msg.Length)
        } catch {}
    } finally {
        try { $res.Close() } catch {}
    }
}
try { $listener.Stop() } catch {}
try { $listener.Close() } catch {}
