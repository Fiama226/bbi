#Requires -Version 7.0
<#
.SYNOPSIS
    Prépare la démonstration de la gestion des droits : groupes de démonstration, dix documents
    Word et PDF avec des droits différents, et le tableau « qui voit quoi ».

.DESCRIPTION
    Pour chaque cas d'usage, le script téléverse un document dans « Supports publiés » ou dans
    « Documents administratifs », puis lui donne des droits PROPRES (héritage rompu) :
      - consultation seule dans le navigateur, sans téléchargement ni modification ;
      - lecture et téléchargement ;
      - modification réservée à un groupe ;
      - document invisible pour les autres (confidentiel, brouillon) ;
      - modification par tous les employés.
    Les propriétaires du site gardent le contrôle total sur chaque document.

    Idempotent : un document déjà téléversé n'est pas remplacé, ses droits sont simplement
    réappliqués. Les groupes sont créés s'ils n'existent pas.

.PARAMETER Config
    Fichier de configuration. Par défaut : deploy/organisation.json.
.PARAMETER ClientId
    Identifiant de l'application Entra ID pour la connexion interactive (voir deploy/README.md).
.PARAMETER PlanOnly
    Affiche le tableau « qui voit quoi » sans se connecter à SharePoint.
.PARAMETER DryRun
    Se connecte en lecture seule et simule : aucun groupe, fichier ni droit n'est créé.

.EXAMPLE
    pwsh -File deploy/New-BbiRightsDemo.ps1 -PlanOnly
    pwsh -File deploy/New-BbiRightsDemo.ps1 -ClientId <id>
