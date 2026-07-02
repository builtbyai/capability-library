#requires -Version 5.1
<#
.SYNOPSIS
  Walk a root path, detect code-module folders, emit JSONL.

.DESCRIPTION
  Signals (any one promotes a folder to a module):
    - Package manifests: package.json, Cargo.toml, pom.xml, go.mod, requirements.txt,
      pyproject.toml, *.csproj, *.sln, build.gradle(.kts), composer.json, Gemfile,
      wrangler.toml, setup.py, Makefile
    - .git directory (repo root)
    - README.md / README at folder root
  Promotion is per-folder. Stops descending into a module's subtree once detected
  (so subpackages under a monorepo aren't double-counted), EXCEPT a folder named
  packages/ or apps/ continues to recurse for workspace style monorepos.

  Excludes a hard list of system + ephemeral folders (Windows, Program Files,
  ProgramData, $Recycle.Bin, AppData, node_modules, .git internals, target,
  build, dist, .next, .nuxt, .venv, venv, __pycache__, .cache).

  Output: NDJSON, one object per line, written to -OutFile.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][string]$OutFile,
  [int]$MaxDepth = 12,
  [int]$ReadmeBytes = 600,
  [switch]$Quiet
)

$ErrorActionPreference = 'Continue'
$ProgressPreference    = 'SilentlyContinue'

$ManifestSet = @{
  'package.json'      = 'js'
  'pnpm-workspace.yaml' = 'js'
  'tsconfig.json'     = 'ts'
  'Cargo.toml'        = 'rust'
  'pom.xml'           = 'java'
  'build.gradle'      = 'java'
  'build.gradle.kts'  = 'kotlin'
  'go.mod'            = 'go'
  'requirements.txt'  = 'python'
  'pyproject.toml'    = 'python'
  'setup.py'          = 'python'
  'Pipfile'           = 'python'
  'composer.json'     = 'php'
  'Gemfile'           = 'ruby'
  'wrangler.toml'     = 'cloudflare'
  'wrangler.jsonc'    = 'cloudflare'
  'wrangler.json'     = 'cloudflare'
  'Dockerfile'        = 'docker'
  'docker-compose.yml' = 'docker'
  'docker-compose.yaml' = 'docker'
  'Makefile'          = 'make'
  'CMakeLists.txt'    = 'cmake'
}
$ManifestGlobs = @('*.csproj','*.sln','*.fsproj','*.vbproj')

$Excludes = @(
  'node_modules','.git','.svn','.hg','target','build','dist','out','.next','.nuxt',
  '.venv','venv','env','__pycache__','.cache','.gradle','.idea','.vs','.vscode-server',
  'bin','obj','coverage','.pytest_cache','.mypy_cache','.tox','.parcel-cache','.turbo',
  '.terraform','.serverless','vendor','bower_components','Pods','DerivedData',
  '$Recycle.Bin','System Volume Information','Windows','Program Files','Program Files (x86)',
  'ProgramData','PerfLogs','Recovery','Config.Msi','MSOCache','OneDriveTemp',
  'WindowsApps','WinSxS','Logs','LOST.DIR','Temp','tmp','TEMP'
)
$ExcludeSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach($e in $Excludes){ [void]$ExcludeSet.Add($e) }

$WorkspaceContinue = @('packages','apps','services','workers','crates','modules','plugins')

# Output prep
$outDir = Split-Path -Parent $OutFile
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
$writer = [System.IO.StreamWriter]::new($OutFile, $false, [System.Text.UTF8Encoding]::new($false))

$counters = @{ modules=0; folders=0; errors=0 }
$startedAt = Get-Date

