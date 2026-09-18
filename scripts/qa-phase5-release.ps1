$ErrorActionPreference = 'Stop'

$ProductRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$QaArtifactsDir = Join-Path $ProductRoot 'qa-artifacts'
$RawLogPath = Join-Path $QaArtifactsDir 'phase5-raw.log'
$FallbackSummaryPath = Join-Path $QaArtifactsDir 'phase5-fallback-summary.json'
$FallbackTextPath = Join-Path $QaArtifactsDir 'phase5-fallback-summary.txt'
$SurfaceSummaryPath = Join-Path $QaArtifactsDir 'phase5-summary.json'
$PlaywrightSummaryPath = Join-Path $QaArtifactsDir 'playwright-summary.json'

New-Item -ItemType Directory -Force -Path $QaArtifactsDir | Out-Null
Remove-Item $RawLogPath,$FallbackSummaryPath,$FallbackTextPath,$SurfaceSummaryPath,$PlaywrightSummaryPath -Force -ErrorAction SilentlyContinue

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Get-Phase5LogDiagnostics {
  param([string]$Path)
  $lines = if (Test-Path $Path) { @(Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) } else { @() }
  $lastStage = 'phase5'
  $lastFailure = $null
  foreach ($line in $lines) {
    $text = [string]$line
    if ($text -match 'qa:surface|qa-phase5') { $lastStage = 'qa:surface' }
    elseif ($text -match 'qa:web|playwright test') { $lastStage = 'qa:web' }
    elseif ($text -match 'check:imports|npm run check') { $lastStage = 'check' }

    if ($text -match '^\[FAIL\]\s+(.+?)(?:\s+-\s+(.*))?$') {
      $lastStage = $Matches[1].Trim()
      $lastFailure = if ($Matches[2]) { $Matches[2].Trim() } else { $text.Trim() }
    } elseif ($text -match '(?i)^\s*(?:#\s*)?(?:AssertionError|TimeoutError|Error):\s*(.+)$') {
      $lastFailure = $text.Trim()
    } elseif (-not $lastFailure -and $text -match '(?i)\b(?:failed|failure)\b' -and $text -notmatch 'ExperimentalWarning' -and $text -notmatch '^\s*#?\s*fail\s+\d+\s*$') {
      $lastFailure = $text.Trim()
    }
  }

  $surface = Read-JsonSafe -Path $SurfaceSummaryPath
  $playwright = Read-JsonSafe -Path $PlaywrightSummaryPath
  if ($surface -and $surface.status -eq 'failed' -and $surface.error) {
    $lastStage = 'qa:surface'
    $lastFailure = [string]$surface.error
  }
  if ($playwright -and $playwright.status -eq 'failed') {
    $lastStage = 'qa:web'
    if (-not $lastFailure) { $lastFailure = "Playwright falhou com exit code $($playwright.exitCode); consulte phase5-raw.log." }
  }
  if (-not $lastFailure) { $lastFailure = 'phase5 terminou sem diagnostico estruturado; consulte phase5-raw.log.' }

  [pscustomobject]@{ lastStage = $lastStage; lastFailure = $lastFailure }
}

function Write-FallbackPhase5Summary {
  param([int]$ExitCode,[string]$Reason)
  $diag = Get-Phase5LogDiagnostics -Path $RawLogPath
  $summary = [ordered]@{
    schemaVersion = 1
    status = 'failed'
    synthetic = $true
    reason = $Reason
    exitCode = $ExitCode
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    failedStage = $diag.lastStage
    lastFailure = $diag.lastFailure
    artifacts = [ordered]@{
      log = $RawLogPath
      phase5Summary = $SurfaceSummaryPath
      playwrightSummary = $PlaywrightSummaryPath
    }
  }
  $json = $summary | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText($FallbackSummaryPath,$json,(New-Object Text.UTF8Encoding($false)))
  @(
    'ArtiSys Phase 5 fallback',
    'Status: FAIL',
    "Reason: $Reason",
    "Exit code: $ExitCode",
    "Stage: $($diag.lastStage)",
    "Error: $($diag.lastFailure)",
    "Log: $RawLogPath"
  ) | Set-Content -LiteralPath $FallbackTextPath -Encoding utf8
  return $summary
}

$phase5ExitCode = 1
$previousPreference = $ErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  Push-Location $ProductRoot
  try {
    & npm run phase5:raw *>&1 | ForEach-Object {
      $line = [string]$_
      Write-Host $line
      Add-Content -LiteralPath $RawLogPath -Value $line -Encoding utf8
    }
    $phase5ExitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
} finally {
  $ErrorActionPreference = $previousPreference
}

$surfaceSummary = Read-JsonSafe -Path $SurfaceSummaryPath
$playwrightSummary = Read-JsonSafe -Path $PlaywrightSummaryPath

if ($phase5ExitCode -ne 0) {
  $diag = Get-Phase5LogDiagnostics -Path $RawLogPath
  $reason = if (-not $surfaceSummary -and -not $playwrightSummary) { 'phase5-summary-missing' } elseif ($diag.lastFailure -match 'sem diagnostico estruturado') { 'phase5-exit-without-diagnostic' } else { 'phase5-command-failed' }
  $fallback = Write-FallbackPhase5Summary -ExitCode $phase5ExitCode -Reason $reason
  throw "Phase 5 falhou em $($fallback.failedStage) (exit $phase5ExitCode): $($fallback.lastFailure). Resumo fallback: $FallbackSummaryPath; log: $RawLogPath"
}

if (-not $surfaceSummary -or -not $playwrightSummary) {
  $fallback = Write-FallbackPhase5Summary -ExitCode 1 -Reason 'phase5-summary-missing'
  throw "Phase 5 terminou sem todas as evidencias estruturadas: $($fallback.lastFailure). Resumo fallback: $FallbackSummaryPath; log: $RawLogPath"
}
if ($surfaceSummary.status -ne 'passed' -or $playwrightSummary.status -ne 'passed') {
  $fallback = Write-FallbackPhase5Summary -ExitCode 1 -Reason 'phase5-exit-without-diagnostic'
  throw "Phase 5 retornou evidencias nao aprovadas: $($fallback.lastFailure). Resumo fallback: $FallbackSummaryPath; log: $RawLogPath"
}

Write-Host '[ArtiSys Phase 5] PASS - log bruto e evidencias estruturadas preservados.'
