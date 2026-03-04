param(
  [Parameter(Mandatory = $true)]
  [string]$TemplateDocxPath,
  [Parameter(Mandatory = $true)]
  [string]$DataJsonPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDocxPath,
  [switch]$ExportPdf,
  [switch]$AppendFrontMatter
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$PathValue)
  $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction Stop
  return $resolved.Path
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

function Replace-AllInRange {
  param(
    [object]$Range,
    [string]$FindText,
    [string]$ReplaceText
  )
  if ([string]::IsNullOrWhiteSpace($FindText)) { return }
  $find = $Range.Find
  $find.ClearFormatting()
  $find.Replacement.ClearFormatting()
  $find.Text = $FindText
  $find.Replacement.Text = $ReplaceText
  $wdFindContinue = 1
  $wdReplaceAll = 2
  [void]$find.Execute($FindText, $false, $false, $false, $false, $false, $true, $wdFindContinue, $false, $ReplaceText, $wdReplaceAll)
}

$templateFullPath = Resolve-FullPath -PathValue $TemplateDocxPath
$dataFullPath = Resolve-FullPath -PathValue $DataJsonPath
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocxPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFullPath)
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$jsonRaw = Get-Content -LiteralPath $dataFullPath -Raw -Encoding UTF8
$dataObj = $jsonRaw | ConvertFrom-Json
$fields = @{}
foreach ($prop in $dataObj.PSObject.Properties) {
  $fields[[string]$prop.Name] = [string]$prop.Value
}

$finalOutputPath = Resolve-WritableOutputPath -DesiredPath $outputFullPath
Copy-Item -LiteralPath $templateFullPath -Destination $finalOutputPath -Force

$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($finalOutputPath)

  # 1) Placeholder token replacement if template already has {{TOKENS}}.
  foreach ($entry in $fields.GetEnumerator()) {
    $token = "{{{0}}}" -f [string]$entry.Key
    $value = [string]$entry.Value
    Replace-AllInRange -Range $doc.Content -FindText $token -ReplaceText $value
    foreach ($section in $doc.Sections) {
      foreach ($header in $section.Headers) {
        Replace-AllInRange -Range $header.Range -FindText $token -ReplaceText $value
      }
      foreach ($footer in $section.Footers) {
        Replace-AllInRange -Range $footer.Range -FindText $token -ReplaceText $value
      }
    }
  }

  # 2) Legacy school-cover markers.
  $supervisor = Get-Field -Fields $fields -Name "SUPERVISOR_NAME"
  $studentName = Get-Field -Fields $fields -Name "STUDENT_NAME"
  $studentId = Get-Field -Fields $fields -Name "STUDENT_ID"
  $thesisTitle = Get-Field -Fields $fields -Name "THESIS_TITLE"
  $city = Get-Field -Fields $fields -Name "CITY"
  $year = Get-Field -Fields $fields -Name "YEAR"

  if (-not [string]::IsNullOrWhiteSpace($supervisor)) {
    Replace-AllInRange -Range $doc.Content -FindText "GVHD:" -ReplaceText ("GVHD: " + $supervisor)
  }
  if (-not [string]::IsNullOrWhiteSpace($studentName)) {
    Replace-AllInRange -Range $doc.Content -FindText "SVTH:" -ReplaceText ("SVTH: " + $studentName)
  }
  if (-not [string]::IsNullOrWhiteSpace($studentId)) {
    Replace-AllInRange -Range $doc.Content -FindText "MSSV:" -ReplaceText ("MSSV: " + $studentId)
  }
  if (-not [string]::IsNullOrWhiteSpace($thesisTitle)) {
    Replace-AllInRange -Range $doc.Content -FindText "TÊN ĐỀ TÀI" -ReplaceText $thesisTitle
    Replace-AllInRange -Range $doc.Content -FindText "TEN DE TAI" -ReplaceText $thesisTitle
  }
  if ((-not [string]::IsNullOrWhiteSpace($city)) -and (-not [string]::IsNullOrWhiteSpace($year))) {
    Replace-AllInRange -Range $doc.Content -FindText "TP.HCM," -ReplaceText ($city + ",")
    Replace-AllInRange -Range $doc.Content -FindText "/…." -ReplaceText $year
  }

  # 3) Optional: append acknowledgement/instructor section on a new page.
  $ackText = Get-Field -Fields $fields -Name "ACKNOWLEDGEMENT_TEXT"
  $ackTitle = Get-Field -Fields $fields -Name "ACKNOWLEDGEMENT_TITLE" -DefaultValue "ACKNOWLEDGEMENTS"
  $instructorComment = Get-Field -Fields $fields -Name "INSTRUCTOR_COMMENT"

  if ($AppendFrontMatter.IsPresent -and ((-not [string]::IsNullOrWhiteSpace($ackText)) -or (-not [string]::IsNullOrWhiteSpace($instructorComment)))) {
    $wdCollapseEnd = 0
    $wdPageBreak = 7
    $wdAlignParagraphCenter = 1
    $wdAlignParagraphLeft = 0

    $range = $doc.Content
    $range.Collapse($wdCollapseEnd)
    $range.InsertBreak($wdPageBreak)

    $sel = $word.Selection
    $sel.EndKey(6) | Out-Null
    $sel.ParagraphFormat.Alignment = $wdAlignParagraphCenter
    $sel.Font.Name = "Times New Roman"
    $sel.Font.Size = 16
    $sel.Font.Bold = 1
    $sel.TypeText($ackTitle)
    $sel.TypeParagraph()
    $sel.TypeParagraph()

    $sel.ParagraphFormat.Alignment = $wdAlignParagraphLeft
    $sel.Font.Size = 13
    $sel.Font.Bold = 0
    if (-not [string]::IsNullOrWhiteSpace($ackText)) {
      foreach ($line in ($ackText -split "(`r`n|`n|`r)")) {
        if ([string]::IsNullOrWhiteSpace($line)) {
          $sel.TypeParagraph()
        } else {
          $sel.TypeText($line)
          $sel.TypeParagraph()
        }
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($instructorComment)) {
      $sel.TypeParagraph()
      $sel.Font.Bold = 1
      $sel.TypeText("Instructor Comment")
      $sel.TypeParagraph()
      $sel.Font.Bold = 0
      foreach ($line in ($instructorComment -split "(`r`n|`n|`r)")) {
        if ([string]::IsNullOrWhiteSpace($line)) {
          $sel.TypeParagraph()
        } else {
          $sel.TypeText($line)
          $sel.TypeParagraph()
        }
      }
    }
  }

  # 16 = wdFormatDocumentDefault (.docx)
  $wdFormatDocumentDefault = 16
  $doc.SaveAs([ref]$finalOutputPath, [ref]$wdFormatDocumentDefault)

  if ($ExportPdf.IsPresent) {
    $pdfPath = [System.IO.Path]::ChangeExtension($finalOutputPath, ".pdf")
    # 17 = wdFormatPDF
    $wdFormatPDF = 17
    $doc.SaveAs([ref]$pdfPath, [ref]$wdFormatPDF)
    Write-Output ("PDF generated: {0}" -f $pdfPath)
  }

  Write-Output ("Word autofill DOCX generated: {0}" -f $finalOutputPath)
} finally {
  if ($doc -ne $null) {
    $doc.Close([ref]$false) | Out-Null
  }
  if ($word -ne $null) {
    $word.Quit()
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
