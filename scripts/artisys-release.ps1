param([switch]$DryRun)
$ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
function Write-JsonUtf8NoBom { param([string]$Path,$Value) $json=$Value|ConvertTo-Json -Depth 12; [IO.File]::WriteAllText($Path,$json,(New-Object Text.UTF8Encoding($false))) }
function Invoke-NpmStage { param([string]$Script,[string]$LogPath) & npm run $Script *>&1 | Tee-Object -FilePath $LogPath -Append; return $LASTEXITCODE }
$ProductRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$env:ARTISYS_INSTALLER_DIR=Join-Path $ProductRoot 'release'; $env:ARTISYS_INSTALLER_PATTERN='^ArtiSys-Pecuaria-Setup-.*\.exe$'; $env:ARTISYS_STATUS_CONTEXT='ci/woodpecker/pecuaria-release'
$LockPath=Join-Path $ProductRoot '.artisys\utilidades.lock'; $ReleaseConfig=Join-Path $ProductRoot '.artisys\release.json'; $ArtifactsDir=Join-Path $ProductRoot 'artifacts'; $QaArtifactsDir=Join-Path $ProductRoot 'qa-artifacts'; $ReportPath=Join-Path $ArtifactsDir 'artisys-release-report.json'; $LogPath=Join-Path $ArtifactsDir 'woodpecker-release.log'; $ReleaseRunPath=Join-Path $QaArtifactsDir 'release-run.json'; $DryRunPath=Join-Path $QaArtifactsDir 'release-run-dry-run.json'; $InstallerDir=$env:ARTISYS_INSTALLER_DIR; $InstallerPattern=$env:ARTISYS_INSTALLER_PATTERN; $StatusContext=$env:ARTISYS_STATUS_CONTEXT
if(!(Test-Path $LockPath)){throw "Lock ausente: $LockPath"}; if(!(Test-Path $ReleaseConfig)){throw "Config ausente: $ReleaseConfig"}; if(!$env:ARTISYS_UTILIDADES_PATH){throw 'ARTISYS_UTILIDADES_PATH nao configurado no host.'}; if(!$DryRun -and !$env:GITHUB_REPORT_TOKEN){throw 'GITHUB_REPORT_TOKEN nao configurado no host.'}
if(!$DryRun -and !$env:ARTISYS_LEGACY_DB){throw 'ARTISYS_LEGACY_DB nao configurado no host para certificacao da Fase 7.'}
$UtilidadesPath=(Resolve-Path $env:ARTISYS_UTILIDADES_PATH).Path; $Lock=Get-Content $LockPath -Raw|ConvertFrom-Json; $PinnedCommit=[string]$Lock.commit; if($PinnedCommit -notmatch '^[0-9a-f]{40}$'){throw 'Commit pinado de utilidades invalido.'}; $inside=& git -C $UtilidadesPath rev-parse --is-inside-work-tree 2>$null; if($LASTEXITCODE -ne 0 -or $inside.Trim() -ne 'true'){throw "ARTISYS_UTILIDADES_PATH nao e repositorio git: $UtilidadesPath"}; & git -C $UtilidadesPath cat-file -e "$PinnedCommit^{commit}" 2>$null; if($LASTEXITCODE -ne 0){throw "Commit pinado $PinnedCommit nao existe localmente; nao ha fallback para main."}; $ProductCommit=(& git -C $ProductRoot rev-parse HEAD).Trim(); if($LASTEXITCODE -ne 0 -or $ProductCommit -notmatch '^[0-9a-f]{40}$'){throw 'Nao foi possivel resolver HEAD do produto.'}
New-Item -ItemType Directory -Force -Path $ArtifactsDir,$QaArtifactsDir|Out-Null; if(!$DryRun){Remove-Item $ReportPath,$LogPath,$ReleaseRunPath -Force -ErrorAction SilentlyContinue; if(Test-Path $InstallerDir){Get-ChildItem $InstallerDir -File -ErrorAction SilentlyContinue|Where-Object{$_.Name -match $InstallerPattern}|Remove-Item -Force}}
$TempWorktree=Join-Path ([IO.Path]::GetTempPath()) ("artisys-utilidades-{0}-{1}" -f $PID,[guid]::NewGuid().ToString('N')); $WorktreeCreated=$false; $ReleaseExit=1; $ReporterExit=1; $StartedAt=(Get-Date).ToUniversalTime().ToString('o'); $P2Stages=@()
try {
  & git -C $UtilidadesPath worktree add --detach $TempWorktree $PinnedCommit; if($LASTEXITCODE -ne 0){throw 'Falha ao criar worktree pinado.'}; $WorktreeCreated=$true
  $ReleaseCli=Join-Path $TempWorktree 'modules\artisys-release\bin\artisys-release.mjs'; $ReporterCli=Join-Path $TempWorktree 'modules\artisys-ci-reporter\bin\artisys-ci-reporter.mjs'; if(!(Test-Path $ReleaseCli)){throw 'artisys-release ausente no commit pinado.'}; if(!(Test-Path $ReporterCli)){throw 'artisys-ci-reporter ausente no commit pinado.'}
  $ReleaseArgs=@($ReleaseCli,$ReleaseConfig,'--profile','release','--report',$ReportPath); if($DryRun){$ReleaseArgs+='--dry-run'}
  Push-Location $ProductRoot; try { & node @ReleaseArgs *>&1|Tee-Object -FilePath $LogPath; $ReleaseExit=$LASTEXITCODE } finally { Pop-Location }
  $Installer=$null; if(Test-Path $InstallerDir){$Installer=Get-ChildItem $InstallerDir -File -ErrorAction SilentlyContinue|Where-Object{$_.Name -match $InstallerPattern}|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1}
  if($DryRun){$FinishedAt=(Get-Date).ToUniversalTime().ToString('o'); Write-JsonUtf8NoBom $DryRunPath @{status=if($ReleaseExit -eq 0){'dry-run'}else{'failed'};dryRun=$true;commit=$ProductCommit;utilidadesCommit=$PinnedCommit;startedAt=$StartedAt;finishedAt=$FinishedAt}; exit $ReleaseExit}
  if($ReleaseExit -eq 0 -and !$Installer){$ReleaseExit=1; Add-Content $LogPath '[wrapper] sucesso sem instalador correspondente.'}
  if($ReleaseExit -eq 0){
    Push-Location $ProductRoot
    try {
      foreach($Stage in @('qa:contracts','qa:security:release','qa:product','phase7')){
        $StageExit=Invoke-NpmStage -Script $Stage -LogPath $LogPath; $P2Stages+=@{name=$Stage;exitCode=$StageExit}; if($StageExit -ne 0){$ReleaseExit=$StageExit; break}
      }
    } finally { Pop-Location }
  }
  $InstallerRecord=$null; if($Installer){$InstallerRecord=@{name=$Installer.Name;path=$Installer.FullName;size=$Installer.Length;mtime=$Installer.LastWriteTimeUtc.ToString('o');sha256=(Get-FileHash -Algorithm SHA256 $Installer.FullName).Hash.ToLowerInvariant()}}
  $FinishedAt=(Get-Date).ToUniversalTime().ToString('o'); $RunRecord=@{status=if($ReleaseExit -eq 0){'passed'}else{'failed'};commit=$ProductCommit;utilidadesCommit=$PinnedCommit;startedAt=$StartedAt;finishedAt=$FinishedAt;installer=$InstallerRecord;p2Stages=$P2Stages;reporterExit=$null;reportedAt=$null}; Write-JsonUtf8NoBom $ReleaseRunPath $RunRecord
  if($ReleaseExit -eq 0){
    Push-Location $ProductRoot
    try {
      foreach($Stage in @('qa:release-validator','phase8:certify')){
        $StageExit=Invoke-NpmStage -Script $Stage -LogPath $LogPath; $P2Stages+=@{name=$Stage;exitCode=$StageExit}; if($StageExit -ne 0){$ReleaseExit=$StageExit; break}
      }
    } finally { Pop-Location }
    $RunRecord['p2Stages']=$P2Stages; $RunRecord['status']=if($ReleaseExit -eq 0){'passed'}else{'failed'}; $RunRecord['finishedAt']=(Get-Date).ToUniversalTime().ToString('o'); Write-JsonUtf8NoBom $ReleaseRunPath $RunRecord
  }
  $env:ARTISYS_REPORT_PATH=$ReportPath; $env:ARTISYS_LOG_PATH=$LogPath; $env:ARTISYS_STATUS_CONTEXT=$StatusContext; $env:ARTISYS_CI_RESULT=if($ReleaseExit -eq 0){'success'}else{'failure'}; & node $ReporterCli; $ReporterExit=$LASTEXITCODE
  $RunRecord['reporterExit']=$ReporterExit; $RunRecord['reportedAt']=(Get-Date).ToUniversalTime().ToString('o'); if($ReporterExit -ne 0){$RunRecord['status']='failed'}; Write-JsonUtf8NoBom $ReleaseRunPath $RunRecord
  if($ReleaseExit -ne 0){exit $ReleaseExit}; if($ReporterExit -ne 0){exit $ReporterExit}; exit 0
} finally { if($WorktreeCreated){& git -C $UtilidadesPath worktree remove $TempWorktree 2>$null; if($LASTEXITCODE -ne 0){Write-Warning "Worktree temporario nao removido: $TempWorktree"}; & git -C $UtilidadesPath worktree prune 2>$null} }
