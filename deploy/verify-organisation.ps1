#Requires -Version 7.0
<#
.SYNOPSIS
    Vérifie HORS LIGNE le kit « organisation » : validation de la configuration,
    calcul des URL des sites, fichier d'environnement. Aucune connexion SharePoint.

.EXAMPLE
    pwsh -File deploy/verify-organisation.ps1
    Sortie 0 si tout passe, 1 sinon.
#>
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'BbiOrganization.ps1')

$script:passed = 0
$script:failed = 0
function Check {
    param([string]$Label, [bool]$Condition, [string]$Detail = '')
    if ($Condition) { $script:passed++; Write-Host "  ✓ $Label" -ForegroundColor Green }
    else { $script:failed++; Write-Host "  ✗ $Label$(if ($Detail) { " — $Detail" })" -ForegroundColor Red }
}

# Configuration valide, modifiable champ par champ pour fabriquer des cas d'erreur
function New-TestConfig { Get-Content (Join-Path $PSScriptRoot 'organisation.example.json') -Raw -Encoding UTF8 | ConvertFrom-Json }
function Get-Errors { param($Config) @(Test-BbiOrganizationConfig -Config $Config) }
function Has-Error { param($Config, [string]$Pattern) (@(Get-Errors $Config | Where-Object { $_ -match $Pattern })).Count -gt 0 }

Write-Host "Kit organisation : vérification hors ligne" -ForegroundColor White

# --- Exemple fourni ---------------------------------------------------
Write-Host "`nConfiguration d'exemple"
$cfg = New-TestConfig
$err = Get-Errors $cfg
Check "l'exemple fourni est valide" ($err.Count -eq 0) ($err -join ' | ')

$plan = Get-BbiOrganizationPlan -Config $cfg -BaseDirectory $PSScriptRoot
Check "URL du siège" ($plan.Siege.Url -eq 'https://businessbuilderinter.sharepoint.com/sites/intranet') $plan.Siege.Url
Check "URL d'administration" ($plan.AdminUrl -eq 'https://businessbuilderinter-admin.sharepoint.com') $plan.AdminUrl
Check "trois filiales planifiées" ($plan.Filiales.Count -eq 3) "$($plan.Filiales.Count)"
Check "URL d'une filiale = /sites/intranet-abidjan (même règle que provision-bbi-intranet.ps1)" ($plan.Filiales[0].Url -eq 'https://businessbuilderinter.sharepoint.com/sites/intranet-abidjan') $plan.Filiales[0].Url
Check "l'ordre des filiales suit la configuration" ((($plan.Filiales | ForEach-Object Ordre) -join ',') -eq '1,2,3')
Check "toutes les filiales sont sélectionnées sans filtre" (@($plan.Filiales | Where-Object Selectionnee).Count -eq 3)
Check "chemin du paquet résolu en chemin absolu" ([IO.Path]::IsPathRooted($plan.CheminPaquet) -and $plan.CheminPaquet -like '*bbi-portail.sppkg') $plan.CheminPaquet
Check "valeurs par défaut : hub, démo, déploiement" ($plan.Hub -and $plan.DonneesDemo -and $plan.DeployerApp)
Check "groupe éditeurs par défaut" ($plan.GroupeEditeurs -eq 'BBI-Concepteurs')

$filtered = Get-BbiOrganizationPlan -Config $cfg -Filiale 'bamako' -BaseDirectory $PSScriptRoot
Check "filtre -Filiale insensible à la casse et aux accents" ((@($filtered.Filiales | Where-Object Selectionnee | ForEach-Object Ville) -join ',') -eq 'Bamako')

# Ville accentuée : même slug que le script de provisionnement
$cfg = New-TestConfig
$cfg.filiales[0].ville = 'Thiès'
$cfg.filiales[0].titre = 'Filiale Thiès'
$p = Get-BbiOrganizationPlan -Config $cfg -BaseDirectory $PSScriptRoot
Check "ville accentuée : Thiès → intranet-thies" ($p.Filiales[0].Url -like '*/sites/intranet-thies') $p.Filiales[0].Url

