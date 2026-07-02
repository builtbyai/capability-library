#requires -Version 5.1
<#
.SYNOPSIS
  Merge tools/scan/modules-*.jsonl into generated/inventory/modules-index.json,
  generate sharded generated/inventory/stubs/<bucket>/<slug>.stub.md files,
  write generated/inventory/MODULES.md, and emit
  generated/registry-discovered.yaml (split out of root registry.yaml).
.NOTES
  Phase B rewrite (2026-06-29). Replaces the legacy single-file behavior:
    - Output paths moved under generated/ (was: root)
    - Scanner moved under tools/scan/ (was: _scan/)
    - Stubs are sharded by drive+first-segment bucket
    - Discovered list is no longer appended to root registry.yaml; it lives
      in generated/registry-discovered.yaml. registry.yaml stays curated-only.
    - UTF-8 encoding fix (use ASCII hyphens, no em-dash literals)
#>

[CmdletBinding()]
param(
  [string]$LibRoot       = 'C:\Code\CODE_MODULE_LIBRARY',
  [string]$ScanDir       = 'C:\Code\CODE_MODULE_LIBRARY\tools\scan',
  [string]$GeneratedDir  = 'C:\Code\CODE_MODULE_LIBRARY\generated',
  [string]$IndexJson     = 'C:\Code\CODE_MODULE_LIBRARY\generated\inventory\modules-index.json',
  [string]$ModulesMd     = 'C:\Code\CODE_MODULE_LIBRARY\generated\inventory\MODULES.md',
  [string]$DiscoveredDir = 'C:\Code\CODE_MODULE_LIBRARY\generated\inventory\stubs',
  [string]$DiscoveredYaml = 'C:\Code\CODE_MODULE_LIBRARY\generated\registry-discovered.yaml',
  [int]$ReadmeStubBytes  = 800
)

$ErrorActionPreference = 'Stop'

