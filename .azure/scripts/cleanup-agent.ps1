# Removes everything the run left on disk, so nothing sensitive lingers on a persistent self-hosted
# agent: the plaintext decryption passphrase, the generated config files, the published report tree,
# and the downloaded k6 binary. Runs after the artifact is published, on condition: always().
param(
  [string]$InstallRoot = $env:AGENT_TEMPDIRECTORY,
  [string]$ReportsRoot = 'reports'
)

foreach ($f in 'temp/secret.json', 'temp/setup.json', 'temp/exec-req.json') {
  if (Test-Path $f) { Remove-Item -Path $f -Force }
}

if (Test-Path $ReportsRoot) { Remove-Item -Path $ReportsRoot -Recurse -Force }

foreach ($a in 'k6.zip', 'k6.tar.gz') {
  $p = Join-Path $InstallRoot $a
  if (Test-Path $p) { Remove-Item -Path $p -Force }
}

$k6dir = Join-Path $InstallRoot 'k6'
if (Test-Path $k6dir) { Remove-Item -Path $k6dir -Recurse -Force }
