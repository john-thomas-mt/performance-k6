param(
  [string]$OutPath = 'temp/resource-usage.csv',
  [int]$Interval = 1
)

$ErrorActionPreference = 'Stop'
$inv = [System.Globalization.CultureInfo]::InvariantCulture
$totalMB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1MB)

Set-Content -Path $OutPath -Encoding ascii -Value 'timestamp,cpu_percent,ram_percent,ram_used_mb,net_rx_kBps,net_tx_kBps,load1'

$counters = @(
  '\Processor(_Total)\% Processor Time',
  '\Memory\Available MBytes',
  '\Network Interface(*)\Bytes Received/sec',
  '\Network Interface(*)\Bytes Sent/sec',
  '\System\Processor Queue Length'
)

Get-Counter -Counter $counters -Continuous -SampleInterval $Interval | ForEach-Object {
  $s = $_.CounterSamples

  $cpu = ($s | Where-Object { $_.Path -like '*\% processor time' }).CookedValue
  $availMB = ($s | Where-Object { $_.Path -like '*\available mbytes' }).CookedValue
  $q = ($s | Where-Object { $_.Path -like '*\processor queue length' }).CookedValue
  $rx = ($s | Where-Object { $_.Path -like '*bytes received/sec' -and $_.InstanceName -notmatch 'loopback|isatap|teredo' } | Measure-Object CookedValue -Sum).Sum
  $tx = ($s | Where-Object { $_.Path -like '*bytes sent/sec' -and $_.InstanceName -notmatch 'loopback|isatap|teredo' } | Measure-Object CookedValue -Sum).Sum

  if ($null -eq $cpu) { $cpu = 0 }
  if ($null -eq $availMB) { $availMB = 0 }
  if ($null -eq $q) { $q = 0 }
  if ($null -eq $rx) { $rx = 0 }
  if ($null -eq $tx) { $tx = 0 }

  $usedMB = $totalMB - $availMB
  $ramPct = if ($totalMB -gt 0) { 100 * $usedMB / $totalMB } else { 0 }

  $fields = @(
    (Get-Date).ToString('o'),
    $cpu.ToString('F1', $inv),
    $ramPct.ToString('F1', $inv),
    $usedMB.ToString('F0', $inv),
    ($rx / 1024).ToString('F1', $inv),
    ($tx / 1024).ToString('F1', $inv),
    $q.ToString('F2', $inv)
  )
  Add-Content -Path $OutPath -Encoding ascii -Value ($fields -join ',')
}
