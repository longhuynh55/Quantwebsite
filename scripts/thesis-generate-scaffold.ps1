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

function Get-RequiredField {
  param(
    [object]$Config,
    [string]$Name
  )
  $prop = $Config.PSObject.Properties[$Name]
  if ($null -eq $prop -or [string]::IsNullOrWhiteSpace([string]$prop.Value)) {
    throw "Missing required field in config: $Name"
  }
  return [string]$prop.Value
}

function Get-OptionalField {
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

function Convert-ToSlug {
  param([string]$InputText)
  $ascii = $InputText.ToLowerInvariant()
  $ascii = [System.Text.RegularExpressions.Regex]::Replace($ascii, "[^a-z0-9]+", "-")
  $ascii = $ascii.Trim("-")
  if ([string]::IsNullOrWhiteSpace($ascii)) { return "thesis" }
  return $ascii
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

$configFullPath = Resolve-FullPath -PathValue $ConfigPath
$jsonRaw = Get-Content -LiteralPath $configFullPath -Raw -Encoding UTF8
$config = $jsonRaw | ConvertFrom-Json

$title = Get-RequiredField -Config $config -Name "thesis_title"
$studentName = Get-RequiredField -Config $config -Name "student_name"
$studentId = Get-RequiredField -Config $config -Name "student_id"
$supervisorName = Get-RequiredField -Config $config -Name "supervisor_name"
$programClass = Get-OptionalField -Config $config -Name "class" -DefaultValue "N/A"
$city = Get-OptionalField -Config $config -Name "city" -DefaultValue "Ho Chi Minh City"
$monthYear = Get-OptionalField -Config $config -Name "month_year" -DefaultValue "March 2026"
$facultyName = Get-OptionalField -Config $config -Name "faculty_name" -DefaultValue "Faculty of Finance and Banking"
$universityName = Get-OptionalField -Config $config -Name "university_name" -DefaultValue "University of Economics and Law"
$keywords = Get-OptionalField -Config $config -Name "keywords" -DefaultValue "AI assistant, strategy building, quantitative finance"

$slug = Convert-ToSlug -InputText $title
$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $OutputDir = Join-Path $repoRoot ("docs/thesis/generated/{0}" -f $slug)
}
$outputFullPath = [System.IO.Path]::GetFullPath($OutputDir)

if ((Test-Path -LiteralPath $outputFullPath) -and (-not $Force.IsPresent)) {
  throw "Output directory already exists: $outputFullPath. Use -Force to overwrite."
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
New-Item -ItemType Directory -Path (Join-Path $outputFullPath "chapters") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outputFullPath "figures") -Force | Out-Null

$coverData = [ordered]@{
  UNIVERSITY_NAME      = "VIET NAM NATIONAL UNIVERSITY HO CHI MINH CITY"
  FACULTY_NAME         = $facultyName
  THESIS_TITLE         = $title
  STUDENT_NAME         = $studentName
  STUDENT_ID           = $studentId
  SUPERVISOR_NAME      = $supervisorName
  CLASS                = $programClass
  CITY                 = $city
  YEAR                 = ($monthYear -replace ".*\s", "")
  ACKNOWLEDGEMENT_TITLE = "ACKNOWLEDGEMENTS"
  ACKNOWLEDGEMENT_TEXT = "<Write acknowledgement text here>"
  INSTRUCTOR_COMMENT   = ""
}
$coverDataJson = $coverData | ConvertTo-Json -Depth 4
Write-Utf8File -Path (Join-Path $outputFullPath "cover_data.json") -Content $coverDataJson

$readme = @"
# Thesis Scaffold: $title

This scaffold is generated from a format profile based on the school sample thesis.

## Metadata
- Student: $studentName
- Student ID: $studentId
- Supervisor: $supervisorName
- Class: $programClass
- Institution: $universityName
- Faculty: $facultyName
- Date line: $city, $monthYear

## Front-matter format order
1. Cover page
2. Acknowledgements (roman numeral i)
3. Instructor's comment (roman numeral ii)
4. Table of contents
5. List of figures and tables
6. Abbreviations
7. Abstract

## Writing flow
1. Draft Chapter 1 in `chapters/ch1_introduction.md`.
2. Draft Chapter 2 in `chapters/ch2_literature_review.md`.
3. Draft Chapter 3 in `chapters/ch3_methodology_and_system_design.md`.
4. Draft Chapter 4 in `chapters/ch4_results_and_discussion.md`.
5. Draft Chapter 5 in `chapters/ch5_conclusion_and_recommendations.md`.
6. Register all citations in `references_apa.md`.

## Cover autofill
Use generated `cover_data.json` with the existing cover script:

```powershell
pnpm -C quant-website run thesis:cover:autofill -- `
  -TemplateDocxPath "docs/thesis/templates/school_cover_template.docx" `
  -DataJsonPath "docs/thesis/generated/$slug/cover_data.json" `
  -OutputDocxPath "docs/thesis/generated/$slug/cover_output.docx" `
  -AppendFrontMatter
```
"@
Write-Utf8File -Path (Join-Path $outputFullPath "README.md") -Content $readme

$master = @"
# $title

## Abstract
<Write a 200-300 word abstract summarizing problem, method, results, and contribution.>

Keywords: $keywords

## Chapter 1: Introduction
Source: `chapters/ch1_introduction.md`

## Chapter 2: Literature Review
Source: `chapters/ch2_literature_review.md`

## Chapter 3: Research Methodology and System Design
Source: `chapters/ch3_methodology_and_system_design.md`

## Chapter 4: Results and Discussion
Source: `chapters/ch4_results_and_discussion.md`

## Chapter 5: Conclusion and Recommendations
Source: `chapters/ch5_conclusion_and_recommendations.md`

## References
Source: `references_apa.md`
"@
Write-Utf8File -Path (Join-Path $outputFullPath "thesis_master.md") -Content $master

$ch1 = @(
  "# Chapter 1. Introduction",
  "",
  "## 1.1 Statement of the Problem",
  "<Define practical and research gaps that the product addresses.>",
  "",
  "## 1.2 Research Objectives",
  "### 1.2.1 General Objective",
  "<State one overarching objective.>",
  "",
  "### 1.2.2 Specific Objectives",
  "<List 3-5 measurable objectives aligned to system features and evaluation.>",
  "",
  "## 1.3 Research Questions",
  "RQ1: <...>",
  "RQ2: <...>",
  "RQ3: <...>",
  "",
  "## 1.4 Research Hypotheses",
  "H1: <...>",
  "H2: <...>",
  "H3: <...>",
  "",
  "## 1.5 Subject and Scope of Study",
  "<Define context, data scope, user scope, and constraints.>",
  "",
  "## 1.6 Research Method Overview",
  "<Explain method at a high level and chapter roadmap.>",
  "",
  "## References",
  "<Chapter-only references in APA 7.>"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "chapters/ch1_introduction.md") -Content $ch1

$ch2 = @(
  "# Chapter 2. Literature Review",
  "",
  "## 2.1 Traditional Finance Foundations",
  "<Portfolio theory, risk-return tradeoff, market microstructure, factor intuition.>",
  "",
  "## 2.2 Quantitative and Algorithmic Finance",
  "<Backtesting principles, overfitting controls, transaction cost modeling, robustness.>",
  "",
  "## 2.3 Machine Learning in Finance",
  "<Feature engineering, model risk, non-stationarity, evaluation pitfalls.>",
  "",
  "## 2.4 AI Assistant and Human-in-the-Loop Decision Support",
  "<Grounding, reliability, abstention policy, explainability in financial workflows.>",
  "",
  "## 2.5 Synthesis and Research Gap",
  "<From old to new: traditional finance -> quant systems -> ML -> AI assistant product gap.>",
  "",
  "## 2.6 Conceptual Framework",
  "<Map literature constructs to product modules and evaluation criteria.>",
  "",
  "## References",
  "<Chapter-only references in APA 7 with DOI/URL where available.>"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "chapters/ch2_literature_review.md") -Content $ch2

$ch3 = @(
  "# Chapter 3. Research Methodology and System Design",
  "",
  "## 3.1 Research Design",
  "<State design type, rationale, and validity strategy.>",
  "",
  "## 3.2 System Context and Functional Workflow",
  "<Describe user journey and functional flow in thesis language.>",
  "",
  "## 3.3 Data Description and Processing",
  "<Describe input datasets, preprocessing, quality checks, and limitations.>",
  "",
  "## 3.4 Evaluation Criteria and Measurement Plan",
  "<Define indicators, thresholds, and interpretation aligned to RQ/Hypotheses.>",
  "",
  "## 3.5 Ethical and Operational Considerations",
  "<Reliability limits, misuse prevention, reproducibility controls.>",
  "",
  "## References",
  "<Chapter-only references in APA 7.>"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "chapters/ch3_methodology_and_system_design.md") -Content $ch3

$ch4 = @(
  "# Chapter 4. Results and Discussion",
  "",
  "## 4.1 Experimental Setup and Scenarios",
  "<Describe setup and scenario groups.>",
  "",
  "## 4.2 Core Results",
  "<Present key metrics and observations.>",
  "",
  "## 4.3 Discussion by Research Question",
  "<Answer RQ1/RQ2/RQ3 with evidence.>",
  "",
  "## 4.4 Hypothesis Assessment",
  "<Accept/reject/partially support each hypothesis with rationale.>",
  "",
  "## 4.5 Threats to Validity",
  "<Internal, external, construct validity.>",
  "",
  "## References",
  "<Chapter-only references in APA 7.>"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "chapters/ch4_results_and_discussion.md") -Content $ch4

$ch5 = @(
  "# Chapter 5. Conclusion and Recommendations",
  "",
  "## 5.1 Conclusion",
  "<Summarize contribution and findings against objectives.>",
  "",
  "## 5.2 Practical Recommendations",
  "<Actionable recommendations for users, supervisors, and future teams.>",
  "",
  "## 5.3 Limitations",
  "<State key limitations clearly and precisely.>",
  "",
  "## 5.4 Future Work",
  "<Prioritized roadmap for next iteration.>"
) -join "`r`n"
Write-Utf8File -Path (Join-Path $outputFullPath "chapters/ch5_conclusion_and_recommendations.md") -Content $ch5

$references = @"
# References (APA 7 Master List)

## Instructions
- Keep this as the master list for the whole thesis.
- Use DOI or stable URL for each entry when available.
- Ensure in-text citations exactly match author-year in this file.

## Entries
1. <Author, A. A., & Author, B. B. (Year). Title. Journal, volume(issue), pages. https://doi.org/...>
"@
Write-Utf8File -Path (Join-Path $outputFullPath "references_apa.md") -Content $references

$figures = @"
# Figure Plan

## Chapter 2
- Figure 2.1: Traditional finance to AI-assisted strategy workflow
- Figure 2.2: Literature-to-design mapping

## Chapter 3
- Figure 3.1: System context diagram
- Figure 3.2: Functional workflow diagram
- Figure 3.3: Data processing workflow
- Figure 3.4: Evaluation workflow

## Chapter 4
- Figure 4.1: User interface - landing and navigation
- Figure 4.2: User interface - strategy builder
- Figure 4.3: User interface - strategy lab results
"@
Write-Utf8File -Path (Join-Path $outputFullPath "figures/FIGURE_PLAN.md") -Content $figures

$checklist = @"
# Thesis Consistency Checklist

- [ ] Chapter objectives align with Research Questions.
- [ ] Hypotheses are testable and mapped to metrics.
- [ ] Chapter 3 method supports Chapter 4 analysis.
- [ ] All figures are cited and discussed in text.
- [ ] Every in-text citation appears in `references_apa.md`.
- [ ] Final conclusion answers all research questions directly.
"@
Write-Utf8File -Path (Join-Path $outputFullPath "QUALITY_CHECKLIST.md") -Content $checklist

# Fallback safeguard: always keep these two root files for writing workflow.
$readmePath = Join-Path $outputFullPath "README.md"
if (-not (Test-Path -LiteralPath $readmePath)) {
  $fallbackReadme = @(
    "# Thesis Scaffold: $title",
    "",
    "- Student: $studentName",
    "- Student ID: $studentId",
    "- Supervisor: $supervisorName",
    "",
    "Use chapter files in chapters/ and references in references_apa.md."
  ) -join "`r`n"
  Write-Utf8File -Path $readmePath -Content $fallbackReadme
}

$masterPath = Join-Path $outputFullPath "thesis_master.md"
if (-not (Test-Path -LiteralPath $masterPath)) {
  $fallbackMaster = @(
    "# $title",
    "",
    "## Chapter 1",
    "Source: chapters/ch1_introduction.md",
    "",
    "## Chapter 2",
    "Source: chapters/ch2_literature_review.md",
    "",
    "## Chapter 3",
    "Source: chapters/ch3_methodology_and_system_design.md",
    "",
    "## Chapter 4",
    "Source: chapters/ch4_results_and_discussion.md",
    "",
    "## Chapter 5",
    "Source: chapters/ch5_conclusion_and_recommendations.md",
    "",
    "## References",
    "Source: references_apa.md"
  ) -join "`r`n"
  Write-Utf8File -Path $masterPath -Content $fallbackMaster
}

$ch1Path = Join-Path $outputFullPath "chapters/ch1_introduction.md"
$needsCh1Fallback = $true
if (Test-Path -LiteralPath $ch1Path) {
  $ch1Info = Get-Item -LiteralPath $ch1Path
  if ($ch1Info.Length -gt 20) {
    $needsCh1Fallback = $false
  }
}
if ($needsCh1Fallback) {
  $fallbackCh1 = @(
    "# Chapter 1. Introduction",
    "",
    "## 1.1 Statement of the Problem",
    "<Define practical and research gaps that the product addresses.>",
    "",
    "## 1.2 Research Objectives",
    "### 1.2.1 General Objective",
    "<State one overarching objective.>",
    "",
    "### 1.2.2 Specific Objectives",
    "<List 3-5 measurable objectives aligned to system features and evaluation.>",
    "",
    "## 1.3 Research Questions",
    "RQ1: <...>",
    "RQ2: <...>",
    "RQ3: <...>",
    "",
    "## 1.4 Research Hypotheses",
    "H1: <...>",
    "H2: <...>",
    "H3: <...>",
    "",
    "## 1.5 Subject and Scope of Study",
    "<Define context, data scope, user scope, and constraints.>",
    "",
    "## 1.6 Research Method Overview",
    "<Explain method at a high level and chapter roadmap.>",
    "",
    "## References",
    "<Chapter-only references in APA 7.>"
  ) -join "`r`n"
  Write-Utf8File -Path $ch1Path -Content $fallbackCh1
}

$ch2Path = Join-Path $outputFullPath "chapters/ch2_literature_review.md"
if ((-not (Test-Path -LiteralPath $ch2Path)) -or ((Get-Item -LiteralPath $ch2Path).Length -le 20)) {
  $fallbackCh2 = @(
    "# Chapter 2. Literature Review",
    "",
    "## 2.1 Traditional Finance Foundations",
    "<Portfolio theory, risk-return tradeoff, market microstructure, factor intuition.>",
    "",
    "## 2.2 Quantitative and Algorithmic Finance",
    "<Backtesting principles, overfitting controls, transaction cost modeling, robustness.>",
    "",
    "## 2.3 Machine Learning in Finance",
    "<Feature engineering, model risk, non-stationarity, evaluation pitfalls.>",
    "",
    "## 2.4 AI Assistant and Human-in-the-Loop Decision Support",
    "<Grounding, reliability, abstention policy, explainability in financial workflows.>",
    "",
    "## 2.5 Synthesis and Research Gap",
    "<From old to new: traditional finance -> quant systems -> ML -> AI assistant product gap.>",
    "",
    "## 2.6 Conceptual Framework",
    "<Map literature constructs to product modules and evaluation criteria.>",
    "",
    "## References",
    "<Chapter-only references in APA 7 with DOI/URL where available.>"
  ) -join "`r`n"
  Write-Utf8File -Path $ch2Path -Content $fallbackCh2
}

$ch3Path = Join-Path $outputFullPath "chapters/ch3_methodology_and_system_design.md"
if ((-not (Test-Path -LiteralPath $ch3Path)) -or ((Get-Item -LiteralPath $ch3Path).Length -le 20)) {
  $fallbackCh3 = @(
    "# Chapter 3. Research Methodology and System Design",
    "",
    "## 3.1 Research Design",
    "<State design type, rationale, and validity strategy.>",
    "",
    "## 3.2 System Context and Functional Workflow",
    "<Describe user journey and functional flow in thesis language.>",
    "",
    "## 3.3 Data Description and Processing",
    "<Describe input datasets, preprocessing, quality checks, and limitations.>",
    "",
    "## 3.4 Evaluation Criteria and Measurement Plan",
    "<Define indicators, thresholds, and interpretation aligned to RQ/Hypotheses.>",
    "",
    "## 3.5 Ethical and Operational Considerations",
    "<Reliability limits, misuse prevention, reproducibility controls.>",
    "",
    "## References",
    "<Chapter-only references in APA 7.>"
  ) -join "`r`n"
  Write-Utf8File -Path $ch3Path -Content $fallbackCh3
}

$ch4Path = Join-Path $outputFullPath "chapters/ch4_results_and_discussion.md"
if ((-not (Test-Path -LiteralPath $ch4Path)) -or ((Get-Item -LiteralPath $ch4Path).Length -le 20)) {
  $fallbackCh4 = @(
    "# Chapter 4. Results and Discussion",
    "",
    "## 4.1 Experimental Setup and Scenarios",
    "<Describe setup and scenario groups.>",
    "",
    "## 4.2 Core Results",
    "<Present key metrics and observations.>",
    "",
    "## 4.3 Discussion by Research Question",
    "<Answer RQ1/RQ2/RQ3 with evidence.>",
    "",
    "## 4.4 Hypothesis Assessment",
    "<Accept/reject/partially support each hypothesis with rationale.>",
    "",
    "## 4.5 Threats to Validity",
    "<Internal, external, construct validity.>",
    "",
    "## References",
    "<Chapter-only references in APA 7.>"
  ) -join "`r`n"
  Write-Utf8File -Path $ch4Path -Content $fallbackCh4
}

$ch5Path = Join-Path $outputFullPath "chapters/ch5_conclusion_and_recommendations.md"
if ((-not (Test-Path -LiteralPath $ch5Path)) -or ((Get-Item -LiteralPath $ch5Path).Length -le 20)) {
  $fallbackCh5 = @(
    "# Chapter 5. Conclusion and Recommendations",
    "",
    "## 5.1 Conclusion",
    "<Summarize contribution and findings against objectives.>",
    "",
    "## 5.2 Practical Recommendations",
    "<Actionable recommendations for users, supervisors, and future teams.>",
    "",
    "## 5.3 Limitations",
    "<State key limitations clearly and precisely.>",
    "",
    "## 5.4 Future Work",
    "<Prioritized roadmap for next iteration.>"
  ) -join "`r`n"
  Write-Utf8File -Path $ch5Path -Content $fallbackCh5
}

Write-Output ("Thesis scaffold generated at: {0}" -f $outputFullPath)