# Ensure output dirs exist
foreach ($d in @($GeneratedDir, (Join-Path $GeneratedDir 'inventory'), $DiscoveredDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

$files = Get-ChildItem -Path $ScanDir -Filter 'modules-*.jsonl' -File
Write-Host ("Aggregating {0} jsonl files" -f $files.Count)

$modules = [System.Collections.Generic.Dictionary[string,object]]::new()
$totalLines = 0
foreach ($f in $files) {
  $scanName = ($f.BaseName -replace '^modules-','')
  foreach ($line in Get-Content -LiteralPath $f.FullName -Encoding UTF8) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $totalLines++
    try { $obj = $line | ConvertFrom-Json } catch { continue }
    $key = $obj.path.ToLowerInvariant()
    if ($modules.ContainsKey($key)) {
      $existing = $modules[$key]
      $merged = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
      foreach ($s in @($existing.signals)) { [void]$merged.Add($s) }
      foreach ($s in @($obj.signals))      { [void]$merged.Add($s) }
      $existing.signals = @($merged)
      $sources = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
      foreach ($s in @($existing.scan_sources)) { [void]$sources.Add($s) }
      [void]$sources.Add($scanName)
      $existing.scan_sources = @($sources)
    } else {
      $obj | Add-Member -NotePropertyName 'scan_sources' -NotePropertyValue @($scanName) -Force
      $modules[$key] = $obj
    }
  }
}

$arr = @($modules.Values)
Write-Host ("Read {0} lines, {1} unique modules" -f $totalLines, $arr.Count)

function Get-PrimaryLang {
  param($mod)
  if ($mod.langs -and $mod.langs.Count -gt 0) {
    $priority = 'rust','go','java','kotlin','csharp','dotnet','fsharp','vbnet','python','ts','js','php','ruby','cloudflare','docker','make','cmake'
    foreach ($p in $priority) { if ($mod.langs -contains $p) { return $p } }
    return @($mod.langs)[0]
  }
  return 'unknown'
}

function Get-PrimaryRoot {
  param([string]$path)
  if ($path -match '^([A-Z]):\\') {
    $drive = $matches[1] + ':'
    $parts = $path -split '\\', 4
    if ($parts.Length -ge 3 -and $parts[1] -ne '') {
      return ($parts[0] + '\' + $parts[1])
    }
    return $drive + '\'
  }
  return '?'
}

function Get-ShardBucket {
  param([string]$slug)
  switch -Regex ($slug) {
    '^C_Code_'           { return 'c-code' }
    '^C_Users_Public_'   { return 'c-users-public' }
    '^C_Users_Admin_'    { return 'c-users-admin' }
    '^C_Users_'          { return 'c-users-other' }
    '^C_Documents'       { return 'c-documents' }
    '^C_DEV_'            { return 'c-dev' }
    '^C_'                { return 'c-misc' }
    '^E_Users_Admin_'    { return 'e-users-admin' }
    '^E_'                { return 'e-misc' }
    '^G_PROJECTS_'       { return 'g-projects' }
    '^G_'                { return 'g-misc' }
    '^Y_'                { return 'y-mega' }
    default              { return 'misc' }
  }
}

foreach ($m in $arr) {
  $m | Add-Member -NotePropertyName 'primary_lang' -NotePropertyValue (Get-PrimaryLang $m) -Force
  $m | Add-Member -NotePropertyName 'root'         -NotePropertyValue (Get-PrimaryRoot $m.path) -Force
  $m | Add-Member -NotePropertyName 'slug'         -NotePropertyValue ((($m.path -replace '[\\:/]+','_') -replace '\.','_') -replace '_+','_').Trim('_') -Force
}

$arr = $arr | Sort-Object path

$byLang = $arr | Group-Object primary_lang | Sort-Object Count -Descending
$byRoot = $arr | Group-Object root         | Sort-Object Count -Descending
Write-Host '--- by primary_lang ---'
$byLang | ForEach-Object { '{0,-12} {1}' -f $_.Name, $_.Count } | Write-Host
Write-Host '--- by root ---'
$byRoot | ForEach-Object { '{0,-32} {1}' -f $_.Name, $_.Count } | Write-Host

# ---------- modules-index.json ----------
$index = [ordered]@{
  generated_at  = (Get-Date).ToUniversalTime().ToString('o')
  total_modules = $arr.Count
  total_lines   = $totalLines
  scan_roots    = @($files | ForEach-Object { ($_.BaseName -replace '^modules-','') })
  by_primary_lang = @($byLang | ForEach-Object { @{ lang=$_.Name; count=$_.Count } })
  by_root         = @($byRoot | ForEach-Object { @{ root=$_.Name; count=$_.Count } })
  modules = $arr
}
$json = $index | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($IndexJson, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host ("Wrote {0} ({1:N0} bytes)" -f $IndexJson, (Get-Item $IndexJson).Length)

# ---------- sharded stubs ----------
# Wipe existing *.stub.md (per-bucket) before regenerating
Get-ChildItem -Path $DiscoveredDir -Filter '*.stub.md' -Recurse -ErrorAction SilentlyContinue | Remove-Item -Force
$written = 0
$bucketCounts = @{}
foreach ($m in $arr) {
  $hasReal = $false
  foreach ($s in @($m.signals)) {
    if ($s -notin @('README.md','readme.md','README')) { $hasReal = $true; break }
  }
  if (-not $hasReal -and $m.depth -gt 1) { continue }

  $slug = ($m.slug + '').Substring(0, [Math]::Min(120, ($m.slug + '').Length))
  $bucket = Get-ShardBucket $slug
  $bucketDir = Join-Path $DiscoveredDir $bucket
  if (-not (Test-Path $bucketDir)) { New-Item -ItemType Directory -Path $bucketDir -Force | Out-Null }
  $stub = Join-Path $bucketDir ("{0}.stub.md" -f $slug)
  $readme = if ($m.readme) { $m.readme.Substring(0, [Math]::Min($ReadmeStubBytes, $m.readme.Length)) } else { '' }
  $signalsLine = ($m.signals -join ', ')
  $langsLine   = ($m.langs   -join ', ')
  $sourcesLine = ($m.scan_sources -join ', ')
  $content = @"
---
discovered: true
path: $($m.path)
primary_lang: $($m.primary_lang)
last_modified: $($m.last_modified)
signals: [$signalsLine]
langs: [$langsLine]
scan_sources: [$sourcesLine]
---
# $($m.name)

**Path:** ``$($m.path)``
**Signals:** $signalsLine
**Langs:** $langsLine
**Last modified (UTC):** $($m.last_modified)
**Found by scan(s):** $sourcesLine

## README excerpt
$readme
"@
  [System.IO.File]::WriteAllText($stub, $content, [System.Text.UTF8Encoding]::new($false))
  $written++
  if (-not $bucketCounts.ContainsKey($bucket)) { $bucketCounts[$bucket] = 0 }
  $bucketCounts[$bucket]++
}
Write-Host ("Wrote {0} sharded stubs to {1}" -f $written, $DiscoveredDir)
$bucketCounts.GetEnumerator() | Sort-Object Name | ForEach-Object { '  {0,-18} {1}' -f $_.Key, $_.Value } | Write-Host

# ---------- MODULES.md ----------
$md = New-Object System.Text.StringBuilder
[void]$md.AppendLine('# Discovered Modules')
[void]$md.AppendLine('')
[void]$md.AppendLine('Auto-generated from `tools/scan/modules-*.jsonl` by `tools/scan/aggregate.ps1`. Do not edit by hand - regenerate.')
[void]$md.AppendLine('')
[void]$md.AppendLine(('- Generated: {0}' -f $index.generated_at))
[void]$md.AppendLine(('- Total modules: {0}' -f $arr.Count))
[void]$md.AppendLine(('- Scan roots: {0}' -f ($index.scan_roots -join ', ')))
[void]$md.AppendLine('')
[void]$md.AppendLine('## By primary language')
[void]$md.AppendLine('')
[void]$md.AppendLine('| Language | Count |')
[void]$md.AppendLine('|----------|-------|')
foreach ($g in $byLang) { [void]$md.AppendLine(('| {0} | {1} |' -f $g.Name, $g.Count)) }
[void]$md.AppendLine('')
[void]$md.AppendLine('## By root')
[void]$md.AppendLine('')
[void]$md.AppendLine('| Root | Count |')
[void]$md.AppendLine('|------|-------|')
foreach ($g in $byRoot) { [void]$md.AppendLine(('| `{0}` | {1} |' -f $g.Name, $g.Count)) }
[void]$md.AppendLine('')
[void]$md.AppendLine('## All modules')
[void]$md.AppendLine('')
[void]$md.AppendLine('| Name | Lang | Signals | Path | Last Modified |')
[void]$md.AppendLine('|------|------|---------|------|---------------|')
foreach ($m in $arr) {
  $sig = ($m.signals -join ', ')
  if ($sig.Length -gt 60) { $sig = $sig.Substring(0,57) + '...' }
  $name = $m.name -replace '\|','\|'
  $path = $m.path -replace '\|','\|'
  [void]$md.AppendLine(('| {0} | {1} | {2} | `{3}` | {4} |' -f $name, $m.primary_lang, $sig, $path, $m.last_modified))
}
[System.IO.File]::WriteAllText($ModulesMd, $md.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host ("Wrote {0} ({1:N0} bytes)" -f $ModulesMd, (Get-Item $ModulesMd).Length)

# ---------- generated/registry-discovered.yaml ----------
# Stand-alone, schema-valid YAML. Includes `version` for parity with root registry.yaml.
$autoBlock = New-Object System.Text.StringBuilder
[void]$autoBlock.AppendLine('# Auto-generated by tools/scan/aggregate.ps1 - re-run to refresh.')
[void]$autoBlock.AppendLine('# Discovered code modules across the fleet (Library_Folders.txt).')
[void]$autoBlock.AppendLine('# NOT hand-curated capabilities. Promote to registry.yaml capabilities: deliberately.')
[void]$autoBlock.AppendLine('version: 1')
[void]$autoBlock.AppendLine(('generated_at: ' + $index.generated_at))
[void]$autoBlock.AppendLine(('total_modules: ' + $arr.Count))
[void]$autoBlock.AppendLine('discovered:')
foreach ($m in $arr) {
  $name = $m.name
  $p    = ($m.path -replace '\\','/').Replace('"','''')
  $lang = $m.primary_lang
  $sigs = ($m.signals | ForEach-Object { '"' + $_ + '"' }) -join ', '
  [void]$autoBlock.AppendLine(('  - id: ' + ($name -replace '[^a-zA-Z0-9._-]','_') + '_' + $m.last_modified.Substring(0,10)))
  [void]$autoBlock.AppendLine('    path: "' + $p + '"')
  [void]$autoBlock.AppendLine('    primary_lang: ' + $lang)
  [void]$autoBlock.AppendLine('    signals: [' + $sigs + ']')
  [void]$autoBlock.AppendLine('    last_modified: ' + $m.last_modified)
}
[System.IO.File]::WriteAllText($DiscoveredYaml, $autoBlock.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Host ("Wrote {0} ({1} discovered modules)" -f $DiscoveredYaml, $arr.Count)
