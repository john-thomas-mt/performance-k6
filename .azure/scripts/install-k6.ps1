# Downloads a k6 standalone binary and prepends it to PATH for the rest of the pipeline job.
# Nothing is installed machine-wide, so the cleanup script can remove every trace afterwards, which
# matters on a persistent self-hosted agent. See docs/ci-pipelines.md.
param(
  # A release tag ('v2.2.0') for a reproducible run, or 'latest' to resolve the newest release.
  [string]$Version = 'latest',
  [string]$InstallRoot = $env:AGENT_TEMPDIRECTORY
)

$ErrorActionPreference = 'Stop'

# $IsWindows does not exist in Windows PowerShell 5.1, but $env:OS works on 5.1 and Core alike.
$isWin = $env:OS -eq 'Windows_NT'
if ($isWin) {
  # 5.1 may default below TLS 1.2, which GitHub rejects.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
}

$tag = $Version
if ($tag -eq 'latest') {
  $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/grafana/k6/releases/latest' -Headers @{ 'User-Agent' = 'azure-pipelines' }
  $tag = $release.tag_name
  Write-Host "Resolved 'latest' to k6 $tag"
}

if ($isWin) {
  $asset = "k6-$tag-windows-amd64.zip"
  $archive = Join-Path $InstallRoot 'k6.zip'
  $exe = 'k6.exe'
} else {
  $asset = "k6-$tag-linux-amd64.tar.gz"
  $archive = Join-Path $InstallRoot 'k6.tar.gz'
  $exe = 'k6'
}

# Clear anything a previous run left behind so the binary is always freshly downloaded.
$dest = Join-Path $InstallRoot 'k6'
if (Test-Path $dest) { Remove-Item -Path $dest -Recurse -Force }
if (Test-Path $archive) { Remove-Item -Path $archive -Force }

$url = "https://github.com/grafana/k6/releases/download/$tag/$asset"
Write-Host "Downloading k6 $tag from $url"
Invoke-WebRequest -Uri $url -OutFile $archive
New-Item -ItemType Directory -Force -Path $dest | Out-Null

if ($isWin) {
  Expand-Archive -Path $archive -DestinationPath $dest -Force
} else {
  tar -xzf $archive -C $dest
}

$k6path = (Get-ChildItem -Path $dest -Recurse -Filter $exe -File | Select-Object -First 1).FullName
if (-not $k6path) { throw "k6 binary '$exe' not found under $dest after unpacking $asset" }
if (-not $isWin) { chmod +x $k6path }

Write-Host "##vso[task.prependpath]$(Split-Path $k6path -Parent)"
& $k6path version
