param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath,
  [string]$OutputDir = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath {
  param([string]$PathValue)
  $resolved = Resolve-Path -LiteralPath $PathValue -ErrorAction Stop
  return $resolved.Path
}

function Write-Utf8File {
  param(
    [string]$Path,
    [string]$Content
  )
  $dir = [System.IO.Path]::GetDirectoryName($Path)
  if (-not [string]::IsNullOrWhiteSpace($dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  Set-Content -Path $Path -Value $Content -Encoding UTF8
}

function Convert-ToSlug {
  param([string]$InputText)
  $ascii = $InputText.ToLowerInvariant()
  $ascii = [System.Text.RegularExpressions.Regex]::Replace($ascii, "[^a-z0-9]+", "-")
  $ascii = $ascii.Trim("-")
  if ([string]::IsNullOrWhiteSpace($ascii)) { return "thesis-layout" }
  return $ascii
}

function Get-Field {
  param(
    [object]$Config,
    [string]$Name,
    [string]$DefaultValue = ""
  )
  $prop = $Config.PSObject.Properties[$Name]
  if ($null -eq $prop -or $null -eq $prop.Value) {
    return $DefaultValue
  }
  return [string]$prop.Value
}

$configFullPath = Resolve-FullPath -PathValue $ConfigPath
$config = (Get-Content -LiteralPath $configFullPath -Raw -Encoding UTF8) | ConvertFrom-Json

$title = Get-Field -Config $config -Name "thesis_title" -DefaultValue "Thesis Title"
$studentName = Get-Field -Config $config -Name "student_name" -DefaultValue "Student Name"
$studentId = Get-Field -Config $config -Name "student_id" -DefaultValue "Student ID"
$supervisor = Get-Field -Config $config -Name "supervisor_name" -DefaultValue "Supervisor Name"
$programClass = Get-Field -Config $config -Name "class" -DefaultValue "Class"
$city = Get-Field -Config $config -Name "city" -DefaultValue "Ho Chi Minh City"
$monthYear = Get-Field -Config $config -Name "month_year" -DefaultValue "March 2026"
$faculty = Get-Field -Config $config -Name "faculty_name" -DefaultValue "Faculty of Finance and Banking"

$slug = Convert-ToSlug -InputText $title
$repoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot ("docs/thesis/generated/layout_{0}" -f $slug)
}
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDir)

if ((Test-Path -LiteralPath $outputFullPath) -and (-not $Force.IsPresent)) {
  throw "Output directory exists: $outputFullPath. Use -Force to overwrite."
}
if (Test-Path -LiteralPath $outputFullPath) {
  try {
    Remove-Item -LiteralPath $outputFullPath -Recurse -Force -ErrorAction Stop
  } catch {
    $fallback = "{0}.{1}" -f $outputFullPath, (Get-Date -Format "yyyyMMdd_HHmmss")
    Write-Warning ("Output directory is locked. Writing to fallback: {0}" -f $fallback)
    $outputFullPath = $fallback
  }
}

New-Item -ItemType Directory -Path $outputFullPath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outputFullPath "front-matter") -Force | Out-Null

$layoutRules = @(
  "# Layout Rules (Reference-Based)",
  "",
  "Reference sample: output/doc/sample_layout_reference.pdf",
  "",
  "## Mandatory order",
  "1. Cover page",
  "2. Acknowledgements (roman numeral i)",
  "3. Instructor's comment (roman numeral ii)",
  "4. Table of contents",
  "5. List of tables and figures",
  "6. List of abbreviations",
  "7. Abstract",
  "",
  "## Typography",
  "- Font: Times New Roman",
  "- Body size: 13 pt (or school rule if stricter)",
  "- Line spacing: 1.5",
  "- Body alignment: Justified",
  "- First-line indent: 1.27 cm (for body paragraphs)",
  "",
  "## Page numbering",
  "- Front matter: roman numerals (i, ii, iii, ...)",
  "- Main chapters: Arabic numerals (1, 2, 3, ...)",
  "",
  "## Cover fields",
  "- Thesis title",
  "- Supervisor",
  "- Student name",
  "- Student ID",
  "- Class",
  "- City and month-year"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "LAYOUT_RULES.md") -Content $layoutRules

$coverData = [ordered]@{
  UNIVERSITY_NAME       = "VIET NAM NATIONAL UNIVERSITY HO CHI MINH CITY"
  FACULTY_NAME          = $faculty
  THESIS_TITLE          = $title
  STUDENT_NAME          = $studentName
  STUDENT_ID            = $studentId
  SUPERVISOR_NAME       = $supervisor
  CLASS                 = $programClass
  CITY                  = $city
  YEAR                  = ($monthYear -replace ".*\s", "")
  ACKNOWLEDGEMENT_TITLE = "ACKNOWLEDGEMENTS"
  ACKNOWLEDGEMENT_TEXT  = "<Write acknowledgement text>"
  INSTRUCTOR_COMMENT    = ""
}
Write-Utf8File -Path (Join-Path $outputFullPath "cover_data.json") -Content ($coverData | ConvertTo-Json -Depth 4)

$ack = @(
  "# Acknowledgements (Page i)",
  "",
  "Write in paragraph form (not bullet points).",
  "Use formal academic tone.",
  "End with student signature line if required by faculty."
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/01_acknowledgements.md") -Content $ack

$instructor = @(
  "# Instructor's Comment (Page ii)",
  "",
  "Leave this page mostly blank for supervisor evaluation.",
  "Use dotted guide lines if your faculty requires manual comments."
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/02_instructor_comment.md") -Content $instructor

$toc = @(
  "# Table of Contents",
  "",
  "Generate automatically in Word using heading styles.",
  "Do not type page numbers manually."
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/03_table_of_contents.md") -Content $toc

$lof = @(
  "# List of Tables and Figures",
  "",
  "Use automatic caption references in Word.",
  "Keep figure captions and table captions consistent."
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/04_list_of_tables_figures.md") -Content $lof

$abbr = @(
  "# List of Abbreviations",
  "",
  "| Abbreviation | Full Form |",
  "|---|---|",
  "| API | Application Programming Interface |",
  "| ML | Machine Learning |",
  "| LLM | Large Language Model |"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/05_abbreviations.md") -Content $abbr

$abstract = @(
  "# Abstract",
  "",
  "Target length: 200-300 words.",
  "Cover: problem, method, key results, contribution."
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "front-matter/06_abstract.md") -Content $abstract

$readme = @(
  "# Thesis Layout Pack",
  "",
  "This pack standardizes document layout only (not chapter logic).",
  "",
  "## Generated files",
  "- LAYOUT_RULES.md",
  "- cover_data.json",
  "- front-matter/*.md",
  "",
  "## Cover generation",
  "Use this command pattern:",
  "pnpm -C quant-website run thesis:cover:autofill --",
  "  -TemplateDocxPath docs/thesis/templates/school_cover_template.docx",
  "  -DataJsonPath <path-to-generated-cover_data.json>",
  "  -OutputDocxPath docs/thesis/generated/cover_output.docx",
  "  -AppendFrontMatter"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "README.md") -Content $readme

Write-Output ("Thesis layout pack generated at: {0}" -f $outputFullPath)
