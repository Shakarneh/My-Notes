#Requires -Version 5.1
<#
.SYNOPSIS
    Build, package, and publish a new release of My Notes.

.DESCRIPTION
    One-command release. Bumps the version in source files, builds the exe via
    PyInstaller, compiles the Inno Setup installer, commits the bump, pushes to
    origin/main, and publishes a GitHub release with the installer attached.

    Prerequisites (one-time setup):
      - Python venv at .\.venv (already in this repo)
      - Inno Setup 6 installed at "C:\Program Files (x86)\Inno Setup 6"
      - GitHub CLI authenticated:  gh auth login
      - Working tree clean and on main branch

.PARAMETER Version
    Semantic version to release, e.g. "1.3.0".

.PARAMETER Notes
    Release notes (markdown). Shown on the GitHub release page.

.PARAMETER Force
    Skip interactive safety prompts (uncommitted changes, non-main branch).

.EXAMPLE
    .\release.ps1 1.3.0 "Adds dark mode toggle and faster search."

.EXAMPLE
    .\release.ps1 1.3.0 "Bug fixes." -Force
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [Parameter(Position = 1)]
    [string]$Notes = "Release v$Version",

    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

$python = Join-Path $repoRoot '.venv\Scripts\python.exe'
$iscc   = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
$tag    = "v$Version"

function Update-File {
    param([string]$Path, [string]$Pattern, [string]$Replacement)
    $full    = (Resolve-Path $Path).Path
    $content = [IO.File]::ReadAllText($full)
    $updated = $content -replace $Pattern, $Replacement
    [IO.File]::WriteAllText($full, $updated, [System.Text.UTF8Encoding]::new($false))
}

# 0/6 Pre-flight
Write-Host "[0/6] Pre-flight checks..." -ForegroundColor Cyan

if (!(Test-Path $python)) { throw "Python venv not found: $python" }
if (!(Test-Path $iscc))   { throw "Inno Setup not found: $iscc" }

gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "gh CLI is not authenticated. Run: gh auth login" }

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main' -and -not $Force) {
    $reply = Read-Host "Current branch is '$branch', not 'main'. Continue? (y/N)"
    if ($reply -ne 'y') { exit 1 }
}

$dirty = git status --porcelain
if ($dirty -and -not $Force) {
    Write-Host "Uncommitted changes:" -ForegroundColor Yellow
    git status --short
    $reply = Read-Host "Continue anyway? (y/N)"
    if ($reply -ne 'y') { exit 1 }
}

if (git tag --list $tag) { throw "Tag $tag already exists" }

# 1/6 Bump version
Write-Host "[1/6] Bumping version to $Version..." -ForegroundColor Cyan
Update-File 'app\api.py'    'APP_VERSION\s*=\s*"[^"]+"'         "APP_VERSION = `"$Version`""
Update-File 'installer.iss' '(#define AppVersion\s+)"[^"]+"'    "`$1`"$Version`""
Update-File 'README.md'     'MyNotes-Setup-v\d+\.\d+\.\d+\.exe' "MyNotes-Setup-v$Version.exe"

# 2/6 Build exe
Write-Host "[2/6] Building exe via PyInstaller (~1-2 min)..." -ForegroundColor Cyan
if (Test-Path build) { Remove-Item build -Recurse -Force }
if (Test-Path dist)  { Remove-Item dist  -Recurse -Force }
& $python -m PyInstaller notes-app.spec --noconfirm
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }

# 3/6 Compile installer
Write-Host "[3/6] Compiling installer..." -ForegroundColor Cyan
& $iscc installer.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compile failed" }

$installer = "installer_output\MyNotes-Setup-v$Version.exe"
if (!(Test-Path $installer)) { throw "Installer not produced: $installer" }

# 4/6 Commit
Write-Host "[4/6] Committing version bump..." -ForegroundColor Cyan
git add app\api.py installer.iss README.md
git commit -m "chore: release v$Version"
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

# 5/6 Push
Write-Host "[5/6] Pushing to origin/main..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

# 6/6 Publish release
Write-Host "[6/6] Publishing GitHub release..." -ForegroundColor Cyan
gh release create $tag $installer --title $tag --notes $Notes
if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }

Write-Host ""
Write-Host "Released $tag" -ForegroundColor Green
Write-Host "https://github.com/Shakarneh/My-Notes/releases/tag/$tag"
