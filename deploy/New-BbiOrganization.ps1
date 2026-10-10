#Requires -Version 7.0
<#
.SYNOPSIS
    Recrée l'organisation du portail BBI sur un tenant : site du siège (hub), sites de
    filiale, application SPFx, listes, page d'accueil (dashboard), groupes et permissions,
    thème, pied de page et données de démonstration.

.DESCRIPTION
    Une seule commande, pilotée par deploy/organisation.json. Les étapes :
      1. connexion et site du siège (créé s'il n'existe pas) ;
      2. application SPFx déployée dans le catalogue du tenant ;
      3. groupe des éditeurs de contenu (créé s'il n'existe pas) ;
      4. première passe de provisionnement du siège (listes, bibliothèques, page) ;
      5. liste « Implantations » alimentée depuis la configuration (siège et filiales) ;
      6. seconde passe : hub, un site d'équipe par filiale, portail sur chacun,
         navigation du hub, données de démonstration (provision-bbi-intranet.ps1) ;
      7. liste « Implantations » recopiée sur chaque filiale (bandeau Siège et filiales) ;
      8. propriétaires, membres et visiteurs de chaque site ;
      9. thème, en-tête, logo et pied de page de chaque site ;
     10. démonstration des droits : dix documents aux droits différents, puis vérification finale.

    Le script est IDEMPOTENT : relancez-le sans risque, il ne recrée pas l'existant.

.PARAMETER Config
    Fichier de configuration. Par défaut : deploy/organisation.json.
.PARAMETER ClientId
    Identifiant de l'application Entra ID pour la connexion interactive. Par défaut :
    variable BBI_CLIENT_ID, puis tenant.clientId du fichier de configuration.
.PARAMETER PlanOnly
    Affiche le plan (sites, URL, groupes) sans se connecter à SharePoint.
.PARAMETER DryRun
    Se connecte en lecture seule et simule : aucune création ni modification.
.PARAMETER VerifyOnly
    Audit : lance seulement Test-BbiOrganization.ps1.
.PARAMETER Filiale
    Limite le travail aux filiales dont la ville correspond (accents et casse ignorés).
.PARAMETER SkipAppDeploy
    Saute le déploiement de l'application SPFx.
.PARAMETER SkipDemoData
    Ne crée pas les données de démonstration.
.PARAMETER SkipPermissions
    Saute les propriétaires, membres et visiteurs.
.PARAMETER SkipBranding
    Saute le thème, l'en-tête, le logo et le pied de page.
.PARAMETER SkipRightsDemo
    Saute la démonstration des droits (dix documents aux droits différents).

.EXAMPLE
    # 1. Voir ce qui sera créé, sans rien toucher
    pwsh -File deploy/New-BbiOrganization.ps1 -PlanOnly

.EXAMPLE
    # 2. Simuler avec connexion en lecture seule
    pwsh -File deploy/New-BbiOrganization.ps1 -DryRun -ClientId <id>

.EXAMPLE
    # 3. Tout créer, ou une seule filiale pour un premier essai
    pwsh -File deploy/New-BbiOrganization.ps1 -ClientId <id>
    pwsh -File deploy/New-BbiOrganization.ps1 -ClientId <id> -Filiale Abidjan

.NOTES
    Prérequis : PowerShell 7, module PnP.PowerShell 2.x, rôle Administrateur SharePoint,
    application Entra ID enregistrée (voir deploy/README.md, étape 2).
