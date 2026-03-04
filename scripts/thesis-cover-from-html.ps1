param(
  [Parameter(Mandatory = $true)]
  [string]$HtmlPath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDocxPath
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$PathValue)
  $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction Stop
  return $resolved.Path
}

$htmlFullPath = Resolve-FullPath -PathValue $HtmlPath
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDocxPath)
$outputDir = [System.IO.Path]::GetDirectoryName($outputFullPath)
if (-not [string]::IsNullOrWhiteSpace($outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($htmlFullPath)

  # 16 = wdFormatDocumentDefault (.docx)
  $wdFormatDocumentDefault = 16
  $doc.SaveAs([ref]$outputFullPath, [ref]$wdFormatDocumentDefault)

  Write-Output ("DOCX generated: {0}" -f $outputFullPath)
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

