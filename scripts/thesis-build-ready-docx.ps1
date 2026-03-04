param(
  [Parameter(Mandatory = $true)]
  [string]$BaseDocxPath,
  [string[]]$MarkdownPaths,
  [string]$MarkdownPathsCsv = "",
  [Parameter(Mandatory = $true)]
  [string]$ReferencesPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDocxPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputMarkdownPath,
  [switch]$IncludeFrontMatterPlaceholders
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$PathValue)
  $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction Stop
  return $resolved.Path
}

function Escape-XmlText {
  param([string]$Value)
  if ($null -eq $Value) { return "" }
  return $Value.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;")
}

function Build-ParagraphXml {
  param(
    [string]$Text,
    [int]$Level = 0
  )

  $escaped = Escape-XmlText -Value $Text
  $font = "Times New Roman"
  $bold = ""
  $size = 26
  $jc = "both"
  $spacingBefore = 0
  $spacingAfter = 120
  $line = 360
  $indent = "<w:ind w:firstLine=`"720`"/>"

  if ($Level -eq 1) {
    $bold = "<w:b/>"
    $size = 34
    $jc = "left"
    $spacingBefore = 240
    $spacingAfter = 160
    $line = 300
    $indent = ""
  } elseif ($Level -eq 2) {
    $bold = "<w:b/>"
    $size = 30
    $jc = "left"
    $spacingBefore = 180
    $spacingAfter = 140
    $line = 300
    $indent = ""
  } elseif ($Level -eq 3) {
    $bold = "<w:b/>"
    $size = 28
    $jc = "left"
    $spacingBefore = 120
    $spacingAfter = 120
    $line = 300
    $indent = ""
  }

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return "<w:p><w:pPr><w:spacing w:before=`"0`" w:after=`"60`" w:line=`"240`" w:lineRule=`"auto`"/></w:pPr></w:p>"
  }

  return "<w:p><w:pPr><w:jc w:val=`"$jc`"/><w:spacing w:before=`"$spacingBefore`" w:after=`"$spacingAfter`" w:line=`"$line`" w:lineRule=`"auto`"/>$indent</w:pPr><w:r><w:rPr><w:rFonts w:ascii=`"$font`" w:hAnsi=`"$font`" w:cs=`"$font`"/>$bold<w:sz w:val=`"$size`"/><w:szCs w:val=`"$size`"/></w:rPr><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function Build-PageBreakXml {
  return "<w:p><w:r><w:br w:type=`"page`"/></w:r></w:p>"
}

function Convert-MarkdownLinesToOpenXml {
  param([string[]]$Lines)

  $parts = @()
  foreach ($line in $Lines) {
    if ($line.StartsWith("### ")) {
      $parts += Build-ParagraphXml -Text ($line.Substring(4)) -Level 3
      continue
    }
    if ($line.StartsWith("## ")) {
      $parts += Build-ParagraphXml -Text ($line.Substring(3)) -Level 2
      continue
    }
    if ($line.StartsWith("# ")) {
      $parts += Build-ParagraphXml -Text ($line.Substring(2)) -Level 1
      continue
    }
    if ($line.StartsWith("- ")) {
      $parts += Build-ParagraphXml -Text ("- " + $line.Substring(2)) -Level 0
      continue
    }
    $parts += Build-ParagraphXml -Text $line -Level 0
  }
  return ($parts -join "")
}

function Resolve-WritableOutputPath {
  param([string]$DesiredPath)
  if (-not (Test-Path -LiteralPath $DesiredPath)) {
    return $DesiredPath
  }
  try {
    Remove-Item -LiteralPath $DesiredPath -Force -ErrorAction Stop
    return $DesiredPath
  } catch {
    $dir = [System.IO.Path]::GetDirectoryName($DesiredPath)
    $name = [System.IO.Path]::GetFileNameWithoutExtension($DesiredPath)
    $ext = [System.IO.Path]::GetExtension($DesiredPath)
    $fallback = Join-Path $dir ("{0}.{1}{2}" -f $name, (Get-Date -Format "yyyyMMdd_HHmmss"), $ext)
    Write-Warning ("Output is locked. Writing fallback file: {0}" -f $fallback)
    return $fallback
  }
}

$baseFull = Resolve-FullPath -PathValue $BaseDocxPath
$refsFull = Resolve-FullPath -PathValue $ReferencesPath

$effectiveMarkdownPaths = @()
if ($MarkdownPaths -and $MarkdownPaths.Count -gt 0) {
  $effectiveMarkdownPaths = $MarkdownPaths
} elseif (-not [string]::IsNullOrWhiteSpace($MarkdownPathsCsv)) {
  $effectiveMarkdownPaths = $MarkdownPathsCsv.Split(";") | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
}
if (-not $effectiveMarkdownPaths -or $effectiveMarkdownPaths.Count -eq 0) {
  throw "Provide markdown files via -MarkdownPaths or -MarkdownPathsCsv."
}

$resolvedMarkdownPaths = @()
foreach ($p in $effectiveMarkdownPaths) {
  $resolvedMarkdownPaths += (Resolve-FullPath -PathValue $p)
}

