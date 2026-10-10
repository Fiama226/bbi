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
. (Join-Path $PSScriptRoot 'BbiRightsDemo.ps1')

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
    Check "contact support vide par défaut" ($envData.supportEmail -eq '' -and $envData.supportPhone -eq '')
    Check "formulaire de satisfaction vide par défaut" ($envData.satisfactionFormUrl -eq '')
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
$c = New-TestConfig; $c.organisation.emailSupport = 'pas-un-mail'
Check "emailSupport invalide refusé" (Has-Error $c 'emailSupport')
$c = New-TestConfig; $c.organisation.formulaireSatisfaction = 'http://pas-https'
Check "formulaire de satisfaction non https refusé" (Has-Error $c 'formulaireSatisfaction')
$c = New-TestConfig; $c.organisation.formulaireSatisfaction = 'https://forms.office.com/r/abc123'
Check "formulaire de satisfaction https accepté" ((Get-Errors $c).Count -eq 0)
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

# --- Couverture du croquis du client -------------------------------------
Write-Host "`nCouverture du croquis (ce que provision-bbi-intranet.ps1 crée)"
function Get-CmdArg {
    param($Cmd, [string]$Name)
    $els = $Cmd.CommandElements
    for ($i = 0; $i -lt $els.Count; $i++) {
        if ($els[$i] -is [System.Management.Automation.Language.CommandParameterAst] -and $els[$i].ParameterName -ieq $Name) {
            if ($els[$i].Argument) { return $els[$i].Argument.Extent.Text.Trim("'", '"') }
            if ($i + 1 -lt $els.Count) { return $els[$i + 1].Extent.Text.Trim("'", '"') }
        }
    }
}
$provisionPath = Join-Path $PSScriptRoot 'provision-bbi-intranet.ps1'
$provisionAst = [System.Management.Automation.Language.Parser]::ParseFile($provisionPath, [ref]$null, [ref]$null)
$calls = @($provisionAst.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true))
$lists = @{}
foreach ($c in @($calls | Where-Object { $_.GetCommandName() -eq 'Ensure-BbiList' })) { $lists[(Get-CmdArg $c 'Title')] = Get-CmdArg $c 'Template' }
$cols = @{}
foreach ($c in @($calls | Where-Object { $_.GetCommandName() -eq 'Ensure-BbiField' })) {
    $l = Get-CmdArg $c 'List'
    if (-not $cols.ContainsKey($l)) { $cols[$l] = @() }
    $cols[$l] += (Get-CmdArg $c 'InternalName')
}
$pages = @($calls | Where-Object { $_.GetCommandName() -eq 'Ensure-BbiPage' } | ForEach-Object { Get-CmdArg $_ 'Name' })
$provisionText = Get-Content $provisionPath -Raw -Encoding UTF8