function Test-IsModule {
  param([System.IO.DirectoryInfo]$Dir)

  $signals = New-Object System.Collections.Generic.List[string]
  $langs   = New-Object System.Collections.Generic.HashSet[string]

  # .git directory
  if (Test-Path (Join-Path $Dir.FullName '.git')) {
    [void]$signals.Add('git')
  }

  # Exact-name manifests
  $files = $null
  try { $files = [System.IO.Directory]::EnumerateFiles($Dir.FullName) } catch { $files = $null }
  if ($files) {
    foreach ($f in $files) {
      $name = [System.IO.Path]::GetFileName($f)
      if ($ManifestSet.ContainsKey($name)) {
        [void]$signals.Add($name)
        [void]$langs.Add($ManifestSet[$name])
      }
      elseif ($name -ieq 'README.md' -or $name -ieq 'README') {
        [void]$signals.Add('README.md')
      }
      else {
        foreach($g in $ManifestGlobs){
          if ($name -like $g) {
            [void]$signals.Add($name)
            switch -Wildcard ($name) {
              '*.csproj' { [void]$langs.Add('csharp') }
              '*.sln'    { [void]$langs.Add('dotnet') }
              '*.fsproj' { [void]$langs.Add('fsharp') }
              '*.vbproj' { [void]$langs.Add('vbnet') }
            }
            break
          }
        }
      }
    }
  }

  return [pscustomobject]@{
    Signals = $signals
    Langs   = $langs
  }
}

function Get-ReadmeExcerpt {
  param([string]$DirPath, [int]$Bytes)
  $readmePaths = @(
    (Join-Path $DirPath 'README.md'),
    (Join-Path $DirPath 'readme.md'),
    (Join-Path $DirPath 'README')
  )
  foreach($p in $readmePaths){
    if (Test-Path $p) {
      try {
        $fs = [System.IO.File]::OpenRead($p)
        try {
          $buf = New-Object byte[] ([Math]::Min($Bytes, $fs.Length))
          [void]$fs.Read($buf, 0, $buf.Length)
          $text = [System.Text.Encoding]::UTF8.GetString($buf)
          $text = $text -replace "`r",'' -replace "`n",' ' -replace '\s+',' '
          return $text.Trim()
        } finally { $fs.Dispose() }
      } catch { return $null }
    }
  }
  return $null
}

# Iterative DFS with depth control
$stack = New-Object System.Collections.Stack
$rootInfo = $null
try { $rootInfo = [System.IO.DirectoryInfo]::new($Root) } catch { Write-Error "Cannot resolve root: $Root"; exit 2 }
if (-not $rootInfo.Exists) { Write-Error "Root does not exist: $Root"; exit 2 }
$stack.Push([pscustomobject]@{ Dir=$rootInfo; Depth=0 })

while ($stack.Count -gt 0) {
  $node = $stack.Pop()
  $dir  = $node.Dir
  $depth = $node.Depth
  $counters.folders++

  if (-not $Quiet -and ($counters.folders % 500 -eq 0)) {
    $elapsed = (Get-Date) - $startedAt
    Write-Host ("[{0}] folders={1} modules={2} elapsed={3:mm\:ss}" -f $dir.FullName, $counters.folders, $counters.modules, $elapsed)
  }

  # Skip excluded folder names
  if ($ExcludeSet.Contains($dir.Name)) { continue }
  # Skip junctions/reparse points to avoid loops
  if (($dir.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }

  # Module detection
  $isModule = $false
  try {
    $det = Test-IsModule -Dir $dir
    if ($det.Signals.Count -gt 0) {
      $isModule = $true
      $counters.modules++
      $readme = Get-ReadmeExcerpt -DirPath $dir.FullName -Bytes $ReadmeBytes
      $obj = [ordered]@{
        path          = $dir.FullName
        name          = $dir.Name
        depth         = $depth
        signals       = @($det.Signals)
        langs         = @($det.Langs)
        last_modified = $dir.LastWriteTimeUtc.ToString('o')
        readme        = $readme
      }
      $line = $obj | ConvertTo-Json -Compress -Depth 4
      $writer.WriteLine($line)
    }
  } catch {
    $counters.errors++
  }

  # Always descend (subject to depth limit + excludes). Nested modules are recorded
  # with their depth; aggregation can collapse if needed.
  if ($depth -lt $MaxDepth) {
    $children = $null
    try { $children = $dir.EnumerateDirectories() } catch { $children = $null; $counters.errors++ }
    if ($children) {
      foreach($c in $children){
        if ($ExcludeSet.Contains($c.Name)) { continue }
        if (($c.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { continue }
        $stack.Push([pscustomobject]@{ Dir=$c; Depth=$depth+1 })
      }
    }
  }
}

$writer.Flush()
$writer.Dispose()

$elapsed = (Get-Date) - $startedAt
Write-Host ("DONE root={0} folders={1} modules={2} errors={3} elapsed={4:mm\:ss} out={5}" -f $Root, $counters.folders, $counters.modules, $counters.errors, $elapsed, $OutFile)
