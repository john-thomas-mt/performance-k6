# Runs a k6 load spec under observation: agent + Go-runtime samplers alongside it, optional live
# Datadog streaming, console log tee'd to reports/logs/, and a post-run scan that turns silent
# streaming failures into build warnings. Exits with k6's own exit code.
#
# Also runnable outside CI, which is the point of it being a script rather than inline pipeline YAML:
# a local validation run reproduces the CI configuration exactly by calling this, instead of
# mirroring the environment block by hand and drifting from it.
#
# Reasoning behind each setting is in docs/ci-pipelines.md; the Datadog measurements behind the
# OTEL_* values are in docs/datadog-live-metrics.md. Read those before changing anything here.
param(
  [Parameter(Mandatory)][string]$SpecPath,
  [Parameter(Mandatory)][string]$ReleaseVersion,
  [string]$LoadProfile = 'neoload',
  [string]$Fidelity = 'lean',
  [int]$Pacing = 300,
  [string]$Site = 'PERF',
  [string]$DatadogEnv = 'dev',
  [string]$DatadogEndpoint = 'otlp.datadoghq.com:443',
  [string]$DatadogMetricsUrl = 'https://api.datadoghq.com/api/v2/series',
  [string]$BuildNumber = $env:BUILD_BUILDNUMBER,
  [string]$ReportsRoot = 'reports'
)

$dashboardDir = Join-Path $ReportsRoot 'dashboard'
$metricsDir = Join-Path $ReportsRoot 'metrics'
$resourcesDir = Join-Path $ReportsRoot 'resources'
$logsDir = Join-Path $ReportsRoot 'logs'
New-Item -ItemType Directory -Force -Path $dashboardDir, $metricsDir, $resourcesDir, $logsDir | Out-Null

$resourceCsv = Join-Path $resourcesDir 'resource-usage.csv'
$gcCsv = Join-Path $resourcesDir 'gc-usage.csv'
$consoleLog = Join-Path $logsDir 'k6-console.log'
$forwarderLog = Join-Path $logsDir 'metric-forwarder.log'
$k6Address = '127.0.0.1:6565'
# Read after the run by summary-forwarder.cjs, which posts the exact per-transaction percentiles
# group-aggregator.cjs computes. Written only while streaming and removed otherwise, so one flag still
# gates every feed and a stale file cannot tag a later run's summary with the wrong build.
$ddTagsFile = Join-Path 'temp' 'dd-tags.txt'

# Mirrors the app's own APM service naming so k6 metrics sort beside the service under test, prefixed
# k6/ so a load generator is never mistaken for an application.
$datadogService = "k6/performance/$ReleaseVersion"

$env:K6_WEB_DASHBOARD = 'true'
$env:K6_WEB_DASHBOARD_EXPORT = Join-Path $dashboardDir 'report.html'
# k6's default 10s aggregation period. A 1s period over a 40-minute run bloats report.html.
$env:K6_WEB_DASHBOARD_PERIOD = '10s'

$env:DD_METRICS_URL = $DatadogMetricsUrl
$env:K6_OTEL_EXPORTER_PROTOCOL = 'http/protobuf'
$env:K6_OTEL_HTTP_EXPORTER_ENDPOINT = $DatadogEndpoint
$env:K6_OTEL_SERVICE_NAME = $datadogService
# Not 'k6.': Datadog's k6 integration claims that namespace and stamps metadata over the names it
# recognises, which breaks count: and max: on every http_req_* series.
$env:K6_OTEL_METRIC_PREFIX = 'k6perf.'
$env:K6_OTEL_EXPORT_INTERVAL = '10s'
# Required, not optional. The intake accepts delta only and k6 defaults to cumulative, so without
# this every export is rejected.
$env:OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE = 'delta'
# k6 registers no histogram view, so trends would inherit the SDK's default explicit buckets (10s top
# bound), inflating averages and collapsing p90/p95/p99 onto max.
$env:OTEL_EXPORTER_OTLP_METRICS_DEFAULT_HISTOGRAM_AGGREGATION = 'base2_exponential_bucket_histogram'
# service.version is explicit because k6 otherwise reports its own version here, which Datadog maps
# to the version tag and would not match the app service's.
$env:OTEL_RESOURCE_ATTRIBUTES = "deployment.environment.name=$DatadogEnv,service.version=$ReleaseVersion"