# Élément du croquis → liste ou bibliothèque, modèle attendu, colonnes attendues
$croquis = @(
    @{ Bloc = 'Annonces';                              Liste = 'Annonces';                 Modele = 'GenericList';     Colonnes = @('Message', 'Niveau', 'DateDebut', 'DateFin') }
    @{ Bloc = 'Citation / pensée du jour';             Liste = 'Pensées du jour';          Modele = 'GenericList';     Colonnes = @('Auteur') }
    @{ Bloc = 'Anniversaires';                         Liste = 'Anniversaires';            Modele = 'GenericList';     Colonnes = @('Jour', 'Mois', 'PhotoUrl') }
    @{ Bloc = 'Trombinoscope (photo, nom, titre)';     Liste = 'Formateurs';               Modele = 'GenericList';     Colonnes = @('PhotoUrl', 'Role', 'Email') }
    @{ Bloc = 'Documents administratifs';              Liste = 'Documents administratifs'; Modele = 'DocumentLibrary'; Colonnes = @('Categorie', 'Public') }
    @{ Bloc = 'Documents pédagogiques';                Liste = 'Supports publiés';         Modele = 'DocumentLibrary'; Colonnes = @('TypeSupport', 'StatutSupport') }
    @{ Bloc = 'Nos plannings (calendrier)';            Liste = 'Sessions';                 Modele = 'GenericList';     Colonnes = @('StartDate', 'EndDate', 'Location') }
    @{ Bloc = 'Parcours (offres)';                     Liste = 'Offres';                   Modele = 'GenericList';     Colonnes = @('Pole', 'Duree', 'Livrables') }
    @{ Bloc = 'Références pédagogiques';               Liste = 'Références pédagogiques';  Modele = 'GenericList';     Colonnes = @('Categorie', 'Auteur', 'LienUrl') }
    @{ Bloc = 'Siège et filiales (tuiles)';            Liste = 'Implantations';            Modele = 'GenericList';     Colonnes = @('EstSiege', 'SiteUrl', 'Couleur', 'Initiales') }
    @{ Bloc = 'Nos références (nom, logo, lien, contact, pays, ville)'; Liste = 'Nos références'; Modele = 'GenericList'; Colonnes = @('LogoUrl', 'SiteWebUrl', 'Contact', 'Pays', 'Ville') }
    @{ Bloc = 'Avis de satisfaction (formulaire après chaque séance)'; Liste = 'Avis clients'; Modele = 'GenericList'; Colonnes = @('Pole', 'NoteGlobale', 'Recommandation', 'PointsForts', 'Ameliorations', 'Commentaire', 'DateSeance') }
    @{ Bloc = 'Galerie photos';                        Liste = 'Galerie médias';           Modele = 'PictureLibrary';  Colonnes = @('Album') }
)
foreach ($e in $croquis) {
    $exists = $lists.ContainsKey($e.Liste)
    $kindOk = $exists -and $lists[$e.Liste] -eq $e.Modele
    $missingCols = @($e.Colonnes | Where-Object { -not ($cols.ContainsKey($e.Liste) -and $cols[$e.Liste] -contains $_) })
    Check "$($e.Bloc) : $($e.Modele) « $($e.Liste) » créé avec ses colonnes" ($kindOk -and $missingCols.Count -eq 0) "existe=$exists modèle=$($lists[$e.Liste]) colonnes manquantes=$($missingCols -join ',')"
}
Check "suivi de l'envoi du formulaire sur chaque séance (lien et case « envoyé »)" (($cols['Sessions'] -contains 'LienSatisfaction') -and ($cols['Sessions'] -contains 'SatisfactionEnvoyee'))
Check "liens Avis clients et formulaire de satisfaction dans les accès directs" (($provisionText -match 'Avis clients \| Notes et recommandations') -and ($provisionText -match 'satisfactionFormUrl'))
Check "page d'accueil accueil.aspx créée" ($pages -contains 'accueil')
Check "contact support (courriel en haut à droite) transmis à la web part" ($provisionText -match 'supportEmail')
Check "lien « Références pédagogiques » dans les accès directs" ($provisionText -match 'Références pédagogiques \| [^|]+ \| #formations')
Check "bibliothèques et listes branchées sur la web part (propriétés de titre)" (($provisionText -match "adminDocumentsLibraryTitle\s*=\s*'Documents administratifs'") -and ($provisionText -match "pedagogicalReferencesListTitle\s*=\s*'Références pédagogiques'") -and ($provisionText -match "clientReferencesListTitle\s*=\s*'Nos références'") -and ($provisionText -match "officesListTitle\s*=\s*'Implantations'"))