#>
[CmdletBinding()]
param(
    [string]$Config = (Join-Path $PSScriptRoot 'organisation.json'),
    [string]$ClientId = '',
    [switch]$PlanOnly,
    [switch]$DryRun,
    [switch]$VerifyOnly,
    [switch]$SkipAppDeploy,
    [switch]$SkipDemoData,
    [switch]$SkipPermissions,
    [switch]$SkipBranding,
    [switch]$SkipRightsDemo,
    [string[]]$Filiale = @()
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BbiOrganization.ps1')

# ------------------------------------------------------------------
# Journal
# ------------------------------------------------------------------
$script:Report = New-Object System.Collections.Generic.List[object]
function Add-OrgReport { param([string]$Element, [string]$Statut, [string]$Detail = '') $script:Report.Add([pscustomobject]@{ Element = $Element; Statut = $Statut; Detail = $Detail }) }
function Write-OrgTitle { param([string]$Message) Write-Host "`n$Message" -ForegroundColor White -BackgroundColor DarkBlue }
function Write-OrgStep { param([string]$Message) Write-Host "  → $Message" -ForegroundColor Cyan }
function Write-OrgOk { param([string]$Message) Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-OrgSkip { param([string]$Message) Write-Host "  · $Message (déjà en place)" -ForegroundColor DarkGray }
function Write-OrgWarn { param([string]$Message) Write-Host "  ! $Message" -ForegroundColor Yellow }

# Exécute une action sauf en simulation
function Invoke-Org {
    param([string]$Description, [scriptblock]$Action)
    if ($DryRun) { Write-OrgStep "[SIMULATION] $Description"; return $null }
    Write-OrgStep $Description
    return (& $Action)
}

# Une étape qui échoue est notée dans le rapport ; -Critical arrête tout le script.
function Invoke-Phase {
    param([string]$Name, [scriptblock]$Action, [switch]$Critical)
    try { & $Action }
    catch {
        Write-OrgWarn "$Name : $($_.Exception.Message)"
        Add-OrgReport $Name 'ÉCHEC' $_.Exception.Message
        if ($Critical) { throw }
    }
}

# ------------------------------------------------------------------
# 0. Configuration et plan
# ------------------------------------------------------------------
Write-OrgTitle "0/10 · Configuration"
$configPath = (Resolve-Path -LiteralPath $Config -ErrorAction SilentlyContinue)?.Path
if (-not $configPath) { $configPath = $Config }
$cfg  = Read-BbiOrganizationConfig -Path $configPath
$plan = Get-BbiOrganizationPlan -Config $cfg -Filiale $Filiale -BaseDirectory (Split-Path -Parent $configPath)
if ($SkipDemoData) { $plan.DonneesDemo = $false }
if (-not $ClientId) { $ClientId = "$env:BBI_CLIENT_ID" }
if (-not $ClientId) { $ClientId = "$(Get-BbiOptional $cfg.tenant 'clientId' '')" }

Write-BbiOrganizationPlan -Plan $plan
$selected = @($plan.Filiales | Where-Object Selectionnee)
if ($Filiale.Count -gt 0 -and $selected.Count -eq 0) { throw "Aucune filiale ne correspond à -Filiale : $($Filiale -join ', ')." }

if ($plan.DeployerApp -and -not $SkipAppDeploy -and -not (Test-Path -LiteralPath $plan.CheminPaquet)) {
    Write-OrgWarn "Paquet introuvable : $($plan.CheminPaquet) (options.cheminPaquet). Corrigez le chemin ou utilisez -SkipAppDeploy."
}
if ($plan.Logo -and -not (Test-Path -LiteralPath $plan.Logo)) {
    Write-OrgWarn "Logo introuvable : $($plan.Logo) (identite.logo)."
}

if ($PlanOnly) {
    Write-Host "`nMode -PlanOnly : aucune connexion, rien n'a été créé." -ForegroundColor Green
    exit 0
}

if ($VerifyOnly) {
    $verifyArgs = @{ Config = $configPath }
    if ($ClientId) { $verifyArgs.ClientId = $ClientId }
    if ($Filiale.Count -gt 0) { $verifyArgs.Filiale = $Filiale }; if ($SkipRightsDemo) { $verifyArgs.SkipRightsDemo = $true }
    & (Join-Path $PSScriptRoot 'Test-BbiOrganization.ps1') @verifyArgs
    exit $LASTEXITCODE
}

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    throw "Module PnP.PowerShell absent. Installez-le : Install-Module PnP.PowerShell -Scope CurrentUser"
}
if (-not $ClientId) {
    Write-OrgWarn "Aucun -ClientId : PnP.PowerShell 2.x refuse en général la connexion interactive sans application Entra ID (voir deploy/README.md, étape 2)."
}
if ($DryRun) { Write-OrgWarn "Mode -DryRun : connexion en lecture seule, aucune modification." }

$provision = Join-Path $PSScriptRoot 'provision-bbi-intranet.ps1'
$envFile   = Join-Path ([IO.Path]::GetTempPath()) "bbi-environnement.$($plan.Tenant).json"
New-BbiEnvironmentFile -Plan $plan -Path $envFile | Out-Null
Write-OrgOk "Fichier d'environnement généré : $envFile"

function Invoke-Provisioning {
    param([hashtable]$Extra = @{})
    $p = @{ SiteUrl = $plan.Siege.Url; EnvironmentFile = $envFile }
    if ($ClientId) { $p.ClientId = $ClientId }
    if ($DryRun) { $p.DryRun = $true }
    foreach ($k in $Extra.Keys) { $p[$k] = $Extra[$k] }
    & $provision @p
}

# ------------------------------------------------------------------
# Aides : appartenance aux groupes, implantations
# ------------------------------------------------------------------
function Add-OrgLogin {
    param($Group, [string[]]$Mails, [string]$Label)
    if (-not $Mails -or $Mails.Count -eq 0) { return }
    $current = @(Get-PnPGroupMember -Group $Group | ForEach-Object { "$($_.Email)".ToLowerInvariant(); "$($_.LoginName)".ToLowerInvariant() })
    foreach ($mail in $Mails) {
        $login = "i:0#.f|membership|$mail"
        if ($current -contains $mail.ToLowerInvariant() -or $current -contains $login.ToLowerInvariant()) { Write-OrgSkip "$mail ($Label)"; continue }
        Invoke-Org "$mail ← $Label" { Add-PnPGroupMember -LoginName $login -Group $Group } | Out-Null
    }
}

function Add-OrgM365 {
    param([string]$GroupId, [string[]]$Mails, [ValidateSet('Owner', 'Member')][string]$Role)
    if (-not $Mails -or $Mails.Count -eq 0) { return }
    Invoke-Org "$($Mails -join ', ') ← $Role du groupe Microsoft 365" {
        try {
            if ($Role -eq 'Owner') { Add-PnPMicrosoft365GroupOwner -Identity $GroupId -Users $Mails }
            else { Add-PnPMicrosoft365GroupMember -Identity $GroupId -Users $Mails }
        } catch {
            if ($_.Exception.Message -match 'already exist|déjà') { Write-OrgSkip "$($Mails -join ', ') ($Role)" } else { throw }
        }
    } | Out-Null
}

function Get-OrgImplantationEntries {
    $entries = @()
    $s = $plan.Siege
    $entries += [pscustomobject]@{ Key = 'siege'; Title = $s.Titre; EstSiege = $true; Ville = $s.Ville; Pays = $s.Pays; Ordre = 0; Couleur = $s.Couleur; Initiales = $s.Initiales; Responsable = $s.Responsable; Email = $s.Email; Telephone = $s.Telephone; Adresse = $s.Adresse; Url = $s.Url }
    foreach ($f in $plan.Filiales) {
        $entries += [pscustomobject]@{ Key = $f.Ville; Title = $f.Titre; EstSiege = $false; Ville = $f.Ville; Pays = $f.Pays; Ordre = $f.Ordre; Couleur = $f.Couleur; Initiales = $f.Initiales; Responsable = $f.Responsable; Email = $f.Email; Telephone = $f.Telephone; Adresse = $f.Adresse; Url = $f.Url }
    }
    return $entries
}

# Crée ou met à jour les lignes de « Implantations » du site connecté (clé : ville, siège : case Siège).
function Sync-OrgImplantations {
    param([string]$SiteLabel)
    if (-not (Get-PnPList -Identity 'Implantations' -ErrorAction SilentlyContinue)) {
        Write-OrgWarn "[$SiteLabel] liste « Implantations » absente : étape ignorée."
        Add-OrgReport "Implantations $SiteLabel" 'MANQUANT' 'liste absente'
        return
    }
    $rows = @(Get-PnPListItem -List 'Implantations' -PageSize 200)
    foreach ($e in (Get-OrgImplantationEntries)) {
        $row = if ($e.EstSiege) {
            $rows | Where-Object { [bool]$_['EstSiege'] } | Select-Object -First 1
        } else {
            $rows | Where-Object { -not [bool]$_['EstSiege'] -and "$($_['Ville'])".Trim() -ieq $e.Ville.Trim() } | Select-Object -First 1
        }
        $initiales = $e.Initiales
        if (-not $initiales -and $e.Ville) { $initiales = $e.Ville.Substring(0, [Math]::Min(2, $e.Ville.Length)).ToUpperInvariant() }
        $values = @{ Title = $e.Title; EstSiege = $e.EstSiege; Ordre = $e.Ordre; SiteUrl = "$($e.Url), $($e.Title)" }
        if ($e.Ville) { $values.Ville = $e.Ville }
        if ($e.Pays) { $values.Pays = $e.Pays }
        if ($e.Couleur) { $values.Couleur = $e.Couleur }
        if ($initiales) { $values.Initiales = $initiales }
        if ($e.Responsable) { $values.Responsable = $e.Responsable }
        if ($e.Email) { $values.Email = $e.Email }
        if ($e.Telephone) { $values.Telephone = $e.Telephone }
        if ($e.Adresse) { $values.Adresse = $e.Adresse }
        if ($row) {
            Invoke-Org "[$SiteLabel] Implantations : mise à jour de « $($e.Title) »" { Set-PnPListItem -List 'Implantations' -Identity $row.Id -Values $values | Out-Null } | Out-Null
        } else {
            Invoke-Org "[$SiteLabel] Implantations : ajout de « $($e.Title) »" { Add-PnPListItem -List 'Implantations' -Values $values | Out-Null } | Out-Null
        }
    }
    Add-OrgReport "Implantations $SiteLabel" ($(if ($DryRun) { 'SIMULÉ' } else { 'OK' })) "$((Get-OrgImplantationEntries).Count) ligne(s)"
}

# ------------------------------------------------------------------
# 1. Connexion et site du siège
# ------------------------------------------------------------------
Write-OrgTitle "1/10 · Connexion et site du siège"
Connect-Bbi -Url $plan.AdminUrl -ClientId $ClientId
Write-OrgOk "Connecté à $($plan.AdminUrl)"

$script:siegeExists = $false
Invoke-Phase 'Site du siège' -Critical {
    $existing = try { Get-PnPTenantSite -Url $plan.Siege.Url -ErrorAction Stop } catch { $null }
    if ($existing) {
        $script:siegeExists = $true
        Write-OrgSkip "Site du siège $($plan.Siege.Url)"
        Add-OrgReport 'Site du siège' 'OK' $plan.Siege.Url
    } elseif ($DryRun) {
        Write-OrgStep "[SIMULATION] création du site d'équipe « $($plan.Siege.Titre) » ($($plan.Siege.Url))"
        Add-OrgReport 'Site du siège' 'MANQUANT' $plan.Siege.Url
    } else {
        Write-OrgStep "Création du site d'équipe « $($plan.Siege.Titre) » ($($plan.Siege.Url))"
        New-PnPSite -Type TeamSite -Title $plan.Siege.Titre -Alias $plan.Siege.Alias -IsPublic:$false -Lcid $plan.Lcid -Wait | Out-Null
        $script:siegeExists = $true
        Add-OrgReport 'Site du siège' 'CRÉÉ' $plan.Siege.Url
    }
}

# ------------------------------------------------------------------
# 2. Application SPFx
# ------------------------------------------------------------------
Write-OrgTitle "2/10 · Application SPFx"
if (-not $plan.DeployerApp -or $SkipAppDeploy) {
    Write-OrgSkip "Déploiement de l'application ignoré (option ou -SkipAppDeploy)"
    Add-OrgReport 'Application SPFx' 'IGNORÉ'
} else {
    Invoke-Phase 'Application SPFx' -Critical {
        $catalog = try { Get-PnPTenantAppCatalogUrl } catch { $null }
        if (-not $catalog) {
            Add-OrgReport 'Catalogue d''applications' 'MANQUANT' 'à créer dans le centre d''administration SharePoint'
            throw "Aucun catalogue d'applications sur ce tenant. Créez-le : centre d'administration SharePoint > Plus de fonctionnalités > Applications > Catalogue d'applications."
        }
        if (-not (Test-Path -LiteralPath $plan.CheminPaquet)) { throw "Paquet introuvable : $($plan.CheminPaquet)" }
        Write-OrgStep "Catalogue d'applications : $catalog"
        Invoke-Org "Téléversement et déploiement de $([IO.Path]::GetFileName($plan.CheminPaquet))" {
            Add-PnPApp -Path $plan.CheminPaquet -Scope Tenant -Overwrite -Publish | Out-Null
        } | Out-Null
        if (-not $DryRun) {
            $app = Get-PnPApp -Scope Tenant | Where-Object { $_.Title -eq 'bbi-portail-client-side-solution' } | Select-Object -First 1
            if ($app -and $app.Deployed) { Write-OrgOk "Application déployée (version $($app.AppCatalogVersion))"; Add-OrgReport 'Application SPFx' 'OK' "version $($app.AppCatalogVersion)" }
            else { Write-OrgWarn "Application téléversée mais pas encore marquée Déployée : vérifiez le catalogue d'applications."; Add-OrgReport 'Application SPFx' 'À VÉRIFIER' 'non déployée' }
        } else { Add-OrgReport 'Application SPFx' 'SIMULÉ' }
    }
}

if (-not $script:siegeExists -and $DryRun) {
    Write-OrgWarn "Le siège n'existe pas encore : la simulation s'arrête ici (les étapes suivantes demandent le site)."
    Add-OrgReport 'Étapes 3 à 9' 'IGNORÉ' 'siège absent en simulation'
} else {

# ------------------------------------------------------------------
# 3. Groupe des éditeurs
# ------------------------------------------------------------------
Write-OrgTitle "3/10 · Groupe des éditeurs de contenu"
Invoke-Phase 'Groupe des éditeurs' {
    Connect-Bbi -Url $plan.Siege.Url -ClientId $ClientId
    $group = try { Get-PnPGroup -Identity $plan.GroupeEditeurs -ErrorAction Stop } catch { $null }
    if ($group) { Write-OrgSkip "Groupe « $($plan.GroupeEditeurs) »"; Add-OrgReport 'Groupe éditeurs' 'OK' $plan.GroupeEditeurs }
    else {
        Invoke-Org "Création du groupe « $($plan.GroupeEditeurs) »" { New-PnPGroup -Title $plan.GroupeEditeurs -Description "Éditeurs de contenu du portail $($plan.Organisation)" | Out-Null } | Out-Null
        Add-OrgReport 'Groupe éditeurs' ($(if ($DryRun) { 'MANQUANT' } else { 'CRÉÉ' })) $plan.GroupeEditeurs
    }
    if (-not $DryRun -or $group) { Add-OrgLogin -Group $plan.GroupeEditeurs -Mails $plan.EditeursMembres -Label "groupe $($plan.GroupeEditeurs)" }
}

# ------------------------------------------------------------------
# 4. Première passe : listes, bibliothèques, page d'accueil du siège
# ------------------------------------------------------------------
Write-OrgTitle "4/10 · Siège : listes, bibliothèques et page d'accueil"
Invoke-Phase 'Provisionnement du siège (passe 1)' -Critical { Invoke-Provisioning -Extra @{ SkipNavigation = $true } }

# ------------------------------------------------------------------
# 5. Implantations depuis la configuration
# ------------------------------------------------------------------
Write-OrgTitle "5/10 · Liste Implantations (siège et filiales)"
Invoke-Phase 'Implantations du siège' {
    Connect-Bbi -Url $plan.Siege.Url -ClientId $ClientId
    Sync-OrgImplantations -SiteLabel 'siège'
}

# ------------------------------------------------------------------
# 6. Seconde passe : hub, filiales, portail sur chaque filiale, démo
# ------------------------------------------------------------------
Write-OrgTitle "6/10 · Hub, sites de filiale et portail sur chacun"
if (-not $plan.Hub) {
    Write-OrgSkip "Hub désactivé (options.hub = false) : filiales non créées"
    Add-OrgReport 'Filiales' 'IGNORÉ' 'options.hub = false'
} else {
    Invoke-Phase 'Hub et filiales (passe 2)' -Critical {
        $extra = @{ ProvisionFiliales = $true }
        if ($plan.DonneesDemo) { $extra.SeedDemoData = $true }
        if ($Filiale.Count -gt 0) { $extra.Filiale = $Filiale }
        Invoke-Provisioning -Extra $extra
    }
}

# ------------------------------------------------------------------
# 7. Implantations recopiées sur chaque filiale
# ------------------------------------------------------------------
Write-OrgTitle "7/10 · Bandeau Siège et filiales sur chaque filiale"
if (-not $plan.Hub -or $DryRun) {
    Write-OrgSkip "Recopie des implantations ignorée (hub désactivé ou simulation)"
} else {
    foreach ($f in $selected) {
        Invoke-Phase "Implantations $($f.Titre)" {
            Connect-Bbi -Url $f.Url -ClientId $ClientId
            Sync-OrgImplantations -SiteLabel $f.Titre
        }
    }
}

# ------------------------------------------------------------------
# 8. Propriétaires, membres, visiteurs
# ------------------------------------------------------------------
Write-OrgTitle "8/10 · Groupes et permissions"
function Set-OrgSitePermissions {
    param([string]$Url, [string]$Titre, [string[]]$Owners, [string[]]$Members, [string[]]$Visitors)
    Connect-Bbi -Url $Url -ClientId $ClientId
    $groupId = $null
    try { $groupId = (Get-PnPSite -Includes GroupId).GroupId } catch { }
    $hasM365 = $groupId -and "$groupId" -ne [Guid]::Empty.ToString()
    if ($Owners.Count -gt 0) {
        if ($hasM365) { Add-OrgM365 -GroupId "$groupId" -Mails $Owners -Role Owner }
        else { Add-OrgLogin -Group (Get-PnPGroup -AssociatedOwnerGroup) -Mails $Owners -Label "propriétaires de $Titre" }
    }
    if ($Members.Count -gt 0) {
        if ($hasM365) { Add-OrgM365 -GroupId "$groupId" -Mails $Members -Role Member }
        else { Add-OrgLogin -Group (Get-PnPGroup -AssociatedMemberGroup) -Mails $Members -Label "membres de $Titre" }
    }
    $visitorGroup = Get-PnPGroup -AssociatedVisitorGroup
    if ($Visitors.Count -gt 0) { Add-OrgLogin -Group $visitorGroup -Mails $Visitors -Label "visiteurs de $Titre" }
    if ($plan.LectureTous) {
        $tenantId = Get-PnPTenantId
        $everyone = "c:0-.f|rolemanager|spo-grid-all-users/$tenantId"
        $already = @(Get-PnPGroupMember -Group $visitorGroup | ForEach-Object { "$($_.LoginName)".ToLowerInvariant() })
        if ($already -contains $everyone.ToLowerInvariant()) { Write-OrgSkip "« Tout le monde sauf externes » (visiteurs de $Titre)" }
        else { Invoke-Org "« Tout le monde sauf les utilisateurs externes » ← visiteurs de $Titre" { Add-PnPGroupMember -LoginName $everyone -Group $visitorGroup } | Out-Null }
    }
    Add-OrgReport "Permissions $Titre" ($(if ($DryRun) { 'SIMULÉ' } else { 'OK' }))
}
if ($SkipPermissions) {
    Write-OrgSkip "Permissions ignorées (-SkipPermissions)"
} else {
    Invoke-Phase "Permissions $($plan.Siege.Titre)" { Set-OrgSitePermissions -Url $plan.Siege.Url -Titre $plan.Siege.Titre -Owners $plan.Siege.Proprietaires -Members $plan.Siege.Membres -Visitors $plan.Siege.Visiteurs }
    foreach ($f in $selected) {
        Invoke-Phase "Permissions $($f.Titre)" {
            if ($DryRun) { Write-OrgStep "[SIMULATION] permissions de $($f.Titre)"; Add-OrgReport "Permissions $($f.Titre)" 'SIMULÉ'; return }
            Set-OrgSitePermissions -Url $f.Url -Titre $f.Titre -Owners $f.Proprietaires -Members $f.Membres -Visitors $f.Visiteurs
        }
    }
}

# ------------------------------------------------------------------
# 9. Identité visuelle et vérification
# ------------------------------------------------------------------
Write-OrgTitle "9/10 · Thème, en-tête, logo, pied de page"
function Set-OrgSiteBranding {
    param([string]$Url, [string]$Titre)
    Connect-Bbi -Url $Url -ClientId $ClientId
    Invoke-Org "[$Titre] thème « $($plan.NomTheme) »" { Set-PnPWebTheme -Theme $plan.NomTheme -WebUrl $Url } | Out-Null
    $header = @{ HeaderLayout = 'Compact'; HeaderEmphasis = 'Strong' }
    if ($plan.Logo -and (Test-Path -LiteralPath $plan.Logo)) {
        $uploaded = Invoke-Org "[$Titre] logo $([IO.Path]::GetFileName($plan.Logo))" { Add-PnPFile -Path $plan.Logo -Folder 'SiteAssets' }
        if ($uploaded) { $header.SiteLogoUrl = $uploaded.ServerRelativeUrl }
    }
    Invoke-Org "[$Titre] en-tête compact" { Set-PnPWebHeader @header } | Out-Null
    Invoke-Org "[$Titre] pied de page « $($plan.TitrePiedDePage) »" { Set-PnPFooter -Enabled:$true -Layout Simple -Title $plan.TitrePiedDePage } | Out-Null
    if ($plan.PiedDePage.Count -gt 0) {
        $existing = @(Get-PnPNavigationNode -Location Footer | ForEach-Object Title)
        foreach ($link in $plan.PiedDePage) {
            $title = "$($link.titre)"; $url = "$($link.url)"
            if (-not $title -or -not $url) { continue }
            if ($existing -contains $title) { Write-OrgSkip "Lien de pied de page « $title »"; continue }
            Invoke-Org "[$Titre] lien de pied de page « $title »" { Add-PnPNavigationNode -Location Footer -Title $title -Url $url | Out-Null } | Out-Null
        }
    }
    Add-OrgReport "Identité $Titre" ($(if ($DryRun) { 'SIMULÉ' } else { 'OK' }))
}
if ($SkipBranding) {
    Write-OrgSkip "Identité visuelle ignorée (-SkipBranding)"
} else {
    Invoke-Phase "Identité $($plan.Siege.Titre)" { Set-OrgSiteBranding -Url $plan.Siege.Url -Titre $plan.Siege.Titre }
    foreach ($f in $selected) {
        Invoke-Phase "Identité $($f.Titre)" {
            if ($DryRun) { Write-OrgStep "[SIMULATION] identité visuelle de $($f.Titre)"; Add-OrgReport "Identité $($f.Titre)" 'SIMULÉ'; return }
            Set-OrgSiteBranding -Url $f.Url -Titre $f.Titre
        }
    }
}

# ------------------------------------------------------------------
# 10. Démonstration des droits
# ------------------------------------------------------------------
Write-OrgTitle "10/10 · Démonstration des droits"
if (-not $plan.DemonstrationDroits -or $SkipRightsDemo) {
    Write-OrgSkip "Démonstration des droits ignorée (options.demonstrationDroits ou -SkipRightsDemo)"
    Add-OrgReport 'Démonstration des droits' 'IGNORÉ'
} else {
    Invoke-Phase 'Démonstration des droits' {
        $rightsArgs = @{ Config = $configPath }
        if ($ClientId) { $rightsArgs.ClientId = $ClientId }
        if ($DryRun) { $rightsArgs.DryRun = $true }
        & (Join-Path $PSScriptRoot 'New-BbiRightsDemo.ps1') @rightsArgs
        if ($LASTEXITCODE -ne 0) { throw "New-BbiRightsDemo.ps1 a signalé des erreurs (voir ci-dessus)." }
        Add-OrgReport 'Démonstration des droits' ($(if ($DryRun) { 'SIMULÉ' } else { 'OK' })) 'dix documents aux droits différents'
    }
}

}  # fin du bloc « siège disponible »

# ------------------------------------------------------------------
# Rapport
# ------------------------------------------------------------------
Write-OrgTitle "Rapport"
$script:Report | Format-Table -AutoSize -Wrap | Out-String | Write-Host
$failures = @($script:Report | Where-Object { $_.Statut -in 'ÉCHEC', 'MANQUANT' -and -not ($DryRun -and $_.Statut -eq 'MANQUANT') })

if (-not $DryRun -and $script:siegeExists) {
    Write-Host "Vérification finale (Test-BbiOrganization.ps1)..." -ForegroundColor White
    $verifyArgs = @{ Config = $configPath }
    if ($ClientId) { $verifyArgs.ClientId = $ClientId }
    if ($Filiale.Count -gt 0) { $verifyArgs.Filiale = $Filiale }; if ($SkipRightsDemo) { $verifyArgs.SkipRightsDemo = $true }
    try {
        & (Join-Path $PSScriptRoot 'Test-BbiOrganization.ps1') @verifyArgs
        if ($LASTEXITCODE -ne 0) { Write-OrgWarn "La vérification finale signale des écarts (voir ci-dessus)." }
    } catch { Write-OrgWarn "Vérification finale impossible : $($_.Exception.Message)" }
}

Write-Host ""
if ($failures.Count -gt 0) {
    Write-Host "$($failures.Count) étape(s) en échec ou manquante(s) : corrigez la cause puis relancez, le script est idempotent." -ForegroundColor Yellow
    exit 1
}
Write-Host "Terminé." -ForegroundColor Green
Write-Host "Étapes suivantes : ouvrez $($plan.Siege.Url)/SitePages/accueil.aspx, personnalisez le héros (volet Propriétés de la web part), testez sur mobile et dans Teams." -ForegroundColor Gray
exit 0
