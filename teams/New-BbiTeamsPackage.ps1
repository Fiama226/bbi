<#
.SYNOPSIS
    BBI Intranet — génération des packages d'application Microsoft Teams (SPFx + Teams/Viva Connections).

.DESCRIPTION
    Depuis SPFx 1.20+, Teams est un « hôte de développement continu » : les web parts Teams ne sont
    plus embarquées dans le .sppkg, elles sont déployées via le catalogue d'applications Teams.
    Ce script génère les packages .zip à téléverser dans Teams :

      · BBI Accueil       → onglet personnel « Accueil » (expérience zéro chrome SharePoint)
      · BBI Galerie       → onglet personnel « Galerie médias »
      · BBI Fiche formation → onglet personnel « Fiche formation » (piloté par ?code=)

    Les manifestes référencent l'URL de la page SharePoint ; ils fonctionnent donc en
    « Viva Connections » comme en onglet personnel Teams, sans code supplémentaire.

.PREREQUIS
    · La solution bbi-intranet (1.3.0.0+) déployée dans le catalogue d'applications SharePoint.
    · Les icônes Teams présentes dans bbi-intranet/teams/ (fournies : <id>_color.png 192x192,
      <id>_outline.png 32x32).
    · Droits : administrateur Teams (pour l'import dans le catalogue d'applications Teams).

.EXEMPLES
    # Tenant et site lus dans bbi-environnement.json (aucun paramètre à saisir)
    .\New-BbiTeamsPackage.ps1
    .\New-BbiTeamsPackage.ps1 -DryRun
    .\New-BbiTeamsPackage.ps1 -App Home -Version 1.0.1

    # Autre site que celui par défaut
    .\New-BbiTeamsPackage.ps1 -Tenant businessbuilderinter.sharepoint.com -SitePath /sites/un-autre-site

.ENVIRONNEMENT
    tenantHost : businessbuilderinter.sharepoint.com
    sitePath   : /sites/intranet
    Les paramètres -Tenant et -SitePath restent prioritaires s'ils sont fournis.

.NOTES
    Version 1.4.0 — accompagne la solution bbi-intranet 1.4.0.0
#>