# --- Démonstration des droits ---------------------------------------------
Write-Host ''
Write-Host 'Démonstration des droits (plan, matrice, documents générés)'
$demoCfg = New-TestConfig
$demoPlan = Get-BbiOrganizationPlan -Config $demoCfg -BaseDirectory $PSScriptRoot
$rights = Get-BbiRightsDemoPlan -Config $demoCfg -Plan $demoPlan
$validRights = 'ViewOnly', 'Read', 'Contribute', 'Edit'
$groupKeys = @($rights.Groups | ForEach-Object Key)
function Get-Rt { param($Num, $Group) Get-BbiDocRight -Doc ($rights.Documents | Where-Object Num -eq $Num) -GroupKey $Group }
Check 'dix cas d''usage et dix lignes de matrice' (($rights.Documents.Count -eq 10) -and (@(Get-BbiRightsMatrix -RightsPlan $rights).Count -eq 10))
Check 'six groupes : concepteurs, clients, apprenants, employés, RH, direction' (($groupKeys -join ',') -eq 'concepteurs,clients,apprenants,employes,rh,direction')
Check 'noms de fichiers uniques, sans accent ni espace' ((@($rights.Documents | ForEach-Object FileName | Select-Object -Unique).Count -eq 10) -and (@($rights.Documents | Where-Object { $_.FileName -notmatch '^[A-Za-z0-9.-]+$' }).Count -eq 0))
Check 'chaque cas vise Supports publiés ou Documents administratifs' ((@($rights.Documents | Where-Object { $rights.Libraries -notcontains $_.Library }).Count -eq 0) -and (@($rights.Libraries).Count -eq 2))
$badGrants = @($rights.Documents | ForEach-Object { $d = $_; $d.Grants | Where-Object { $groupKeys -notcontains $_.Group -or $validRights -notcontains $_.Right } | ForEach-Object { "cas $($d.Num) $($_.Group)=$($_.Right)" } })
Check 'attributions : groupes connus et droits valides' ($badGrants.Count -eq 0) ($badGrants -join ', ')
Check 'cas 1 : client et apprenant en consultation seule, concepteur modifie' ((Get-Rt 1 'clients') -eq 'ViewOnly' -and (Get-Rt 1 'apprenants') -eq 'ViewOnly' -and (Get-Rt 1 'concepteurs') -eq 'Edit')
Check 'cas 2 : lecture et téléchargement pour l''apprenant' ((Get-Rt 2 'apprenants') -eq 'Read')
Check 'cas 3 et 5 : clients et apprenants ne voient pas' (((Get-Rt 3 'clients'), (Get-Rt 3 'apprenants'), (Get-Rt 5 'clients'), (Get-Rt 5 'apprenants') | Select-Object -Unique) -eq 'None')
Check 'cas 4 : réservé au groupe client, apprenant exclu' ((Get-Rt 4 'clients') -eq 'ViewOnly' -and (Get-Rt 4 'apprenants') -eq 'None')
Check 'cas 6 : tous les employés lisent, RH et direction modifient' ((Get-Rt 6 'employes') -eq 'Read' -and (Get-Rt 6 'rh') -eq 'Edit' -and (Get-Rt 6 'direction') -eq 'Edit')
Check 'cas 7 : confidentiel RH, direction en lecture, employés exclus' ((Get-Rt 7 'rh') -eq 'Edit' -and (Get-Rt 7 'direction') -eq 'Read' -and (Get-Rt 7 'employes') -eq 'None')
Check 'cas 8 : employés en consultation seule' ((Get-Rt 8 'employes') -eq 'ViewOnly')
Check 'cas 9 : seule la direction voit la note' ((Get-Rt 9 'direction') -eq 'Edit' -and (Get-Rt 9 'rh') -eq 'None' -and (Get-Rt 9 'employes') -eq 'None')
Check 'cas 10 : tous les employés peuvent contribuer' ((Get-Rt 10 'employes') -eq 'Contribute')
$allRights = @($rights.Documents | ForEach-Object { $d = $_; $groupKeys | ForEach-Object { Get-BbiDocRight -Doc $d -GroupKey $_ } } | Select-Object -Unique)
Check 'toutes les nuances sont montrées : voir seulement, lire, contribuer, modifier, aucun accès' ((@('ViewOnly', 'Read', 'Contribute', 'Edit', 'None') | Where-Object { $allRights -notcontains $_ }).Count -eq 0)
Check 'aucune attribution du contrôle total (réservé aux propriétaires du site)' (@($rights.Documents | ForEach-Object Grants | Where-Object { $_.Right -eq 'FullControl' }).Count -eq 0)
$demoTmp = Join-Path ([IO.Path]::GetTempPath()) ('bbi-demo-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $demoTmp | Out-Null
try {
    $badFiles = @()
    foreach ($d in $rights.Documents) {
        $p = New-BbiDemoFile -Doc $d -RightsPlan $rights -Directory $demoTmp
        $r = if ($d.Kind -eq 'pdf') { Test-BbiPdfStructure -Path $p } else { Test-BbiDocxStructure -Path $p -ExpectedText 'Ce que chaque compte doit constater' }
        if ($r -ne 'OK') { $badFiles += "cas $($d.Num) : $r" }
    }
    Check 'dix fichiers générés et valides (Word : archive et XML ; PDF : structure)' ($badFiles.Count -eq 0) ($badFiles -join ' | ')
    $docx1 = New-BbiDemoFile -Doc ($rights.Documents | Where-Object Num -eq 1) -RightsPlan $rights -Directory $demoTmp
    Check 'document du cas 1 : le texte dit « Voir seulement » pour le client' ((Test-BbiDocxStructure -Path $docx1 -ExpectedText 'Client externe : Voir seulement') -eq 'OK')
    Check 'des documents Word et des PDF' ((@($rights.Documents | Where-Object Kind -eq 'pdf').Count -ge 2) -and (@($rights.Documents | Where-Object Kind -eq 'docx').Count -ge 5))
} finally { Remove-Item -LiteralPath $demoTmp -Recurse -Force -ErrorAction SilentlyContinue }
$c = New-TestConfig; $c.demonstration.comptes.clients = @('pas-un-mail')
Check 'compte de démonstration invalide refusé' (Has-Error $c 'demonstration.comptes.clients')
$c = New-TestConfig; $c.demonstration.comptes.clients = @('client@exemple.com'); $c.demonstration.comptes.rh = @('rh@exemple.com')
Check 'comptes de démonstration valides acceptés' ((Get-Errors $c).Count -eq 0)
$demoCfg2 = New-TestConfig; $demoCfg2.demonstration.comptes.direction = @('dg@exemple.com')
$rights2 = Get-BbiRightsDemoPlan -Config $demoCfg2 -Plan $demoPlan
Check 'les comptes de la configuration arrivent dans le bon groupe' ((@($rights2.Groups | Where-Object Key -eq 'direction')[0].Members -contains 'dg@exemple.com') -and (@($rights2.Groups | Where-Object Key -eq 'clients')[0].Members.Count -eq 0))
Check 'démonstration des droits activée dans l''exemple fourni' ($demoPlan.DemonstrationDroits -eq $true)

Write-Host ""
Write-Host "Résultat : $($script:passed) vérification(s) réussie(s), $($script:failed) échec(s)." -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $(if ($script:failed -eq 0) { 0 } else { 1 })
