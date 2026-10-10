#Requires -Version 7.0
<#
.SYNOPSIS
    Audit en lecture seule de l'organisation : sites, hub, listes, page d'accueil,
    web part, groupes, application. Aucune modification.

.DESCRIPTION
    Compare l'état du tenant à deploy/organisation.json et affiche un bilan par site.
    Code de sortie 0 si tout est conforme, 1 sinon.

.EXAMPLE
    pwsh -File deploy/Test-BbiOrganization.ps1 -ClientId <id>
    pwsh -File deploy/Test-BbiOrganization.ps1 -ClientId <id> -Filiale Abidjan
#>
[CmdletBinding()]
param(
    [string]$Config = (Join-Path $PSScriptRoot 'organisation.json'),
    [string]$ClientId = '',
    [string[]]$Filiale = @(),
    [switch]$SkipRightsDemo
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BbiOrganization.ps1')

$WP_HOME = '6a9b6e3b-44f1-4a70-8f0a-45c82b29126d'   # Business Builders International Accueil (plein écran)

# Listes et bibliothèques que le portail attend sur chaque site
$RequiredLists = @(
    'Actualites', 'Sessions', 'Formateurs', 'Formations', 'Offres', 'Avis clients', 'Employés du mois', 'Certifications',
    'Annonces', 'Pensées du jour', 'Anniversaires', 'Implantations', 'Nos références',
    'Références pédagogiques', 'Supports publiés', 'Documents administratifs', 'Galerie médias'
)

$configPath = (Resolve-Path -LiteralPath $Config -ErrorAction SilentlyContinue)?.Path
if (-not $configPath) { $configPath = $Config }
$cfg  = Read-BbiOrganizationConfig -Path $configPath
$plan = Get-BbiOrganizationPlan -Config $cfg -Filiale $Filiale -BaseDirectory (Split-Path -Parent $configPath)
if (-not $ClientId) { $ClientId = "$env:BBI_CLIENT_ID" }
if (-not $ClientId) { $ClientId = "$(Get-BbiOptional $cfg.tenant 'clientId' '')" }

$results = New-Object System.Collections.Generic.List[object]
function Add-Result { param([string]$Site, [string]$Controle, [string]$Statut, [string]$Detail = '') $results.Add([pscustomobject]@{ Site = $Site; Controle = $Controle; Statut = $Statut; Detail = $Detail }) }

Write-Host "Audit de l'organisation : $($plan.Organisation) ($($plan.TenantUrl))" -ForegroundColor White

# --- Tenant : sites, hub, application -----------------------------------
Connect-Bbi -Url $plan.AdminUrl -ClientId $ClientId

$hubSite = try { Get-PnPHubSite -Identity $plan.Siege.Url -ErrorAction Stop } catch { $null }
$hubIds = @()
if ($hubSite) { $hubIds = @("$($hubSite.ID)", "$($hubSite.SiteId)") | Where-Object { $_ -and $_ -ne [Guid]::Empty.ToString() } }

try {
    $app = Get-PnPApp -Scope Tenant | Where-Object { $_.Title -eq 'bbi-portail-client-side-solution' } | Select-Object -First 1
    if (-not $app) { Add-Result 'Tenant' 'Application SPFx' 'MANQUANT' 'absente du catalogue' }
    elseif (-not $app.Deployed) { Add-Result 'Tenant' 'Application SPFx' 'À VÉRIFIER' "version $($app.AppCatalogVersion) non déployée" }
    else { Add-Result 'Tenant' 'Application SPFx' 'OK' "version $($app.AppCatalogVersion)" }
} catch { Add-Result 'Tenant' 'Application SPFx' 'ÉCHEC' $_.Exception.Message }

$sites = @([pscustomobject]@{ Titre = $plan.Siege.Titre; Url = $plan.Siege.Url; Role = 'siege'; Proprietaires = $plan.Siege.Proprietaires; Membres = $plan.Siege.Membres; Visiteurs = $plan.Siege.Visiteurs })
foreach ($f in @($plan.Filiales | Where-Object Selectionnee)) {
    $sites += [pscustomobject]@{ Titre = $f.Titre; Url = $f.Url; Role = 'filiale'; Proprietaires = $f.Proprietaires; Membres = $f.Membres; Visiteurs = $f.Visiteurs }
}

foreach ($site in $sites) {
    $t = $site.Titre
    $tenantSite = try { Get-PnPTenantSite -Url $site.Url -ErrorAction Stop } catch { $null }
    if (-not $tenantSite) {
        Add-Result $t 'Site' 'MANQUANT' $site.Url
        continue
    }
    Add-Result $t 'Site' 'OK' $site.Url

    if ($plan.Hub) {
        if ($site.Role -eq 'siege') {
            Add-Result $t 'Hub' ($(if ($hubSite) { 'OK' } else { 'MANQUANT' })) ($(if ($hubSite) { 'site hub' } else { 'le siège n''est pas enregistré comme hub' }))
        } else {
            $linked = $hubIds.Count -gt 0 -and $hubIds -contains "$($tenantSite.HubSiteId)"
            Add-Result $t 'Rattachement au hub' ($(if ($linked) { 'OK' } else { 'MANQUANT' }))
        }
    }

    try {
        Connect-Bbi -Url $site.Url -ClientId $ClientId

        $missing = @()
        foreach ($name in $RequiredLists) {
            if (-not (Get-PnPList -Identity $name -ErrorAction SilentlyContinue)) { $missing += $name }
        }
        if ($missing.Count -eq 0) { Add-Result $t 'Listes et bibliothèques' 'OK' "$($RequiredLists.Count) présentes" }
        else { Add-Result $t 'Listes et bibliothèques' 'MANQUANT' ($missing -join ', ') }

        $page = try { Get-PnPPage -Identity 'accueil.aspx' -ErrorAction Stop } catch { $null }
        if (-not $page) { Add-Result $t 'Page accueil.aspx' 'MANQUANT' }
        else {
            Add-Result $t 'Page accueil.aspx' 'OK'
            $parts = @(Get-PnPPageComponent -Page 'accueil.aspx' -ErrorAction SilentlyContinue | Where-Object { "$($_.WebPartId)".Trim('{', '}') -eq $WP_HOME })
            Add-Result $t 'Web part Business Builders International Accueil' ($(if ($parts.Count -gt 0) { 'OK' } else { 'MANQUANT' }))
        }

        if (Get-PnPList -Identity 'Implantations' -ErrorAction SilentlyContinue) {
            $rows = @(Get-PnPListItem -List 'Implantations' -PageSize 200)
            $expected = 1 + $plan.Filiales.Count
            $withUrl = @($rows | Where-Object { "$($_['SiteUrl']?.Url)" }).Count
            if ($rows.Count -ge $expected -and $withUrl -ge $expected) { Add-Result $t 'Implantations' 'OK' "$($rows.Count) ligne(s), $withUrl avec site" }
            else { Add-Result $t 'Implantations' 'À VÉRIFIER' "$($rows.Count) ligne(s) dont $withUrl avec site, $expected attendue(s)" }
        }

        # Groupes : chaque adresse de la configuration doit apparaître quelque part sur le site.
        # Sur un site relié à un groupe Microsoft 365, propriétaires et membres sont dans ce groupe
        # (les groupes SharePoint ne contiennent que le groupe lui-même) ; les visiteurs restent dans SharePoint.
        $wanted = @(@($site.Proprietaires) + @($site.Membres) + @($site.Visiteurs) | Where-Object { $_ })
        if ($wanted.Count -gt 0) {
            $groupId = $null
            try { $groupId = (Get-PnPSite -Includes GroupId).GroupId } catch { }
            $hasM365 = $groupId -and "$groupId" -ne [Guid]::Empty.ToString()
            $known = @()
            if ($hasM365) {
                $known += @(Get-PnPMicrosoft365GroupOwner -Identity "$groupId" | ForEach-Object { "$($_.Email)".ToLowerInvariant(); "$($_.UserPrincipalName)".ToLowerInvariant() })
                $known += @(Get-PnPMicrosoft365GroupMember -Identity "$groupId" | ForEach-Object { "$($_.Email)".ToLowerInvariant(); "$($_.UserPrincipalName)".ToLowerInvariant() })
                $spGroups = @(Get-PnPGroup -AssociatedVisitorGroup)
            } else {
                $spGroups = @((Get-PnPGroup -AssociatedOwnerGroup), (Get-PnPGroup -AssociatedMemberGroup), (Get-PnPGroup -AssociatedVisitorGroup))
            }
            foreach ($g in $spGroups) {
                $known += @(Get-PnPGroupMember -Group $g | ForEach-Object { "$($_.Email)".ToLowerInvariant(); "$($_.LoginName)".ToLowerInvariant() })
            }
            $absent = @($wanted | Where-Object { $mail = $_.ToLowerInvariant(); -not ($known | Where-Object { $_ -eq $mail -or $_ -like "*|$mail" }) })
            if ($absent.Count -eq 0) { Add-Result $t 'Permissions' 'OK' "$($wanted.Count) personne(s)" }
            else { Add-Result $t 'Permissions' 'À VÉRIFIER' "absentes : $($absent -join ', ')" }
        }
    } catch {
        Add-Result $t 'Contrôles du site' 'ÉCHEC' $_.Exception.Message
    }
}

# --- Démonstration des droits -------------------------------------------
if ($plan.DemonstrationDroits -and -not $SkipRightsDemo) {
    . (Join-Path $PSScriptRoot 'BbiRightsDemo.ps1')
    $demoSite = $plan.Siege.Titre
    try {
        Connect-Bbi -Url $plan.Siege.Url -ClientId $ClientId
        $rights = Get-BbiRightsDemoPlan -Config $cfg -Plan $plan
        $missingGroups = @()
        foreach ($g in $rights.Groups) {
            $found = try { Get-PnPGroup -Identity $g.Name -ErrorAction Stop } catch { $null }
            if (-not $found) { $missingGroups += $g.Name }
        }
        if ($missingGroups.Count -eq 0) { Add-Result $demoSite 'Groupes de démonstration' 'OK' "$($rights.Groups.Count) groupes" }
        else { Add-Result $demoSite 'Groupes de démonstration' 'MANQUANT' ($missingGroups -join ', ') }
        $missingDocs = @()
        foreach ($doc in $rights.Documents) {
            $library = Get-PnPList -Identity $doc.Library -Includes RootFolder -ErrorAction SilentlyContinue
            $file = if ($library) { try { Get-PnPFile -Url "$($library.RootFolder.ServerRelativeUrl)/$($doc.FileName)" -AsListItem -ErrorAction Stop } catch { $null } } else { $null }
            if (-not $file) { $missingDocs += "cas $($doc.Num)" }
        }
        if ($missingDocs.Count -eq 0) { Add-Result $demoSite 'Documents de démonstration des droits' 'OK' "$($rights.Documents.Count) documents" }
        else { Add-Result $demoSite 'Documents de démonstration des droits' 'MANQUANT' ($missingDocs -join ', ') }
    } catch { Add-Result $demoSite 'Démonstration des droits' 'ÉCHEC' $_.Exception.Message }
}

# --- Bilan ---------------------------------------------------------------
Write-Host ""
$results | Format-Table Site, Controle, Statut, Detail -AutoSize -Wrap | Out-String | Write-Host
$bad = @($results | Where-Object { $_.Statut -ne 'OK' })
if ($bad.Count -eq 0) {
    Write-Host "Organisation conforme : $($results.Count) contrôle(s) réussi(s)." -ForegroundColor Green
    exit 0
}
Write-Host "$($bad.Count) contrôle(s) à traiter sur $($results.Count)." -ForegroundColor Yellow
exit 1