#>
[CmdletBinding()]
param(
    [string]$Config = (Join-Path $PSScriptRoot 'organisation.json'),
    [string]$ClientId = '',
    [switch]$PlanOnly,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BbiRightsDemo.ps1')

$script:Report = New-Object System.Collections.Generic.List[object]
function Add-DemoReport { param([string]$Element, [string]$Statut, [string]$Detail = '') $script:Report.Add([pscustomobject]@{ Element = $Element; Statut = $Statut; Detail = $Detail }) }
function Write-DemoStep { param([string]$Message) Write-Host "  → $Message" -ForegroundColor Cyan }
function Write-DemoOk { param([string]$Message) Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-DemoSkip { param([string]$Message) Write-Host "  · $Message (déjà en place)" -ForegroundColor DarkGray }
function Write-DemoWarn { param([string]$Message) Write-Host "  ! $Message" -ForegroundColor Yellow }
function Invoke-Demo {
    param([string]$Description, [scriptblock]$Action)
    if ($DryRun) { Write-DemoStep "[SIMULATION] $Description"; return $null }
    Write-DemoStep $Description
    return (& $Action)
}

# ------------------------------------------------------------------
# Configuration et plan
# ------------------------------------------------------------------
$configPath = (Resolve-Path -LiteralPath $Config -ErrorAction SilentlyContinue)?.Path
if (-not $configPath) { $configPath = $Config }
$cfg   = Read-BbiOrganizationConfig -Path $configPath
$plan  = Get-BbiOrganizationPlan -Config $cfg -BaseDirectory (Split-Path -Parent $configPath)
$rights = Get-BbiRightsDemoPlan -Config $cfg -Plan $plan
if (-not $ClientId) { $ClientId = "$env:BBI_CLIENT_ID" }
if (-not $ClientId) { $ClientId = "$(Get-BbiOptional $cfg.tenant 'clientId' '')" }

Write-BbiRightsMatrix -RightsPlan $rights

if ($PlanOnly) {
    Write-Host "`nMode -PlanOnly : aucune connexion, rien n'a été créé." -ForegroundColor Green
    exit 0
}
if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) { throw "Module PnP.PowerShell absent : Install-Module PnP.PowerShell -Scope CurrentUser" }
if ($DryRun) { Write-DemoWarn "Mode -DryRun : connexion en lecture seule, aucune modification." }

Connect-Bbi -Url $plan.Siege.Url -ClientId $ClientId
Write-DemoOk "Connecté à $($plan.Siege.Url)"

# ------------------------------------------------------------------
# 1. Niveaux de permission (noms propres à la langue du site : on les retrouve par leur nature)
# ------------------------------------------------------------------
Write-Host "`n1/3 · Niveaux de permission" -ForegroundColor White -BackgroundColor DarkBlue
$definitions = @(Get-PnPRoleDefinition)
$roles = @{}
foreach ($pair in @(@('Read', 'Reader'), @('Contribute', 'Contributor'), @('Edit', 'Editor'), @('FullControl', 'Administrator'))) {
    $def = $definitions | Where-Object { "$($_.RoleTypeKind)" -eq $pair[1] } | Select-Object -First 1
    if (-not $def) { throw "Niveau de permission introuvable : $($pair[0]) ($($pair[1]))." }
    $roles[$pair[0]] = $def.Name
}
# « Affichage uniquement » : peut voir les pages et les éléments, mais n'ouvre pas les sources (pas de téléchargement).
$viewOnlyCandidates = @($definitions | Where-Object {
    $_.BasePermissions.Has('ViewListItems') -and $_.BasePermissions.Has('ViewPages') -and
    -not $_.BasePermissions.Has('OpenItems') -and -not $_.BasePermissions.Has('EditListItems')
})
# Préférence au niveau intégré, reconnu par son nom ; sinon le premier niveau qui convient.
# Le rapport indique le niveau retenu : vérifiez qu'il s'agit bien de « Affichage uniquement ».
$viewOnly = @($viewOnlyCandidates | Where-Object { $_.Name -match '^(View Only|Affichage)' })[0]
if (-not $viewOnly) { $viewOnly = $viewOnlyCandidates[0] }
if ($viewOnly) {
    $roles['ViewOnly'] = $viewOnly.Name
    Write-DemoStep "Niveau retenu pour la consultation seule : « $($viewOnly.Name) » (sans téléchargement)"
    Add-DemoReport 'Niveau Affichage uniquement' 'OK' $viewOnly.Name
} else {
    $roles['ViewOnly'] = 'BBI Affichage uniquement'
    $reader = $definitions | Where-Object { "$($_.RoleTypeKind)" -eq 'Reader' } | Select-Object -First 1
    Invoke-Demo "Création du niveau « BBI Affichage uniquement » (Lecture sans « Ouvrir les éléments »)" {
        Add-PnPRoleDefinition -RoleName 'BBI Affichage uniquement' -Clone $reader -Exclude OpenItems -Description 'Consultation dans le navigateur, sans téléchargement ni modification.' | Out-Null
    } | Out-Null
    Add-DemoReport 'Niveau Affichage uniquement' ($(if ($DryRun) { 'MANQUANT' } else { 'CRÉÉ' })) 'BBI Affichage uniquement'
}

# ------------------------------------------------------------------
# 2. Groupes de démonstration
# ------------------------------------------------------------------
Write-Host "`n2/3 · Groupes" -ForegroundColor White -BackgroundColor DarkBlue
foreach ($group in $rights.Groups) {
    try {
        $existing = try { Get-PnPGroup -Identity $group.Name -ErrorAction Stop } catch { $null }
        if ($existing) {
            Write-DemoSkip "Groupe « $($group.Name) »"
            Add-DemoReport "Groupe $($group.Name)" 'OK'
        } else {
            Invoke-Demo "Création du groupe « $($group.Name) »" { New-PnPGroup -Title $group.Name -Description $group.Description | Out-Null } | Out-Null
            Add-DemoReport "Groupe $($group.Name)" ($(if ($DryRun) { 'MANQUANT' } else { 'CRÉÉ' }))
        }
        if ($group.Members.Count -gt 0 -and ($existing -or -not $DryRun)) {
            $current = @(Get-PnPGroupMember -Group $group.Name | ForEach-Object { "$($_.Email)".ToLowerInvariant(); "$($_.LoginName)".ToLowerInvariant() })
            foreach ($mail in $group.Members) {
                $login = "i:0#.f|membership|$mail"
                if ($current -contains $mail.ToLowerInvariant() -or $current -contains $login.ToLowerInvariant()) { Write-DemoSkip "$mail dans $($group.Name)"; continue }
                try {
                    Invoke-Demo "$mail ← $($group.Name)" { Add-PnPGroupMember -LoginName $login -Group $group.Name } | Out-Null
                } catch {
                    Write-DemoWarn "$mail : $($_.Exception.Message)"
                    Add-DemoReport "Compte $mail" 'ÉCHEC' $_.Exception.Message
                }
            }
        }
        # Sans lecture du site, un compte ne peut pas ouvrir la page d'accueil du portail : le groupe n'aurait que
        # l'accès limité. Les dix documents, eux, ont des droits propres : cette lecture ne leur donne aucun accès.
        if ($group.Created) {
            Invoke-Demo "Lecture du site pour « $($group.Name) » (accès à la page d'accueil du portail)" {
                Set-PnPWebPermission -Group $group.Name -AddRole $roles['Read']
            } | Out-Null
        }
    } catch {
        Write-DemoWarn "Groupe $($group.Name) : $($_.Exception.Message)"
        Add-DemoReport "Groupe $($group.Name)" 'ÉCHEC' $_.Exception.Message
    }
}

# ------------------------------------------------------------------
# 3. Documents et droits propres à chaque document
# ------------------------------------------------------------------
Write-Host "`n3/3 · Documents de démonstration" -ForegroundColor White -BackgroundColor DarkBlue
$ownersGroup = "$((Get-PnPGroup -AssociatedOwnerGroup).Title)"
if (-not $ownersGroup) { throw "Groupe des propriétaires du site introuvable : impossible de protéger les documents." }
$workDir = Join-Path ([IO.Path]::GetTempPath()) "bbi-droits-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $workDir | Out-Null
try {
    foreach ($doc in $rights.Documents) {
        $label = "Cas $($doc.Num) · $($doc.FileName)"
        try {
            $library = Get-PnPList -Identity $doc.Library -Includes RootFolder -ErrorAction SilentlyContinue
            if (-not $library) {
                Write-DemoWarn "$label : bibliothèque « $($doc.Library) » absente (lancez d'abord New-BbiOrganization.ps1)."
                Add-DemoReport $label 'MANQUANT' "bibliothèque $($doc.Library)"
                continue
            }
            $root = $library.RootFolder.ServerRelativeUrl
            $fileUrl = "$root/$($doc.FileName)"
            $item = try { Get-PnPFile -Url $fileUrl -AsListItem -ErrorAction Stop } catch { $null }
            if ($item) {
                Write-DemoSkip $label
            } else {
                $path = New-BbiDemoFile -Doc $doc -RightsPlan $rights -Directory $workDir
                $values = @{ Title = $doc.Title }
                foreach ($k in $doc.Metadata.Keys) { $values[$k] = $doc.Metadata[$k] }
                # Dossier racine de la bibliothèque, relatif au site : RootFolder.Name peut rester vide (propriété non chargée).
                $webRoot = "$((Get-PnPWeb).ServerRelativeUrl)".TrimEnd('/')
                $targetFolder = "$root".Substring($webRoot.Length).Trim('/')
                if (-not $targetFolder) { $targetFolder = "$($doc.Library)" }
                Invoke-Demo "Téléversement de $($doc.FileName) dans « $($doc.Library) »" { Add-PnPFile -Path $path -Folder $targetFolder -Values $values | Out-Null } | Out-Null
                if (-not $DryRun) { $item = Get-PnPFile -Url $fileUrl -AsListItem }
            }
            if ($DryRun) { Add-DemoReport $label 'SIMULÉ'; continue }

            # Droits propres : on repart de zéro, les propriétaires gardent le contrôle total.
            Invoke-Demo "Droits du cas $($doc.Num) : propriétaires du site" {
                Set-PnPListItemPermission -List $doc.Library -Identity $item.Id -Group $ownersGroup -AddRole $roles['FullControl'] -ClearExisting
            } | Out-Null
            foreach ($grant in $doc.Grants) {
                $group = $rights.Groups | Where-Object { $_.Key -eq $grant.Group } | Select-Object -First 1
                Invoke-Demo "Droits du cas $($doc.Num) : $($group.Name) → $(Get-BbiRightLabel $grant.Right)" {
                    Set-PnPListItemPermission -List $doc.Library -Identity $item.Id -Group $group.Name -AddRole $roles[$grant.Right]
                } | Out-Null
            }
            Add-DemoReport $label 'OK' (($doc.Grants | ForEach-Object { "$($_.Group)=$($_.Right)" }) -join ', ')
        } catch {
            Write-DemoWarn "$label : $($_.Exception.Message)"
            Add-DemoReport $label 'ÉCHEC' $_.Exception.Message
        }
    }
} finally { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue }

# ------------------------------------------------------------------
# Rapport et mode d'emploi de la démonstration
# ------------------------------------------------------------------
Write-Host "`nRapport" -ForegroundColor White -BackgroundColor DarkBlue
$script:Report | Format-Table -AutoSize -Wrap | Out-String -Width 220 | Write-Host

Write-Host "Pour la démonstration :" -ForegroundColor White
Write-Host "  1. Ouvrez le portail avec chaque compte de démonstration (fenêtre de navigation privée), un compte par groupe :" -ForegroundColor Gray
foreach ($g in $rights.Groups) {
    $who = if ($g.Members.Count -gt 0) { $g.Members -join ', ' } else { '(aucun compte renseigné : demonstration.comptes dans organisation.json)' }
    Write-Host ("     {0,-16} groupe {1,-22} {2}" -f $g.Label, $g.Name, $who) -ForegroundColor Gray
}
Write-Host "  2. Ouvrez « Supports publiés » et « Documents administratifs » : chaque compte ne voit que ses documents." -ForegroundColor Gray
Write-Host "  3. Cas 11, à faire à la main : lien de partage externe. Dans « Supports publiés », ouvrez le document du cas 1, Partager, « Personnes spécifiques », Modifier les paramètres : décochez « Autoriser la modification », cochez « Bloquer le téléchargement », fixez une date d'expiration." -ForegroundColor Gray

$failures = @($script:Report | Where-Object { $_.Statut -in 'ÉCHEC', 'MANQUANT' -and -not ($DryRun -and $_.Statut -eq 'MANQUANT') })
if ($failures.Count -gt 0) { Write-Host "`n$($failures.Count) élément(s) en échec ou manquant(s) : corrigez puis relancez (idempotent)." -ForegroundColor Yellow; exit 1 }
Write-Host "`nTerminé." -ForegroundColor Green
exit 0
