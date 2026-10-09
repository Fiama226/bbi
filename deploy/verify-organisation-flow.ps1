#Requires -Version 7.0
<#
.SYNOPSIS
    Joue HORS LIGNE le déroulé complet de New-BbiOrganization.ps1 contre un SharePoint SIMULÉ.

.DESCRIPTION
    Aucune connexion, aucun tenant : les cmdlets PnP.PowerShell sont remplacées par des
    simulations qui tiennent un faux tenant en mémoire. Le script copie le kit dans un dossier
    temporaire, remplace provision-bbi-intranet.ps1 par un faux qui crée listes, page et sites
    de filiale dans le faux tenant, puis vérifie :
      - plan seul et simulation (-DryRun) : rien n'est créé ;
      - exécution complète : siège, application, groupe, deux passes de provisionnement
        avec les bons paramètres, implantations, permissions, identité visuelle, audit final ;
      - seconde exécution : idempotente (rien n'est recréé) ;
      - -Filiale : une seule filiale ; catalogue absent ; configuration invalide.

    Ce banc d'essai valide la logique d'enchaînement du kit. Il ne remplace PAS un essai réel :
    il ne vérifie ni les noms exacts des paramètres PnP.PowerShell ni les droits du tenant.

.EXAMPLE
    pwsh -File deploy/verify-organisation-flow.ps1
    Sortie 0 si tout passe, 1 sinon.
#>
$ErrorActionPreference = 'Stop'

$script:passed = 0
$script:failed = 0
function Check {
    param([string]$Label, [bool]$Condition, [string]$Detail = '')
    if ($Condition) { $script:passed++; Write-Host "  ✓ $Label" -ForegroundColor Green }
    else { $script:failed++; Write-Host "  ✗ $Label$(if ($Detail) { " — $Detail" })" -ForegroundColor Red }
}

# ------------------------------------------------------------------
# Dossier de travail : copie du kit + faux provisionnement + configuration de test
# ------------------------------------------------------------------
$work = Join-Path ([IO.Path]::GetTempPath()) "bbi-flow-$([guid]::NewGuid().ToString('N'))"
$dep  = Join-Path $work 'deploy'
New-Item -ItemType Directory -Path $dep, (Join-Path $work 'deliverables/spfx') | Out-Null
foreach ($f in 'BbiOrganization.ps1', 'BbiSlug.ps1', 'New-BbiOrganization.ps1', 'Test-BbiOrganization.ps1') { Copy-Item (Join-Path $PSScriptRoot $f) $dep }
Set-Content (Join-Path $work 'deliverables/spfx/bbi-portail.sppkg') 'paquet factice'
Set-Content (Join-Path $dep 'logo.png') 'image factice'

$cfg = Get-Content (Join-Path $PSScriptRoot 'organisation.example.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$cfg.siege.proprietaires = @('direction@exemple.com')
$cfg.siege.visiteurs = @('lecteur@exemple.com')
$cfg.filiales[0].proprietaires = @('abidjan.resp@exemple.com')
$cfg.filiales[0].membres = @('abidjan.membre@exemple.com')
$cfg.groupes.editeurs.membres = @('editeur@exemple.com')
$cfg.groupes.lectureTous = $true
$cfg.identite.logo = 'logo.png'
$cfg.identite.piedDePage = @([pscustomobject]@{ titre = 'Mentions légales'; url = 'https://exemple.com/mentions' })
$cfgPath = Join-Path $dep 'organisation.json'
$cfg | ConvertTo-Json -Depth 10 | Set-Content $cfgPath -Encoding utf8

# Faux provision-bbi-intranet.ps1 : enregistre ses paramètres et crée listes, page, hub et filiales
$stub = @'
[CmdletBinding()]
param(
    [string]$SiteUrl, [string]$DataSiteUrl, [string]$EditorsGroup = '',
    [switch]$SeedDemoData, [switch]$DryRun, [switch]$VerifyOnly, [switch]$ProvisionFiliales,
    [string[]]$Filiale, [string]$EnvironmentFile = '', [string]$ClientId = '', [switch]$SkipNavigation
)
. (Join-Path $PSScriptRoot 'BbiSlug.ps1')
Log ("provision site=$SiteUrl env=$([IO.Path]::GetFileName($EnvironmentFile)) client=$ClientId dry=$($DryRun.IsPresent) filiales=$($ProvisionFiliales.IsPresent) demo=$($SeedDemoData.IsPresent) filtre=$($Filiale -join ',') skipnav=$($SkipNavigation.IsPresent)")
if ($DryRun) { return }
$envData = Get-Content $EnvironmentFile -Raw -Encoding UTF8 | ConvertFrom-Json
$hubUrl = $SiteUrl.TrimEnd('/')
Provision-MockSite $hubUrl
if ($ProvisionFiliales) {
    $global:Mock.HubUrl = $hubUrl
    $global:Mock.Sites[$hubUrl].HubSiteId = $global:Mock.HubId
    $rows = @($global:Mock.Sites[$hubUrl].Items['Implantations'] | Where-Object { -not $_['EstSiege'] })
    $filter = @($Filiale | ForEach-Object { ConvertTo-BbiSlug -Value $_ } | Where-Object { $_ })
    foreach ($row in $rows) {
        if ($filter.Count -gt 0 -and $filter -notcontains (ConvertTo-BbiSlug -Value $row['Ville'])) { continue }
        $slug = ConvertTo-BbiSlug -Prefix $envData.filialeSitePrefix -Value $row['Ville']
        $url = "$($envData.tenantUrl)/sites/$slug"
        if (-not $global:Mock.Sites.ContainsKey($url)) { New-MockSite $url | Out-Null; Log "provision-created $slug" }
        $global:Mock.Sites[$url].HubSiteId = $global:Mock.HubId
        Provision-MockSite $url
        $row['SiteUrl'] = [pscustomobject]@{ Url = $url; Description = $row['Title'] }
    }
}
'@
Set-Content (Join-Path $dep 'provision-bbi-intranet.ps1') $stub -Encoding utf8

# ------------------------------------------------------------------
# Faux tenant SharePoint (fonctions globales : elles masquent les cmdlets PnP)
# ------------------------------------------------------------------
$RequiredLists = @('Actualites', 'Sessions', 'Formateurs', 'Formations', 'Offres', 'Employés du mois', 'Certifications', 'Annonces', 'Pensées du jour', 'Anniversaires', 'Implantations', 'Nos références', 'Références pédagogiques', 'Supports publiés', 'Documents administratifs', 'Galerie médias')

function global:Log { param([string]$Message) $global:Mock.Calls.Add($Message) }
function global:Reset-Mock {
    param([switch]$NoCatalog)
    $global:Mock = @{
        Calls = [System.Collections.Generic.List[string]]::new()
        Sites = @{}; Current = ''; Groups = @{}; M365 = @{}; Nav = @{}
        Catalog = $(if ($NoCatalog) { $null } else { 'https://businessbuilderinter.sharepoint.com/sites/appcatalog' })
        AppDeployed = $false; HubUrl = ''; HubId = [guid]::NewGuid().ToString(); NextId = 1
        TenantId = [guid]::NewGuid().ToString(); RequiredLists = $RequiredLists
    }
}
function global:New-MockSite {
    param([string]$Url)
    $u = $Url.TrimEnd('/')
    $global:Mock.Sites[$u] = @{ HubSiteId = [Guid]::Empty.ToString(); GroupId = [guid]::NewGuid().ToString(); Lists = @{}; Items = @{}; Page = $false; WebPart = $false }
    return $u
}
function global:Provision-MockSite {
    param([string]$Url)
    $s = $global:Mock.Sites[$Url]
    foreach ($n in $global:Mock.RequiredLists) { $s.Lists[$n] = $true }
    if (-not $s.Items.ContainsKey('Implantations')) { $s.Items['Implantations'] = [System.Collections.Generic.List[object]]::new() }
    $s.Page = $true; $s.WebPart = $true
}
function global:Get-MockSite { $global:Mock.Sites[$global:Mock.Current] }
function global:Get-MockGroup { param([string]$Name) $key = "$($global:Mock.Current)|$Name"; if (-not $global:Mock.Groups.ContainsKey($key)) { $global:Mock.Groups[$key] = @{ Name = $Name; Members = [System.Collections.Generic.List[object]]::new() } }; $global:Mock.Groups[$key] }

function global:Get-Module { [CmdletBinding()] param([switch]$ListAvailable, [string]$Name) [pscustomobject]@{ Name = 'PnP.PowerShell'; Version = [version]'2.12.0' } }
function global:Connect-PnPOnline { [CmdletBinding()] param([string]$Url, [switch]$Interactive, [string]$ClientId) $global:Mock.Current = $Url.TrimEnd('/'); Log "connect $($Url.TrimEnd('/'))$(if ($ClientId) { ' client=' + $ClientId })" }
function global:Get-PnPTenantSite { [CmdletBinding()] param([string]$Url) $u = $Url.TrimEnd('/'); if ($global:Mock.Sites.ContainsKey($u)) { [pscustomobject]@{ Url = $u; HubSiteId = $global:Mock.Sites[$u].HubSiteId } } else { throw "site introuvable : $u" } }
function global:New-PnPSite { [CmdletBinding()] param([string]$Type, [string]$Title, [string]$Alias, [switch]$IsPublic, [int]$Lcid, [switch]$Wait) $u = New-MockSite "https://businessbuilderinter.sharepoint.com/sites/$Alias"; Log "new-site $Alias lcid=$Lcid public=$($IsPublic.IsPresent)"; $u }
function global:Get-PnPTenantAppCatalogUrl { [CmdletBinding()] param() $global:Mock.Catalog }
function global:Add-PnPApp { [CmdletBinding()] param([string]$Path, [string]$Scope, [switch]$Overwrite, [switch]$Publish) Log "add-app $([IO.Path]::GetFileName($Path)) scope=$Scope publish=$($Publish.IsPresent)"; $global:Mock.AppDeployed = $true }
function global:Get-PnPApp { [CmdletBinding()] param([string]$Scope) if ($global:Mock.AppDeployed) { [pscustomobject]@{ Title = 'bbi-portail-client-side-solution'; Deployed = $true; AppCatalogVersion = '1.9.0.0' } } }
function global:Get-PnPHubSite { [CmdletBinding()] param([string]$Identity) if ($global:Mock.HubUrl -eq $Identity.TrimEnd('/')) { [pscustomobject]@{ ID = $global:Mock.HubId; SiteId = $global:Mock.HubId } } else { throw 'hub introuvable' } }

function global:Get-PnPGroup {
    [CmdletBinding()] param([string]$Identity, [switch]$AssociatedOwnerGroup, [switch]$AssociatedMemberGroup, [switch]$AssociatedVisitorGroup)
    if ($AssociatedOwnerGroup) { return [pscustomobject](Get-MockGroup 'Owners') }
    if ($AssociatedMemberGroup) { return [pscustomobject](Get-MockGroup 'Members') }
    if ($AssociatedVisitorGroup) { return [pscustomobject](Get-MockGroup 'Visitors') }
    $key = "$($global:Mock.Current)|$Identity"
    if ($global:Mock.Groups.ContainsKey($key)) { return [pscustomobject]$global:Mock.Groups[$key] }
    throw "groupe introuvable : $Identity"
}
function global:New-PnPGroup { [CmdletBinding()] param([string]$Title, [string]$Description) Get-MockGroup $Title | Out-Null; Log "new-group $Title" }
function global:Get-PnPGroupMember { [CmdletBinding()] param($Group) $name = if ($Group -is [string]) { $Group } else { $Group.Name }; @((Get-MockGroup $name).Members) }
function global:Add-PnPGroupMember { [CmdletBinding()] param([string]$LoginName, $Group) $name = if ($Group -is [string]) { $Group } else { $Group.Name }; (Get-MockGroup $name).Members.Add([pscustomobject]@{ LoginName = $LoginName; Email = ($LoginName -split '\|')[-1] }); Log "group-add $name $LoginName" }
function global:Get-PnPSite { [CmdletBinding()] param([string[]]$Includes) [pscustomobject]@{ GroupId = (Get-MockSite).GroupId } }
function global:Add-PnPMicrosoft365GroupOwner { [CmdletBinding()] param([string]$Identity, [string[]]$Users) if (-not $global:Mock.M365.ContainsKey($Identity)) { $global:Mock.M365[$Identity] = @{ Owners = [System.Collections.Generic.List[string]]::new(); Members = [System.Collections.Generic.List[string]]::new() } }; foreach ($u in $Users) { if ($global:Mock.M365[$Identity].Owners.Contains($u)) { throw 'One or more added object references already exist' }; $global:Mock.M365[$Identity].Owners.Add($u) }; Log "m365-owner $($Users -join ',')" }
function global:Add-PnPMicrosoft365GroupMember { [CmdletBinding()] param([string]$Identity, [string[]]$Users) if (-not $global:Mock.M365.ContainsKey($Identity)) { $global:Mock.M365[$Identity] = @{ Owners = [System.Collections.Generic.List[string]]::new(); Members = [System.Collections.Generic.List[string]]::new() } }; foreach ($u in $Users) { if ($global:Mock.M365[$Identity].Members.Contains($u)) { throw 'One or more added object references already exist' }; $global:Mock.M365[$Identity].Members.Add($u) }; Log "m365-member $($Users -join ',')" }
function global:Get-PnPMicrosoft365GroupOwner { [CmdletBinding()] param([string]$Identity) if ($global:Mock.M365.ContainsKey($Identity)) { $global:Mock.M365[$Identity].Owners | ForEach-Object { [pscustomobject]@{ Email = $_; UserPrincipalName = $_ } } } }
function global:Get-PnPMicrosoft365GroupMember { [CmdletBinding()] param([string]$Identity) if ($global:Mock.M365.ContainsKey($Identity)) { $global:Mock.M365[$Identity].Members | ForEach-Object { [pscustomobject]@{ Email = $_; UserPrincipalName = $_ } } } }
function global:Get-PnPTenantId { [CmdletBinding()] param() $global:Mock.TenantId }

function global:Get-PnPList { [CmdletBinding()] param([string]$Identity) if ((Get-MockSite).Lists.ContainsKey($Identity)) { [pscustomobject]@{ Title = $Identity } } }
function global:Get-PnPListItem { [CmdletBinding()] param([string]$List, [int]$PageSize) $items = (Get-MockSite).Items; if ($items.ContainsKey($List)) { @($items[$List]) } else { @() } }
function global:Add-PnPListItem {
    [CmdletBinding()] param([string]$List, [hashtable]$Values)
    $items = (Get-MockSite).Items; if (-not $items.ContainsKey($List)) { $items[$List] = [System.Collections.Generic.List[object]]::new() }
    $row = @{ Id = $global:Mock.NextId++ }; foreach ($k in $Values.Keys) { $row[$k] = $Values[$k] }
    if ($row['SiteUrl'] -is [string]) { $parts = $row['SiteUrl'] -split ',\s*', 2; $row['SiteUrl'] = [pscustomobject]@{ Url = $parts[0]; Description = $parts[1] } }
    $items[$List].Add($row); Log "item-add $List $($Values['Title'])"
}
function global:Set-PnPListItem {
    [CmdletBinding()] param([string]$List, $Identity, [hashtable]$Values)
    $row = @((Get-MockSite).Items[$List] | Where-Object { $_['Id'] -eq $Identity })[0]
    foreach ($k in $Values.Keys) { $row[$k] = $Values[$k] }
    if ($row['SiteUrl'] -is [string]) { $parts = $row['SiteUrl'] -split ',\s*', 2; $row['SiteUrl'] = [pscustomobject]@{ Url = $parts[0]; Description = $parts[1] } }
    Log "item-set $List $($Values['Title'])"
}
function global:Get-PnPPage { [CmdletBinding()] param([string]$Identity) if ((Get-MockSite).Page) { [pscustomobject]@{ Name = $Identity } } else { throw 'page introuvable' } }
function global:Get-PnPPageComponent { [CmdletBinding()] param([string]$Page) if ((Get-MockSite).WebPart) { [pscustomobject]@{ WebPartId = '{6a9b6e3b-44f1-4a70-8f0a-45c82b29126d}' } } }

function global:Set-PnPWebTheme { [CmdletBinding()] param([string]$Theme, [string]$WebUrl) Log "theme $Theme $WebUrl" }
function global:Set-PnPWebHeader { [CmdletBinding()] param([string]$HeaderLayout, [string]$HeaderEmphasis, [string]$SiteLogoUrl) Log "header $($global:Mock.Current) $HeaderLayout/$HeaderEmphasis$(if ($SiteLogoUrl) { ' logo=' + $SiteLogoUrl })" }
function global:Add-PnPFile { [CmdletBinding()] param([string]$Path, [string]$Folder) Log "upload $([IO.Path]::GetFileName($Path)) $Folder"; [pscustomobject]@{ ServerRelativeUrl = "/$Folder/$([IO.Path]::GetFileName($Path))" } }
function global:Set-PnPFooter { [CmdletBinding()] param([switch]$Enabled, [string]$Layout, [string]$Title) Log "footer $($global:Mock.Current) $Title" }
function global:Get-PnPNavigationNode { [CmdletBinding()] param([string]$Location) $k = "$($global:Mock.Current)|$Location"; if ($global:Mock.Nav.ContainsKey($k)) { @($global:Mock.Nav[$k] | ForEach-Object { [pscustomobject]@{ Title = $_ } }) } else { @() } }
function global:Add-PnPNavigationNode { [CmdletBinding()] param([string]$Location, [string]$Title, [string]$Url) $k = "$($global:Mock.Current)|$Location"; if (-not $global:Mock.Nav.ContainsKey($k)) { $global:Mock.Nav[$k] = [System.Collections.Generic.List[string]]::new() }; $global:Mock.Nav[$k].Add($Title); Log "nav-add $Location $Title" }

function Invoke-Scenario {
    param([hashtable]$Arguments)
    $global:LASTEXITCODE = 0
    $thrown = $null
    $out = ''
    try { $out = (& (Join-Path $dep 'New-BbiOrganization.ps1') @Arguments *>&1 | Out-String) } catch { $thrown = $_.Exception.Message }
    [pscustomobject]@{ Out = $out; Exit = $LASTEXITCODE; Thrown = $thrown; Calls = @($global:Mock.Calls) }
}
function Count-Calls { param($Calls, [string]$Pattern) @($Calls | Where-Object { $_ -match $Pattern }).Count }

try {
    Write-Host "Kit organisation : déroulé complet contre un SharePoint simulé" -ForegroundColor White

    # --- 1. Plan seul ------------------------------------------------
    Write-Host "`nPlan seul (-PlanOnly)"
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; PlanOnly = $true }
    Check "sortie 0 et message explicite" ($r.Exit -eq 0 -and $r.Out -match 'PlanOnly') "exit=$($r.Exit)"
    Check "aucun appel SharePoint" ($r.Calls.Count -eq 0) ($r.Calls -join ' | ')

    # --- 2. Simulation sur un tenant vide ------------------------------
    Write-Host "`nSimulation (-DryRun) sur un tenant vide"
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; DryRun = $true; ClientId = 'cid-1' }
    Check "sortie 0" ($r.Exit -eq 0) "exit=$($r.Exit) $($r.Thrown)"
    Check "aucun site, groupe, application ni élément créé" ((Count-Calls $r.Calls '^(new-site|new-group|add-app|item-add|group-add|m365-)') -eq 0) ($r.Calls -join ' | ')
    Check "la simulation s'arrête quand le siège manque" ($r.Out -match "simulation s'arrête")
    Check "connexion avec l'identifiant d'application" ((Count-Calls $r.Calls 'client=cid-1') -ge 1)

    # --- 3. Exécution complète -----------------------------------------
    Write-Host "`nExécution complète sur un tenant vide"
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; ClientId = 'cid-1' }
    $m = $global:Mock
    $siege = 'https://businessbuilderinter.sharepoint.com/sites/intranet'
    Check "sortie 0" ($r.Exit -eq 0) "exit=$($r.Exit) $($r.Thrown)"
    Check "siège créé une fois, privé, en français" ((Count-Calls $r.Calls '^new-site intranet lcid=1036 public=False$') -eq 1) ($r.Calls | Where-Object { $_ -match 'new-site' })
    Check "application téléversée et publiée" ((Count-Calls $r.Calls '^add-app bbi-portail\.sppkg scope=Tenant publish=True$') -eq 1)
    Check "groupe des éditeurs créé" ((Count-Calls $r.Calls '^new-group BBI-Concepteurs$') -eq 1)
    Check "éditeur ajouté au groupe" ((Count-Calls $r.Calls 'group-add BBI-Concepteurs .*editeur@exemple.com') -eq 1)
    $prov = @($r.Calls | Where-Object { $_ -like 'provision *' })
    Check "deux passes de provisionnement" ($prov.Count -eq 2) ($prov -join ' | ')
    Check "passe 1 : siège, sans filiales ni démo, fichier d'environnement et client transmis" ($prov[0] -match 'site=https://businessbuilderinter.sharepoint.com/sites/intranet env=bbi-environnement.businessbuilderinter.json client=cid-1 dry=False filiales=False demo=False filtre= skipnav=True') $prov[0]
    Check "passe 2 : filiales et données de démonstration, navigation du siège créée" ($prov[1] -match 'filiales=True demo=True filtre= skipnav=False') $prov[1]
    Check "trois filiales créées par le provisionnement" ((Count-Calls $r.Calls '^provision-created intranet-') -eq 3)
    $impl = @($m.Sites[$siege].Items['Implantations'])
    Check "Implantations du siège : 4 lignes (siège + 3 filiales)" ($impl.Count -eq 4) "$($impl.Count)"
    $siegeRow = $impl | Where-Object { $_['EstSiege'] } | Select-Object -First 1
    Check "ligne du siège : ordre 0, couleur, lien du site" ($siegeRow -and $siegeRow['Ordre'] -eq 0 -and $siegeRow['Couleur'] -eq '#0E265C' -and $siegeRow['SiteUrl'].Url -eq $siege)
    $abj = $impl | Where-Object { $_['Ville'] -eq 'Abidjan' } | Select-Object -First 1
    Check "ligne Abidjan : pays, initiales, couleur, lien /sites/intranet-abidjan" ($abj -and $abj['Pays'] -eq "Côte d'Ivoire" -and $abj['Initiales'] -eq 'AB' -and $abj['Couleur'] -eq '#C8102E' -and $abj['SiteUrl'].Url -like '*/sites/intranet-abidjan')
    $filialeUrls = @('abidjan', 'bamako', 'dakar') | ForEach-Object { "https://businessbuilderinter.sharepoint.com/sites/intranet-$_" }
    Check "bandeau Siège et filiales recopié sur chaque filiale (4 lignes)" ((@($filialeUrls | Where-Object { @($m.Sites[$_].Items['Implantations']).Count -eq 4 })).Count -eq 3)
    Check "filiales rattachées au hub" ((@($filialeUrls | Where-Object { $m.Sites[$_].HubSiteId -eq $m.HubId })).Count -eq 3)

    $abjUrl = $filialeUrls[0]
    $siegeGroup = $m.Sites[$siege].GroupId
    Check "siège : propriétaire ajouté au groupe Microsoft 365" ($m.M365[$siegeGroup].Owners -contains 'direction@exemple.com')
    Check "siège : visiteur ajouté au groupe SharePoint des visiteurs" ((Count-Calls $r.Calls 'group-add Visitors .*lecteur@exemple.com') -eq 1)
    Check "Abidjan : propriétaire et membre dans le groupe Microsoft 365" ($m.M365[$m.Sites[$abjUrl].GroupId].Owners -contains 'abidjan.resp@exemple.com' -and $m.M365[$m.Sites[$abjUrl].GroupId].Members -contains 'abidjan.membre@exemple.com')
    Check "« Tout le monde sauf externes » ajouté aux visiteurs de chacun des 4 sites" ((Count-Calls $r.Calls "group-add Visitors c:0-\.f\|rolemanager\|spo-grid-all-users/$($m.TenantId)") -eq 4)
    Check "thème appliqué à chacun des 4 sites" ((Count-Calls $r.Calls '^theme BBI Bleu nuit ') -eq 4)
    Check "logo téléversé et utilisé dans l'en-tête de chaque site" ((Count-Calls $r.Calls '^upload logo.png SiteAssets$') -eq 4 -and (Count-Calls $r.Calls '^header .* Compact/Strong logo=/SiteAssets/logo.png$') -eq 4)
    Check "pied de page et lien « Mentions légales » sur chacun des 4 sites" ((Count-Calls $r.Calls '^footer ') -eq 4 -and (Count-Calls $r.Calls '^nav-add Footer Mentions légales$') -eq 4)
    Check "audit final : organisation conforme" ($r.Out -match 'Organisation conforme') (($r.Out -split "`n" | Select-String 'contrôle' | Select-Object -First 3 | ForEach-Object { $_.Line.Trim() }) -join ' | ')

    # --- 4. Seconde exécution : idempotence ------------------------------
    Write-Host "`nSeconde exécution (idempotence)"
    $m.Calls.Clear()
    $r2 = Invoke-Scenario @{ Config = $cfgPath; ClientId = 'cid-1' }
    Check "sortie 0" ($r2.Exit -eq 0) "exit=$($r2.Exit) $($r2.Thrown)"
    Check "aucun site recréé" ((Count-Calls $r2.Calls '^(new-site|provision-created)') -eq 0)
    Check "aucun groupe recréé" ((Count-Calls $r2.Calls '^new-group') -eq 0)
    Check "aucune implantation en double (mises à jour seulement)" ((Count-Calls $r2.Calls '^item-add') -eq 0 -and (Count-Calls $r2.Calls '^item-set Implantations') -ge 4)
    Check "aucun membre rajouté deux fois" ((Count-Calls $r2.Calls '^group-add') -eq 0)
    Check "pas de doublon de lien de pied de page" ((Count-Calls $r2.Calls '^nav-add') -eq 0)
    Check "audit final : organisation conforme" ($r2.Out -match 'Organisation conforme')

    # --- 5. Une seule filiale ---------------------------------------------
    Write-Host "`nUne seule filiale (-Filiale dakar)"
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; ClientId = 'cid-1'; Filiale = @('dakar') }
    $m = $global:Mock
    Check "sortie 0" ($r.Exit -eq 0) "exit=$($r.Exit) $($r.Thrown)"
    Check "seule Dakar est créée" ($m.Sites.ContainsKey('https://businessbuilderinter.sharepoint.com/sites/intranet-dakar') -and -not $m.Sites.ContainsKey('https://businessbuilderinter.sharepoint.com/sites/intranet-abidjan') -and -not $m.Sites.ContainsKey('https://businessbuilderinter.sharepoint.com/sites/intranet-bamako'))
    Check "le filtre est transmis au provisionnement" ((Count-Calls $r.Calls 'filiales=True demo=True filtre=dakar skipnav=False') -eq 1)
    Check "une seule filiale reçoit l'identité visuelle (siège + Dakar = 2 thèmes)" ((Count-Calls $r.Calls '^theme ') -eq 2)

    # --- 6. Options -------------------------------------------------------
    Write-Host "`nOptions"
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; ClientId = 'cid-1'; SkipAppDeploy = $true; SkipDemoData = $true; SkipPermissions = $true; SkipBranding = $true }
    Check "sortie 0" ($r.Exit -eq 0) "exit=$($r.Exit) $($r.Thrown)"
    Check "-SkipAppDeploy : aucune application téléversée" ((Count-Calls $r.Calls '^add-app') -eq 0)
    Check "-SkipDemoData : passe 2 sans démo" ((Count-Calls $r.Calls 'filiales=True demo=False') -eq 1)
    Check "-SkipPermissions : aucun membre ajouté aux sites" ((Count-Calls $r.Calls '^(m365-|group-add Visitors)') -eq 0)
    Check "-SkipBranding : aucun thème ni pied de page" ((Count-Calls $r.Calls '^(theme|footer|header)') -eq 0)

    # --- 7. Erreurs -------------------------------------------------------
    Write-Host "`nErreurs"
    Reset-Mock -NoCatalog
    $r = Invoke-Scenario @{ Config = $cfgPath; ClientId = 'cid-1' }
    Check "catalogue d'applications absent : arrêt avec un message clair" (($r.Thrown -match "catalogue d'applications") -or ($r.Out -match "catalogue d'applications")) "$($r.Thrown)"
    Check "catalogue absent : aucun provisionnement lancé" ((Count-Calls $r.Calls '^provision ') -eq 0)

    $badCfg = Join-Path $dep 'bad.json'
    $bad = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $bad.filiales[1].ville = 'Abidjan'
    $bad | ConvertTo-Json -Depth 10 | Set-Content $badCfg -Encoding utf8
    Reset-Mock
    $r = Invoke-Scenario @{ Config = $badCfg; PlanOnly = $true }
    Check "configuration invalide refusée avant toute connexion" ($r.Thrown -match 'même site' -and $r.Calls.Count -eq 0) "$($r.Thrown)"

    Reset-Mock
    $r = Invoke-Scenario @{ Config = (Join-Path $dep 'absent.json'); PlanOnly = $true }
    Check "configuration absente : message explicite" ($r.Thrown -match 'introuvable')

    Reset-Mock
    $r = Invoke-Scenario @{ Config = $cfgPath; PlanOnly = $true; Filiale = @('Tombouctou') }
    Check "filtre -Filiale sans correspondance refusé" ($r.Thrown -match 'Aucune filiale ne correspond')
}
finally {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Résultat : $($script:passed) vérification(s) réussie(s), $($script:failed) échec(s)." -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $(if ($script:failed -eq 0) { 0 } else { 1 })
