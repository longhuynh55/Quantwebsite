param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDocxPath,
  [string]$WorkDir = ""
)

$ErrorActionPreference = "Stop"

$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocxPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFullPath)
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

if ([string]::IsNullOrWhiteSpace($WorkDir)) {
  $WorkDir = Join-Path $env:TEMP "quantvn-cover-docx-work"
}
$workRoot = [System.IO.Path]::GetFullPath($WorkDir)
New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

$sessionDir = Join-Path $workRoot ([Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sessionDir "_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sessionDir "word") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sessionDir "word\\_rels") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $sessionDir "docProps") | Out-Null

function Write-Utf8NoBom {
  param(
    [string]$Path,
    [string]$Content
  )
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Add-DirectoryToZip {
  param(
    [string]$SourceDir,
    [string]$ZipPath
  )
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $SourceDir,
    $ZipPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
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

try {
  $contentTypesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
'@

  $relsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
'@

  $docRelsXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
'@

  $stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>
'@

  $coreXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Thesis Cover Template</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
</cp:coreProperties>
'@

  $appXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
</Properties>
'@

  $documentXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="28"/></w:rPr><w:t>{{UNIVERSITY_NAME}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="600"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/></w:rPr><w:t>{{FACULTY_NAME}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="36"/></w:rPr><w:t>GRADUATION THESIS</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="560"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/></w:rPr><w:t>{{THESIS_TITLE}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">Student: {{STUDENT_NAME}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">Student ID: {{STUDENT_ID}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="640"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="26"/></w:rPr><w:t xml:space="preserve">Supervisor: {{SUPERVISOR_NAME}}</w:t></w:r></w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="26"/></w:rPr><w:t>{{CITY}}, {{YEAR}}</w:t></w:r></w:p>
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1417" w:right="1134" w:bottom="1417" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
'@

  Write-Utf8NoBom -Path (Join-Path $sessionDir "[Content_Types].xml") -Content $contentTypesXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "_rels\\.rels") -Content $relsXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "word\\document.xml") -Content $documentXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "word\\styles.xml") -Content $stylesXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "word\\_rels\\document.xml.rels") -Content $docRelsXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "docProps\\core.xml") -Content $coreXml
  Write-Utf8NoBom -Path (Join-Path $sessionDir "docProps\\app.xml") -Content $appXml

  $finalOutputPath = Resolve-WritableOutputPath -DesiredPath $outputFullPath
  Add-DirectoryToZip -SourceDir $sessionDir -ZipPath $finalOutputPath

  Write-Output ("Template DOCX generated: {0}" -f $finalOutputPath)
} finally {
  if (Test-Path -LiteralPath $sessionDir) {
    try {
      Remove-Item -LiteralPath $sessionDir -Recurse -Force -ErrorAction Stop
    } catch {
      Write-Warning ("Could not clean work dir: {0}" -f $sessionDir)
    }
  }
}