# --- Fichier d'environnement ------------------------------------------
Write-Host "`nFichier d'environnement"
$tmp = Join-Path ([IO.Path]::GetTempPath()) "bbi-env-test-$([guid]::NewGuid().ToString('N')).json"
try {
    New-BbiEnvironmentFile -Plan $plan -Path $tmp | Out-Null
    $envData = Get-Content $tmp -Raw -Encoding UTF8 | ConvertFrom-Json
    Check "siteUrl = URL du siège" ($envData.siteUrl -eq $plan.Siege.Url)
    Check "tenantHost" ($envData.tenantHost -eq 'businessbuilderinter.sharepoint.com')
    Check "sitePath" ($envData.sitePath -eq '/sites/intranet')
    Check "filialeSitePrefix et hubEnabled" ($envData.filialeSitePrefix -eq 'intranet-' -and $envData.hubEnabled -eq $true)
    Check "editorsGroup" ($envData.editorsGroup -eq 'BBI-Concepteurs')
    $bytes = [IO.File]::ReadAllBytes($tmp)
    Check "fichier en UTF-8 sans BOM" (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF))
} finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

# --- Cas d'erreur -----------------------------------------------------
Write-Host "`nValidation : cas d'erreur"
$c = New-TestConfig; $c.tenant.nom = ''
Check "tenant.nom vide refusé" (Has-Error $c 'tenant.nom est obligatoire')
$c = New-TestConfig; $c.tenant.nom = 'Mon Tenant'
Check "tenant.nom avec espace ou majuscule refusé" (Has-Error $c 'tenant.nom')
$c = New-TestConfig; $c.siege.alias = 'Intranet RH'
Check "siege.alias avec espace refusé" (Has-Error $c 'siege.alias')
$c = New-TestConfig; $c.siege.titre = ''
Check "siege.titre vide refusé" (Has-Error $c 'siege.titre')
$c = New-TestConfig; $c.filiales[1].ville = 'Abidjan'
Check "deux filiales avec la même ville refusées" (Has-Error $c 'même site')
$c = New-TestConfig; $c.filiales[0].ville = ''
Check "ville vide refusée" (Has-Error $c 'filiales\[1\]\.ville est obligatoire')
$c = New-TestConfig; $c.filiales[0].titre = ''
Check "titre de filiale vide refusé" (Has-Error $c 'filiales\[1\]\.titre')
$c = New-TestConfig; $c.filiales[2].couleur = 'rouge'
Check "couleur invalide refusée" (Has-Error $c 'couleur')
$c = New-TestConfig; $c.siege.proprietaires = @('pas-un-mail')
Check "adresse e-mail invalide refusée" (Has-Error $c 'adresse e-mail invalide')
$c = New-TestConfig; $c.groupes.editeurs.membres = @('x@y')
Check "adresse e-mail incomplète refusée (éditeurs)" (Has-Error $c 'groupes.editeurs.membres')
$c = New-TestConfig; $c.options.prefixeFiliale = 'Intra Net_'
Check "préfixe de filiale invalide refusé" (Has-Error $c 'prefixeFiliale')
$c = New-TestConfig; $c.siege.alias = 'intranet-abidjan'
Check "filiale dont l'URL égale celle du siège refusée" (Has-Error $c 'même URL que le siège')
$c = New-TestConfig; $c.filiales = @()
Check "aucune filiale : configuration acceptée (siège seul)" ((Get-Errors $c).Count -eq 0)

# --- Lecture de fichier ------------------------------------------------
Write-Host "`nLecture de fichier"
$threw = $false
try { Read-BbiOrganizationConfig -Path (Join-Path $PSScriptRoot 'nexiste-pas.json') | Out-Null } catch { $threw = $_.Exception.Message -match 'introuvable' }
Check "fichier absent : message explicite" $threw
$bad = Join-Path ([IO.Path]::GetTempPath()) "bbi-bad-$([guid]::NewGuid().ToString('N')).json"
try {
    Set-Content -Path $bad -Value '{ pas du json' -Encoding utf8
    $threw = $false
    try { Read-BbiOrganizationConfig -Path $bad | Out-Null } catch { $threw = $_.Exception.Message -match 'JSON invalide' }
    Check "JSON invalide : message explicite" $threw
} finally { Remove-Item $bad -ErrorAction SilentlyContinue }
$ok = Read-BbiOrganizationConfig -Path (Join-Path $PSScriptRoot 'organisation.example.json')
Check "Read-BbiOrganizationConfig lit l'exemple" ($ok.tenant.nom -eq 'businessbuilderinter')

Write-Host ""
Write-Host "Résultat : $($script:passed) vérification(s) réussie(s), $($script:failed) échec(s)." -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $(if ($script:failed -eq 0) { 0 } else { 1 })