[CmdletBinding()]
param(
    # Domaine SharePoint Online. Par défaut : bbi-environnement.json
    [string]$Tenant,

    # Chemin du site intranet (ex. /sites/intranet). Par défaut : bbi-environnement.json
    [string]$SitePath,

    [ValidateSet('Home', 'Gallery', 'Fiche', 'All')]
    [string[]]$App = @('All'),

    [string]$Version = '1.0.0',
    [string]$OutputPath,
    [string]$IconsPath,
    [string]$PrivacyUrl = 'https://businessbuildersinternational.com/confidentialite',
    [string]$WebsiteUrl = 'https://businessbuildersinternational.com',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# ------------------------------------------------------------------
# Environnement (tenant + site) — source unique : bbi-environnement.json
# ------------------------------------------------------------------
$EnvironmentFile = Join-Path (Split-Path -Parent $scriptRoot) 'bbi-environnement.json'
$BbiEnv = $null
if (Test-Path $EnvironmentFile) {
    $BbiEnv = Get-Content $EnvironmentFile -Raw -Encoding UTF8 | ConvertFrom-Json
}

if (-not $Tenant) {
    if ($BbiEnv -and ($BbiEnv.tenantHost -or $BbiEnv.tenantUrl)) {
        $Tenant = if ($BbiEnv.tenantHost) { "$($BbiEnv.tenantHost)" } else { "$($BbiEnv.tenantUrl)" }
        Write-Host "  · Tenant lu dans bbi-environnement.json : $Tenant" -ForegroundColor DarkGray
    } else {
        throw "Aucun tenant : renseignez -Tenant ou le champ « tenantHost » de bbi-environnement.json."
    }
}
if (-not $SitePath) {
    if ($BbiEnv -and $BbiEnv.sitePath) {
        $SitePath = "$($BbiEnv.sitePath)"
        Write-Host "  · Site lu dans bbi-environnement.json : $SitePath" -ForegroundColor DarkGray
    } else {
        throw "Aucun site : renseignez -SitePath ou le champ « sitePath » de bbi-environnement.json."
    }
}
if (-not $OutputPath) { $OutputPath = Join-Path (Split-Path -Parent $scriptRoot) 'deliverables/teams' }
if (-not $IconsPath)  { $IconsPath  = Join-Path (Split-Path -Parent $scriptRoot) 'bbi-intranet/teams' }

$tenantHost = $Tenant -replace '^https?://', '' -replace '/+$', ''
$siteBase   = "https://$tenantHost$($SitePath.TrimEnd('/'))"

# ------------------------------------------------------------------
# Catalogue des applications (identifiants identiques aux web parts SPFx)
# ------------------------------------------------------------------
$APPS = @{
    Home = @{
        Id          = '6a9b6e3b-44f1-4a70-8f0a-45c82b29126d'
        Short       = 'BBI Accueil'
        Full        = 'BBI Intranet — Accueil'
        Description = "Page d'accueil BBI en plein écran : actualités, prochaines sessions, catalogue des formations, galerie médias et supports publiés."
        Page        = 'SitePages/accueil.aspx'
        EntityId    = 'bbi-home'
        TabName     = 'Accueil'
    }
    Gallery = @{
        Id          = 'f0f19a37-2c11-4812-9006-8aa71a9254f1'
        Short       = 'BBI Galerie'
        Full        = 'BBI Intranet — Galerie médias'
        Description = "Galerie photos et vidéos BBI : albums des sessions de formation, certifications et vie d'entreprise, avec visionneuse plein écran."
        Page        = 'SitePages/galerie.aspx'
        EntityId    = 'bbi-gallery'
        TabName     = 'Galerie médias'
    }
    Fiche = @{
        Id          = 'a9c99e25-db18-4419-894b-08bc9c5b9081'
        Short       = 'BBI Fiche formation'
        Full        = 'BBI Intranet — Fiche formation'
        Description = "Fiche détaillée d'une formation : objectifs, programme, prochaines sessions, supports et formateurs référents."
        Page        = 'SitePages/formation.aspx'
        EntityId    = 'bbi-fiche-formation'
        TabName     = 'Fiche formation'
    }
}

function Write-Title { param([string]$Message) Write-Host "`n$Message" -ForegroundColor White -BackgroundColor DarkBlue }
function Write-Step  { param([string]$Message) Write-Host "  → $Message" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Message) Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-Warn2 { param([string]$Message) Write-Host "  ! $Message" -ForegroundColor Yellow }

if (-not (Test-Path $OutputPath)) { New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null }

$selected = if ($App -contains 'All') { @('Home', 'Gallery', 'Fiche') } else { $App }

Write-Title "BBI — Packages Teams / Viva Connections"
Write-Host "  Tenant      : $tenantHost"
Write-Host "  Site        : $siteBase"
Write-Host "  Applications: $($selected -join ', ')"
Write-Host "  Sortie      : $OutputPath"

foreach ($key in $selected) {
    $app = $APPS[$key]
    $pageUrl = "$siteBase/$($app.Page)"

    $colorIcon   = Join-Path $IconsPath "$($app.Id)_color.png"
    $outlineIcon = Join-Path $IconsPath "$($app.Id)_outline.png"

    if (-not (Test-Path $colorIcon))   { Write-Warn2 "Icône couleur absente : $colorIcon" }
    if (-not (Test-Path $outlineIcon)) { Write-Warn2 "Icône contour absente : $outlineIcon" }

    # --- Manifeste Teams (schéma 1.16 : compatible Teams + Viva Connections) ---
    $manifest = [ordered]@{
        '$schema'        = 'https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json'
        manifestVersion  = '1.16'
        version          = $Version
        id               = $app.Id
        packageName      = "com.businessbuildersinternational.bbi.$($key.ToLower())"
        developer        = [ordered]@{
            name          = 'Business Builders International'
            websiteUrl    = $WebsiteUrl
            privacyUrl    = $PrivacyUrl
            termsOfUseUrl = $PrivacyUrl
        }
        name             = [ordered]@{ short = $app.Short; full = $app.Full }
        description      = [ordered]@{ short = $app.Description; full = $app.Description }
        icons            = [ordered]@{
            outline = "$($app.Id)_outline.png"
            color   = "$($app.Id)_color.png"
        }
        accentColor      = '#0E265C'
        staticTabs       = @(
            [ordered]@{
                entityId   = $app.EntityId
                name       = $app.TabName
                contentUrl = $pageUrl
                websiteUrl = $pageUrl
                scopes     = @('personal')
            }
        )
        permissions      = @('identity')
        validDomains     = @($tenantHost)
    }

    $json = $manifest | ConvertTo-Json -Depth 8

    if ($DryRun) {
        Write-Step "[SIMULATION] $($app.Full) → $pageUrl"
        continue
    }

    # --- Assemblage du .zip (manifest.json + icônes à la racine) ---
    $staging = Join-Path ([System.IO.Path]::GetTempPath()) ("bbi-teams-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging | Out-Null
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Join-Path $staging 'manifest.json'), $json, $utf8NoBom)
    if (Test-Path $colorIcon)   { Copy-Item $colorIcon   (Join-Path $staging "$($app.Id)_color.png") }
    if (Test-Path $outlineIcon) { Copy-Item $outlineIcon (Join-Path $staging "$($app.Id)_outline.png") }

    $zipPath = Join-Path $OutputPath ("bbi-teams-$($key.ToLower()).zip")
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -Force
    Remove-Item $staging -Recurse -Force

    Write-Ok "$($app.Full) → $(Split-Path -Leaf $zipPath)  (page : $pageUrl)"
}

if (-not $DryRun) {
    Write-Host ""
    Write-Host "Étapes suivantes :" -ForegroundColor White
    Write-Host "  1. Teams admin center → Équipes → Applications → Gérer les applications → Téléverser une application personnalisée." -ForegroundColor Gray
    Write-Host "  2. Téléverser chaque .zip, puis autoriser pour l'organisation." -ForegroundColor Gray
    Write-Host "  3. Épingler l'application pour les formateurs (politique de configuration d'application) :" -ForegroundColor Gray
    Write-Host "     « BBI Intranet — Accueil » épinglée dans la barre latérale = expérience zéro chrome SharePoint." -ForegroundColor Gray
    Write-Host "  4. Viva Connections : si vous utilisez l'application Viva Connections, la même page sert d'expérience d'accueil." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Détail : voir teams/README.md" -ForegroundColor Gray
}
