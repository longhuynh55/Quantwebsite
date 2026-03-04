param(
  [Parameter(Mandatory = $true)]
  [string]$TemplateDocxPath,
  [Parameter(Mandatory = $true)]
  [string]$DataJsonPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDocxPath,
  [switch]$AppendFrontMatter
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

function Get-Field {
  param(
    [hashtable]$Fields,
    [string]$Name,
    [string]$DefaultValue = ""
  )
  if ($Fields.ContainsKey($Name) -and $null -ne $Fields[$Name]) {
    return [string]$Fields[$Name]
  }
  return $DefaultValue
}

function Build-ParagraphXml {
  param(
    [string]$Text,
    [string]$Align = "left",
    [bool]$Bold = $false,
    [int]$HalfPointSize = 24,
    [string]$FontName = "Times New Roman",
    [int]$SpacingAfter = 120,
    [int]$SpacingBefore = 0,
    [int]$LineSpacing = 360,
    [int]$FirstLineIndentTwips = 0
  )

  $escaped = Escape-XmlText -Value $Text
  $jc = "<w:jc w:val=`"$Align`"/>"
  $spacing = "<w:spacing w:before=`"$SpacingBefore`" w:after=`"$SpacingAfter`" w:line=`"$LineSpacing`" w:lineRule=`"auto`"/>"
  $indent = ""
  if ($FirstLineIndentTwips -gt 0) {
    $indent = "<w:ind w:firstLine=`"$FirstLineIndentTwips`"/>"
  }
  $boldXml = ""
  if ($Bold) {
    $boldXml = "<w:b/>"
  }

  return "<w:p><w:pPr>$jc$spacing$indent</w:pPr><w:r><w:rPr><w:rFonts w:ascii=`"$FontName`" w:hAnsi=`"$FontName`" w:cs=`"$FontName`"/>$boldXml<w:sz w:val=`"$HalfPointSize`"/><w:szCs w:val=`"$HalfPointSize`"/></w:rPr><w:t xml:space=`"preserve`">$escaped</w:t></w:r></w:p>"
}

function Build-DottedLineParagraphXml {
  param(
    [int]$HalfPointSize = 24
  )

  $dots = "........................................................................................................................"
  return Build-ParagraphXml -Text $dots -Align "left" -Bold $false -HalfPointSize $HalfPointSize -SpacingAfter 60 -SpacingBefore 0 -LineSpacing 300
}

function Build-AcknowledgementBlockXml {
  param([hashtable]$Fields)

  $ackText = Get-Field -Fields $Fields -Name "ACKNOWLEDGEMENT_TEXT"
  $instructorComment = Get-Field -Fields $Fields -Name "INSTRUCTOR_COMMENT"
  if ([string]::IsNullOrWhiteSpace($ackText) -and [string]::IsNullOrWhiteSpace($instructorComment)) {
    return ""
  }

  $ackTitle = Get-Field -Fields $Fields -Name "ACKNOWLEDGEMENT_TITLE" -DefaultValue "ACKNOWLEDGEMENTS"

  $parts = @()
  $parts += "<w:p><w:r><w:br w:type=`"page`"/></w:r></w:p>"
  $parts += Build-ParagraphXml -Text "i" -Align "center" -HalfPointSize 24 -SpacingAfter 120 -LineSpacing 300
  $parts += Build-ParagraphXml -Text $ackTitle -Align "center" -Bold $true -HalfPointSize 30 -SpacingAfter 180 -LineSpacing 300

  if (-not [string]::IsNullOrWhiteSpace($ackText)) {
    $lines = $ackText -split "(`r`n|`n|`r)"
    foreach ($line in $lines) {
      if ($line -match "^(`r|`n)?$") {
        $parts += Build-ParagraphXml -Text "" -Align "both" -HalfPointSize 24 -SpacingAfter 60 -LineSpacing 300
        continue
      }
      $parts += Build-ParagraphXml -Text $line -Align "both" -HalfPointSize 24 -SpacingAfter 60 -LineSpacing 360 -FirstLineIndentTwips 720
    }
  }

  # Keep "Instructor's comment" on a separate page to avoid crowding and match school format.
  $parts += "<w:p><w:r><w:br w:type=`"page`"/></w:r></w:p>"
  $parts += Build-ParagraphXml -Text "ii" -Align "center" -HalfPointSize 24 -SpacingAfter 120 -LineSpacing 300
  $parts += Build-ParagraphXml -Text "INSTRUCTOR'S COMMENT" -Align "center" -Bold $true -HalfPointSize 30 -SpacingAfter 180 -LineSpacing 300

  if (-not [string]::IsNullOrWhiteSpace($instructorComment)) {
    $commentLines = $instructorComment -split "(`r`n|`n|`r)"
    foreach ($line in $commentLines) {
      if ($line -match "^(`r|`n)?$") {
        $parts += Build-DottedLineParagraphXml -HalfPointSize 24
      } else {
        $parts += Build-ParagraphXml -Text $line -Align "left" -HalfPointSize 24 -SpacingAfter 60 -LineSpacing 300
      }
    }
  } else {
    for ($i = 0; $i -lt 9; $i++) {
      $parts += Build-DottedLineParagraphXml -HalfPointSize 24
    }
  }

  return ($parts -join "")
}

function Apply-LegacyCoverMapping {
  param(
    [string]$XmlContent,
    [hashtable]$Fields
  )

  $thesisTitle = Get-Field -Fields $Fields -Name "THESIS_TITLE"
  $studentName = Get-Field -Fields $Fields -Name "STUDENT_NAME"
  $studentId = Get-Field -Fields $Fields -Name "STUDENT_ID"
  $supervisor = Get-Field -Fields $Fields -Name "SUPERVISOR_NAME"

  if (-not [string]::IsNullOrWhiteSpace($supervisor)) {
    $XmlContent = $XmlContent.Replace("GVHD:", "GVHD: " + (Escape-XmlText -Value $supervisor))
  }
  if (-not [string]::IsNullOrWhiteSpace($studentName)) {
    $XmlContent = $XmlContent.Replace("SVTH:", "SVTH: " + (Escape-XmlText -Value $studentName))
  }
  if (-not [string]::IsNullOrWhiteSpace($studentId)) {
    $XmlContent = $XmlContent.Replace("MSSV:", "MSSV: " + (Escape-XmlText -Value $studentId))
  }

    if (-not [string]::IsNullOrWhiteSpace($thesisTitle)) {
      $safeTitle = Escape-XmlText -Value $thesisTitle
      if (-not $XmlContent.Contains($safeTitle)) {
      $titlePara = Build-ParagraphXml -Text $thesisTitle -Align "center" -Bold $true -HalfPointSize 30
      $rx = New-Object System.Text.RegularExpressions.Regex("(<w:p[^>]*>.*?GVHD:.*?</w:p>)", [System.Text.RegularExpressions.RegexOptions]::Singleline)
      if ($rx.IsMatch($XmlContent)) {
        $XmlContent = $rx.Replace($XmlContent, ($titlePara + '$1'), 1)
      }
    }
  }

  return $XmlContent
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

$templateFullPath = Resolve-FullPath -PathValue $TemplateDocxPath
$dataFullPath = Resolve-FullPath -PathValue $DataJsonPath
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocxPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFullPath)
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$jsonRaw = Get-Content -LiteralPath $dataFullPath -Raw -Encoding UTF8
$data = $jsonRaw | ConvertFrom-Json
$fields = @{}
foreach ($prop in $data.PSObject.Properties) {
  $fields[[string]$prop.Name] = [string]$prop.Value
}

$finalOutputPath = Resolve-WritableOutputPath -DesiredPath $outputFullPath
Copy-Item -LiteralPath $templateFullPath -Destination $finalOutputPath -Force

try {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem

  $zip = [System.IO.Compression.ZipFile]::Open($finalOutputPath, [System.IO.Compression.ZipArchiveMode]::Update)

  try {
    $targetEntryNames = @()
    foreach ($entry in $zip.Entries) {
      if ($entry.FullName -eq "word/document.xml" -or $entry.FullName -like "word/header*.xml" -or $entry.FullName -like "word/footer*.xml") {
        $targetEntryNames += $entry.FullName
      }
    }

    foreach ($entryName in $targetEntryNames) {
      $entry = $zip.GetEntry($entryName)
      if ($null -eq $entry) { continue }

      $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)
      $xmlContent = $reader.ReadToEnd()
      $reader.Dispose()

      $entry.Delete()

      foreach ($prop in $data.PSObject.Properties) {
        $token = "{{{0}}}" -f [string]$prop.Name
        $escaped = Escape-XmlText -Value ([string]$prop.Value)
        $xmlContent = $xmlContent.Replace($token, $escaped)
      }

      if ($entryName -eq "word/document.xml") {
        $xmlContent = Apply-LegacyCoverMapping -XmlContent $xmlContent -Fields $fields

        $appendXml = Build-AcknowledgementBlockXml -Fields $fields
        if ($AppendFrontMatter.IsPresent -and (-not [string]::IsNullOrWhiteSpace($appendXml))) {
          $rxSect = New-Object System.Text.RegularExpressions.Regex("<w:sectPr")
          if ($rxSect.IsMatch($xmlContent)) {
            $xmlContent = $rxSect.Replace($xmlContent, ($appendXml + "<w:sectPr"), 1)
          } else {
            $xmlContent = $xmlContent.Replace("</w:body>", ($appendXml + "</w:body>"))
          }
        }
      }

      $newEntry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $writer = New-Object System.IO.StreamWriter($newEntry.Open(), (New-Object System.Text.UTF8Encoding($false)))
      $writer.Write($xmlContent)
      $writer.Dispose()
    }
  } finally {
    $zip.Dispose()
  }

  Write-Output ("Autofilled DOCX generated: {0}" -f $finalOutputPath)
} finally {
  # no-op
}
