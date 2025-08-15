<#!
.SYNOPSIS
  Crée automatiquement les issues GitHub à partir de backlog/issues.json
.DESCRIPTION
  Requiert un token GitHub avec scope 'repo' et variable d'env GITHUB_TOKEN.
  Utilisation:
    $env:GITHUB_TOKEN = 'ghp_xxx'
    ./scripts/create_github_issues.ps1 -Owner balensmatheo -Repo cra-app -DryRun
#>
param(
  [Parameter(Mandatory=$true)] [string]$Owner,
  [Parameter(Mandatory=$true)] [string]$Repo,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$token = $env:GITHUB_TOKEN
if (-not $token) { throw 'GITHUB_TOKEN env var manquante.' }

$issuesPath = Join-Path $PSScriptRoot '..' 'backlog' 'issues.json'
if (-not (Test-Path $issuesPath)) { throw "Fichier non trouvé: $issuesPath" }

$issues = Get-Content $issuesPath | ConvertFrom-Json

function New-IssueBody($issue) {
  @"
Issue auto-générée depuis backlog.

Dépendances: $($issue.dependencies -join ', ')

Tâches:
$([string]::Join("`n", ($issue.tasks | ForEach-Object { "- [ ] $_" })))

Critères d'acceptation:
$([string]::Join("`n", ($issue.acceptance | ForEach-Object { "- [ ] $_" })))

---
DoD Global: lint + build OK, pas d'erreurs console, règles d'accès respectées.
"@
}

$apiBase = "https://api.github.com/repos/$Owner/$Repo/issues"

foreach ($issue in $issues) {
  $title = $issue.title
  $labels = $issue.labels
  $body = New-IssueBody $issue

  Write-Host "Préparation issue: $title" -ForegroundColor Cyan
  if ($DryRun) { continue }

  $payload = @{ title = $title; body = $body; labels = $labels } | ConvertTo-Json -Depth 5
  $resp = Invoke-RestMethod -Uri $apiBase -Method Post -Headers @{Authorization = "Bearer $token"; 'User-Agent'='issue-script'} -Body $payload -ContentType 'application/json'
  Write-Host "Créée #$($resp.number)" -ForegroundColor Green
}

Write-Host "Terminé." -ForegroundColor Yellow