$outputDocxFull = [System.IO.Path]::GetFullPath($OutputDocxPath)
$outputMdFull = [System.IO.Path]::GetFullPath($OutputMarkdownPath)

$outputDocxDir = [System.IO.Path]::GetDirectoryName($outputDocxFull)
if (-not [string]::IsNullOrWhiteSpace($outputDocxDir)) {
  New-Item -ItemType Directory -Path $outputDocxDir -Force | Out-Null
}
$outputMdDir = [System.IO.Path]::GetDirectoryName($outputMdFull)
if (-not [string]::IsNullOrWhiteSpace($outputMdDir)) {
  New-Item -ItemType Directory -Path $outputMdDir -Force | Out-Null
}

$mdSections = @()
foreach ($mdPath in $resolvedMarkdownPaths) {
  $name = [System.IO.Path]::GetFileName($mdPath)
  $mdSections += "<!-- BEGIN: $name -->"
  $mdSections += (Get-Content -LiteralPath $mdPath -Raw -Encoding UTF8)
  $mdSections += "<!-- END: $name -->"
  $mdSections += ""
}
$mdSections += "<!-- BEGIN: references_apa.md -->"
$mdSections += (Get-Content -LiteralPath $refsFull -Raw -Encoding UTF8)
$mdSections += "<!-- END: references_apa.md -->"
$combinedMarkdown = ($mdSections -join "`r`n")
Set-Content -Path $outputMdFull -Value $combinedMarkdown -Encoding UTF8

$appendXmlParts = @()
if ($IncludeFrontMatterPlaceholders.IsPresent) {
  $appendXmlParts += Build-PageBreakXml
  $appendXmlParts += Build-ParagraphXml -Text "TABLE OF CONTENTS" -Level 1
  $appendXmlParts += Build-ParagraphXml -Text "Generate this page automatically in Word from heading styles." -Level 0

  $appendXmlParts += Build-PageBreakXml
  $appendXmlParts += Build-ParagraphXml -Text "LIST OF TABLES AND FIGURES" -Level 1
  $appendXmlParts += Build-ParagraphXml -Text "Generate list entries automatically after captions are finalized." -Level 0

  $appendXmlParts += Build-PageBreakXml
  $appendXmlParts += Build-ParagraphXml -Text "LIST OF ABBREVIATIONS" -Level 1
  $appendXmlParts += Build-ParagraphXml -Text "Add abbreviations used in chapters." -Level 0
  $appendXmlParts += Build-ParagraphXml -Text "- API: Application Programming Interface" -Level 0
  $appendXmlParts += Build-ParagraphXml -Text "- LLM: Large Language Model" -Level 0
  $appendXmlParts += Build-ParagraphXml -Text "- HOSE: Ho Chi Minh City Stock Exchange" -Level 0

  $appendXmlParts += Build-PageBreakXml
  $appendXmlParts += Build-ParagraphXml -Text "ABSTRACT" -Level 1
  $appendXmlParts += Build-ParagraphXml -Text "Write a 200-300 word abstract summarizing objectives, methods, findings, and contribution." -Level 0
}

foreach ($mdPath in $resolvedMarkdownPaths) {
  $appendXmlParts += Build-PageBreakXml
  $lines = Get-Content -LiteralPath $mdPath -Encoding UTF8
  $appendXmlParts += Convert-MarkdownLinesToOpenXml -Lines $lines
}
$appendXmlParts += Build-PageBreakXml
$appendXmlParts += Build-ParagraphXml -Text "References" -Level 1
$refLines = Get-Content -LiteralPath $refsFull -Encoding UTF8
$appendXmlParts += Convert-MarkdownLinesToOpenXml -Lines $refLines
$appendXml = ($appendXmlParts -join "")

$finalOutputDocx = Resolve-WritableOutputPath -DesiredPath $outputDocxFull
Copy-Item -LiteralPath $baseFull -Destination $finalOutputDocx -Force

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::Open($finalOutputDocx, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $entry = $zip.GetEntry("word/document.xml")
  if ($null -eq $entry) {
    throw "word/document.xml not found in DOCX."
  }

  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
  $xml = $reader.ReadToEnd()
  $reader.Dispose()
  $entry.Delete()

  $insertAt = $xml.LastIndexOf("<w:sectPr")
  if ($insertAt -lt 0) {
    $xml = $xml.Replace("</w:body>", ($appendXml + "</w:body>"))
  } else {
    $xml = $xml.Substring(0, $insertAt) + $appendXml + $xml.Substring($insertAt)
  }

  $newEntry = $zip.CreateEntry("word/document.xml", [System.IO.Compression.CompressionLevel]::Optimal)
  $writer = New-Object System.IO.StreamWriter($newEntry.Open(), (New-Object System.Text.UTF8Encoding($false)))
  $writer.Write($xml)
  $writer.Dispose()
} finally {
  $zip.Dispose()
}

Write-Output ("Ready markdown generated: {0}" -f $outputMdFull)
Write-Output ("Ready thesis DOCX generated: {0}" -f $finalOutputDocx)