# Linux agents read /proc via the Node sampler; Windows agents use the Get-Counter sampler.
$isWin = $env:OS -eq 'Windows_NT'
if ($isWin) {
  $samplerArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'resource-sampler.ps1'), $resourceCsv, '1')
  $sampler = Start-Process powershell -ArgumentList $samplerArgs -PassThru -NoNewWindow
} else {
  $samplerArgs = @((Join-Path $PSScriptRoot 'resource-sampler.cjs'), $resourceCsv, '1')
  $sampler = Start-Process node -ArgumentList $samplerArgs -PassThru -NoNewWindow
}

# k6's own Go runtime and GC metrics, scraped from the Prometheus endpoint --address and
# --profiling-enabled expose. Measures the load generator, not the system under test.
$gcSamplerArgs = @((Join-Path $PSScriptRoot 'gc-sampler.cjs'), $gcCsv, '1', $k6Address)
$gcSampler = Start-Process node -ArgumentList $gcSamplerArgs -PassThru -NoNewWindow

$k6Args = @(
  'run'
  '--quiet'
  "--address=$k6Address"
  '--profiling-enabled'
  '--out', "json=$(Join-Path $metricsDir 'k6-metrics.json.gz')"
  '-e', "FIDELITY=$Fidelity"
  '-e', "PROFILE=$LoadProfile"
  '-e', "PACING=$Pacing"
)

# An unset Azure pipeline variable arrives as the literal '$(DD_API_KEY)', so the -notmatch clause
# keeps that case on the skip path instead of streaming with a junk key. One flag gates both feeds.
$streamToDatadog = $env:DD_API_KEY -and $env:DD_API_KEY -notmatch '^\$\('
if ($streamToDatadog) {
  # Composed here rather than passed in, so the masked key is never expanded into a build log.
  $env:K6_OTEL_HEADERS = "dd-api-key=$env:DD_API_KEY"
  # Datadog lowercases tag keys and values alike, so site=PERF reads back as site:perf and a
  # hand-typed {site:PERF} filter matches nothing. The release version is deliberately not tagged:
  # service.version already surfaces it as the version tag, and a second copy would drift.
  $k6Args += @('--out', 'opentelemetry', '--tag', "site=$Site", '--tag', "build_number=$BuildNumber")
  # Agent CPU/RAM reach Datadog through the sampler's CSV rather than through k6, so they need their
  # own feed. These tags must mirror what OTLP derives from the resource attributes above, or the
  # dashboard's template variables stop filtering both feeds alike. The forwarder inherits
  # DD_API_KEY from this process, so the key never lands on a command line.
  $forwarderTags = "service:$datadogService,env:$DatadogEnv,version:$ReleaseVersion,site:$Site,build_number:$BuildNumber"
  $forwarderArgs = @((Join-Path $PSScriptRoot 'metric-forwarder.cjs'), $resourceCsv, 'k6perf.agent.', '10', $forwarderTags)
  $forwarder = Start-Process node -ArgumentList $forwarderArgs -PassThru -NoNewWindow -RedirectStandardError $forwarderLog
  # Handed to the post-run summary feed through a file rather than recomposed by its caller, so the
  # service-naming convention above stays in one place.
  New-Item -ItemType Directory -Force -Path 'temp' | Out-Null
  Set-Content -Path $ddTagsFile -Value $forwarderTags -Encoding utf8
  Write-Host "Streaming live metrics to Datadog as service '$datadogService'"
} else {
  if (Test-Path $ddTagsFile) { Remove-Item $ddTagsFile -Force }
  Write-Host 'DD_API_KEY not set - skipping Datadog streaming (published artifacts are unaffected)'
}

$k6Args += $SpecPath

try {
  # ForEach-Object flattens the ErrorRecord that Windows PowerShell wraps native stderr in, so k6's
  # log lines render as text rather than as PowerShell errors.
  k6 @k6Args 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $consoleLog
  $code = $LASTEXITCODE
} finally {
  foreach ($s in $sampler, $gcSampler, $forwarder) {
    if ($s -and -not $s.HasExited) { Stop-Process -Id $s.Id -Force -ErrorAction SilentlyContinue }
  }
}

# Both feeds log their failures and keep going, so without this an empty live dashboard would sit
# behind a green build. The published artifacts are unaffected, hence a warning and not a failure.
$streamFailures = @(
  @{ Log = $consoleLog; Pattern = 'failed to upload metrics'; Message = 'Datadog streaming failed during this run - see k6-console.log' }
  @{ Log = $forwarderLog; Pattern = 'submit failed'; Message = 'Agent metric forwarding failed during this run - see metric-forwarder.log' }
)
foreach ($f in $streamFailures) {
  if ((Test-Path $f.Log) -and (Select-String -Path $f.Log -Pattern $f.Pattern -Quiet)) {
    Write-Host "##vso[task.logissue type=warning]$($f.Message)"
  }
}

exit $code
