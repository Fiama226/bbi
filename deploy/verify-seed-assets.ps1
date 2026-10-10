#Requires -Version 7.0
<#
.SYNOPSIS
    Test hors ligne de BbiSeedAssets.ps1 : plan, fichiers sur disque, cohérence avec le code du portail
    et avec le provisionnement, puis exécution contre un SharePoint simulé (aucune connexion).

.EXAMPLE
    pwsh -File deploy/verify-seed-assets.ps1      # sortie 0 si tout passe, 1 sinon
#>
$ErrorActionPreference = 'Stop'
$script:passed = 0; $script:failed = 0
function Check {
    param([string]$Label, [bool]$Condition, [string]$Detail = '')
    if ($Condition) { $script:passed++; Write-Host "  ✓ $Label" -ForegroundColor Green }
    else { $script:failed++; Write-Host "  ✗ $Label$(if ($Detail) { " — $Detail" })" -ForegroundColor Red }
}

. (Join-Path $PSScriptRoot 'BbiRightsDemo.ps1')
. (Join-Path $PSScriptRoot 'BbiSeedAssets.ps1')

$repo = Split-Path $PSScriptRoot -Parent
$assets = Join-Path $PSScriptRoot 'assets-demo'
$provision = Get-Content (Join-Path $PSScriptRoot 'provision-bbi-intranet.ps1') -Raw -Encoding UTF8
$homeData = Get-Content (Join-Path $repo 'bbi-intranet/src/webparts/bbiHome/components/homeData.ts') -Raw -Encoding UTF8
$galleryData = Get-Content (Join-Path $repo 'bbi-intranet/src/webparts/bbiGallery/components/galleryData.ts') -Raw -Encoding UTF8
$abbrev = '\bBBI\b'

Write-Host "Plan" -ForegroundColor White
$plan = Get-BbiSeedAssetPlan -AssetsDirectory $assets
Check 'le plan contient des téléversements' ($plan.Uploads.Count -ge 30) "$($plan.Uploads.Count)"
Check 'clés de téléversement uniques' (@($plan.Uploads | Select-Object -ExpandProperty Key -Unique).Count -eq $plan.Uploads.Count)
$missing = @($plan.Uploads | Where-Object { -not (Test-Path -LiteralPath $_.LocalPath) })
Check 'tous les fichiers du plan existent sur disque' ($missing.Count -eq 0) (($missing | ForEach-Object FileName) -join ', ')
$sizes = @($plan.Uploads | Where-Object { Test-Path -LiteralPath $_.LocalPath } | ForEach-Object { (Get-Item -LiteralPath $_.LocalPath).Length })
Check 'aucun fichier vide' (@($sizes | Where-Object { $_ -le 0 }).Count -eq 0)
Check 'taille totale du plan < 4 Mo' (($sizes | Measure-Object -Sum).Sum -lt 4MB) ("{0:N0} Ko" -f (($sizes | Measure-Object -Sum).Sum / 1KB))
Check 'images : jpg et png plus lourdes que 3 Ko' (@($plan.Uploads | Where-Object { $_.FileName -match '\.(jpg|png)$' -and (Test-Path -LiteralPath $_.LocalPath) -and (Get-Item -LiteralPath $_.LocalPath).Length -lt 3KB }).Count -eq 0)
Check 'noms de fichiers sans accent ni espace ni apostrophe' (@($plan.Uploads | Where-Object { $_.FileName -notmatch '^[a-z0-9\-\.]+$' }).Count -eq 0)

# Dimensions (System.Drawing absent sur un poste non Windows : contrôle facultatif)
try {
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop
    $expect = @{ 'news:' = '1200x675'; 'gallery:' = '1200x800'; 'trainer:' = '400x400'; 'ref:' = '400x200'; 'banner:' = '1600x600'; 'employee:' = '400x400' }
    $bad = @()
    foreach ($u in $plan.Uploads) {
        $prefix = ($expect.Keys | Where-Object { $u.Key.StartsWith($_) } | Select-Object -First 1)
        if (-not $prefix) { continue }
        $img = [System.Drawing.Image]::FromFile($u.LocalPath)
        if ("$($img.Width)x$($img.Height)" -ne $expect[$prefix]) { $bad += "$($u.FileName) $($img.Width)x$($img.Height)" }
        $img.Dispose()
    }
    Check 'dimensions des images conformes' ($bad.Count -eq 0) ($bad -join '; ')
} catch { Write-Host "  - dimensions non contrôlées (System.Drawing indisponible)" -ForegroundColor Yellow }

# Nom de l'entreprise : jamais « BBI » dans ce que voit l'utilisateur
$visible = New-Object System.Collections.Generic.List[string]
foreach ($u in $plan.Uploads) { $visible.Add($u.FileName); foreach ($v in $u.Values.Values) { $visible.Add("$v") } }
$bbi = @($visible | Where-Object { $_ -cmatch $abbrev })
Check "aucune abréviation « BBI » dans les noms de fichiers et métadonnées" ($bbi.Count -eq 0) ($bbi -join ' | ')
Check 'le texte du générateur ne contient pas « BBI »' ((Get-Content (Join-Path $assets 'New-DemoImages.ps1') -Raw -Encoding UTF8) -cnotmatch 'BBI')
$slides = Get-BbiSeedHeroSlidesText -Plan $plan -SiteUrl 'https://exemple.sharepoint.com/sites/intranet'
Check 'diaporama : aucune abréviation « BBI »' ($slides -cnotmatch 'BBI')
Check 'diaporama : trois lignes avec visuel du dossier bandeaux' (@($slides -split "`n" | Where-Object { $_ -match '^/sites/intranet/SiteAssets/demo/bandeaux/[a-z\-]+\.jpg \|' }).Count -eq 3)
Check 'diaporama : nom complet de l''entreprise' ($slides -match 'Business Builders International')

# Contenu des documents générés
$docIssues = @()
foreach ($u in ($plan.Uploads | Where-Object { $_.FileName -match '\.(pdf|docx)$' })) {
    if (-not (Test-Path -LiteralPath $u.LocalPath)) { continue }
    $r = if ($u.FileName -like '*.pdf') { Test-BbiPdfStructure -Path $u.LocalPath } else { Test-BbiDocxStructure -Path $u.LocalPath -ExpectedText 'Business Builders International' }
    if ($r -ne 'OK') { $docIssues += "$($u.FileName): $r" }
    $text = if ($u.FileName -like '*.pdf') { [System.Text.Encoding]::GetEncoding(28591).GetString([IO.File]::ReadAllBytes($u.LocalPath)) }
    else {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $z = [System.IO.Compression.ZipFile]::OpenRead($u.LocalPath); $rd = New-Object IO.StreamReader($z.GetEntry('word/document.xml').Open(), [Text.Encoding]::UTF8); $t = $rd.ReadToEnd(); $rd.Dispose(); $z.Dispose(); $t
    }
    if ($text -cmatch 'BBI') { $docIssues += "$($u.FileName): contient « BBI »" }
    if ($text -notmatch 'Business Builders International') { $docIssues += "$($u.FileName): nom complet absent" }
}
Check 'six documents valides, nom complet, sans « BBI »' ($docIssues.Count -eq 0 -and @($plan.Uploads | Where-Object { $_.FileName -match '\.(pdf|docx)$' }).Count -eq 6) ($docIssues -join '; ')

Write-Host "Cohérence avec le code du portail et le provisionnement" -ForegroundColor White
foreach ($c in $plan.Columns) {
    Check "colonne $($c.List)/$($c.Field) lue par homeData.ts" ($homeData -match "'$($c.Field)'")
    Check "colonne $($c.List)/$($c.Field) créée par le provisionnement" ($provision -match [regex]::Escape("-List '$($c.List)'") + '.*-InternalName ''' + [regex]::Escape($c.Field) + '''.*-Type Hyperlink')
    foreach ($k in $c.Match.Keys) { Check "titre « $k » semé par le provisionnement ($($c.List))" ($provision.Contains("Title = '$k'") -or $provision.Contains("Title = `"$k`"") -or $provision.Contains("Title      = '$k'")) }
    foreach ($key in (@($c.Match.Values) + @($c.Pool))) { Check "clé $key présente dans le plan" (@($plan.Uploads | Where-Object Key -eq $key).Count -eq 1) }
}
foreach ($f in $plan.RequiredFields) {
    Check "colonne requise $($f.List)/$($f.Field) ($($f.Type)) créée par le provisionnement" ($provision -match [regex]::Escape("-List '$($f.List)'") + '.*-InternalName ''' + [regex]::Escape($f.Field) + '''.*-Type ' + $f.Type)
}
foreach ($f in 'Album', 'Lieu', 'Credit', 'DatePhoto') { Check "galleryData.ts connaît la colonne $f" ($galleryData -match "'$f'") }
foreach ($lib in ($plan.Uploads | Where-Object Target -eq 'Library' | Select-Object -ExpandProperty Library -Unique)) { Check "bibliothèque « $lib » créée par le provisionnement" ($provision.Contains("Ensure-BbiList -Title '$lib'")) }
foreach ($u in ($plan.Uploads | Where-Object { $_.Values.ContainsKey('Album') })) { Check "album « $($u.Values.Album) » = choix du provisionnement" ($provision -match "Choices @\([^)]*'$($u.Values.Album)'") }
foreach ($pair in @(@('TypeSupport', 'Supports publiés'), @('StatutSupport', 'Supports publiés'), @('Categorie', 'Documents administratifs'), @('Public', 'Documents administratifs'))) {
    foreach ($u in ($plan.Uploads | Where-Object { $_.Library -eq $pair[1] -and $_.Values.ContainsKey($pair[0]) })) {
        Check "$($pair[0]) = « $($u.Values[$pair[0]]) » est un choix valide ($($u.FileName))" ($provision -match [regex]::Escape("-InternalName '$($pair[0])'") + "[^\r\n]*\r?\n\s*-Choices @\([^)]*'" + [regex]::Escape($u.Values[$pair[0]]) + "'")
    }
}

# ------------------------------------------------------------------
# SharePoint simulé
# ------------------------------------------------------------------
$global:M = $null
function global:Reset-M {
    param([switch]$NoGallery)
    $global:M = @{ Files = @{}; Folders = [System.Collections.Generic.List[string]]::new(); Lists = @{}; Fields = @{}; Calls = [System.Collections.Generic.List[string]]::new(); Next = 1 }
    foreach ($n in 'Actualites', 'Formateurs', 'Employés du mois', 'Nos références') { $global:M.Lists[$n] = [System.Collections.Generic.List[object]]::new() }
    foreach ($n in 'Supports publiés', 'Documents administratifs') { $global:M.Lists[$n] = [System.Collections.Generic.List[object]]::new() }
    if (-not $NoGallery) { $global:M.Lists['Galerie médias'] = [System.Collections.Generic.List[object]]::new() }
    foreach ($c in $plan.RequiredFields) { $global:M.Fields["$($c.List)|$($c.Field)"] = $true }
}
function global:Add-MockItem { param([string]$List, [string]$Title, $Url = $null, [string]$Field) $it = [pscustomobject]@{ Id = $global:M.Next++; FieldValues = @{ Title = $Title } }; if ($Url) { $it.FieldValues[$Field] = [pscustomobject]@{ Url = $Url; Description = 'editeur' } }; $global:M.Lists[$List].Add($it); $it }
function global:Get-PnPList { [CmdletBinding()] param([string]$Identity, [string]$Includes) if (-not $global:M.Lists.ContainsKey($Identity)) { throw "liste absente : $Identity" }; [pscustomobject]@{ Title = $Identity; RootFolder = [pscustomobject]@{ ServerRelativeUrl = "/sites/intranet/$Identity" } } }
function global:Get-PnPField { [CmdletBinding()] param([string]$List, [string]$Identity) if ($global:M.Fields.ContainsKey("$List|$Identity")) { [pscustomobject]@{ InternalName = $Identity } } else { throw 'champ absent' } }
function global:Get-PnPFile { [CmdletBinding()] param([string]$Url) if ($global:M.Files.ContainsKey($Url)) { [pscustomobject]@{ ServerRelativeUrl = $Url } } else { throw 'fichier absent' } }
function global:Resolve-PnPFolder { [CmdletBinding()] param([string]$SiteRelativePath) $global:M.Folders.Add($SiteRelativePath); [pscustomobject]@{ Name = $SiteRelativePath } }
function global:Add-PnPFile { [CmdletBinding()] param([string]$Path, [string]$Folder, [hashtable]$Values) $url = "/sites/intranet/$Folder/$([IO.Path]::GetFileName($Path))"; $global:M.Files[$url] = @{ Size = (Get-Item $Path).Length; Values = $Values }; $global:M.Calls.Add("add $url") }
function global:Get-PnPListItem { [CmdletBinding()] param([string]$List, [int]$PageSize) if (-not $global:M.Lists.ContainsKey($List)) { throw 'liste absente' }; $global:M.Lists[$List].ToArray() }
function global:Set-PnPListItem { [CmdletBinding()] param([string]$List, [int]$Identity, [hashtable]$Values) $it = $global:M.Lists[$List] | Where-Object Id -eq $Identity; foreach ($k in $Values.Keys) { $parts = "$($Values[$k])" -split ', ', 2; $it.FieldValues[$k] = [pscustomobject]@{ Url = $parts[0]; Description = $parts[1] } }; $global:M.Calls.Add("set $List#$Identity") }

$site = 'https://exemple.sharepoint.com/sites/intranet'
Write-Host "Exécution simulée" -ForegroundColor White
Reset-M
$kept = Add-MockItem 'Actualites' 'Actualité rédigée par un éditeur' 'https://exemple.sharepoint.com/sites/intranet/SiteAssets/photo-editeur.jpg' 'ImageUrl'
foreach ($t in '13 nouveaux formateurs certifiés', 'Le catalogue des formations évolue', 'Retour sur les ateliers de rentrée', 'Une quatrième actualité') { [void](Add-MockItem 'Actualites' $t) }
foreach ($t in 'Amélie Martin', 'Khadija Diallo', 'Quelqu''un d''autre') { [void](Add-MockItem 'Formateurs' $t) }
[void](Add-MockItem 'Employés du mois' 'Léa Marchand')
foreach ($t in 'Groupe Atlantide', 'Orbis Industries', 'Sahel Energies') { [void](Add-MockItem 'Nos références' $t) }

$r = Invoke-BbiSeedAssets -Plan $plan -SiteUrl $site -DryRun
Check 'simulation (-DryRun) : aucun fichier déposé ni colonne modifiée' ($global:M.Calls.Count -eq 0 -and $r.Uploaded.Count -eq $plan.Uploads.Count)

$r = Invoke-BbiSeedAssets -Plan $plan -SiteUrl $site
Check 'première passe : tous les fichiers déposés' ($r.Uploaded.Count -eq $plan.Uploads.Count -and $global:M.Files.Count -eq $plan.Uploads.Count) "$($r.Uploaded.Count)/$($plan.Uploads.Count) ; avertissements : $($r.Warnings -join ' | ')"
Check 'aucun avertissement' ($r.Warnings.Count -eq 0) ($r.Warnings -join ' | ')
Check 'actualités : titre connu -> image prévue' ($global:M.Lists['Actualites'][1].FieldValues['ImageUrl'].Url -eq "https://exemple.sharepoint.com/sites/intranet/SiteAssets/demo/news/news-01-formateurs-certifies.jpg")
Check 'actualités : ligne sans correspondance -> image du lot restant' ($global:M.Lists['Actualites'][4].FieldValues['ImageUrl'].Url -match '/SiteAssets/demo/news/news-0[4-8]')
Check 'actualités : image de l''éditeur NON écrasée' ($kept.FieldValues['ImageUrl'].Description -eq 'editeur' -and $kept.FieldValues['ImageUrl'].Url -like '*photo-editeur.jpg')
Check 'formateur Amélie Martin : portrait' ($global:M.Lists['Formateurs'][0].FieldValues['PhotoUrl'].Url -like '*/demo/formateurs/formateur-amelie-martin.png')
Check 'formateur inconnu : laissé vide (pas de portrait au hasard)' (-not $global:M.Lists['Formateurs'][2].FieldValues.ContainsKey('PhotoUrl'))
Check 'employé du mois : portrait' ($global:M.Lists['Employés du mois'][0].FieldValues['PhotoUrl'].Url -like '*/demo/employes/*')
Check 'références : trois logos' (@($global:M.Lists['Nos références'] | Where-Object { $_.FieldValues['LogoUrl'].Url -like '*/demo/references/client-*.png' }).Count -eq 3)
$galFile = $global:M.Files.GetEnumerator() | Where-Object { $_.Key -like '*/Galerie médias/galerie-02*' } | Select-Object -First 1
Check 'galerie : fichier déposé dans la bibliothèque avec Album, Lieu, Credit, DatePhoto' ($galFile -and $galFile.Value.Values.Album -eq 'Événements' -and $galFile.Value.Values.Lieu -eq 'Dakar' -and $galFile.Value.Values.Credit -match 'Business Builders International' -and $galFile.Value.Values.DatePhoto -is [datetime] -and -not $galFile.Value.Values.ContainsKey('_DatePhotoDaysAgo'))
$supFile = $global:M.Files.GetEnumerator() | Where-Object { $_.Key -like '*/Supports publiés/support-management-equipe.pdf' } | Select-Object -First 1
Check 'support : déposé avec TypeSupport et StatutSupport = Publié' ($supFile -and $supFile.Value.Values.StatutSupport -eq 'Publié' -and $supFile.Value.Values.TypeSupport)
Check 'dossier des images créé' ($global:M.Folders -contains 'SiteAssets/demo/news')

$callsBefore = $global:M.Calls.Count
$r2 = Invoke-BbiSeedAssets -Plan $plan -SiteUrl $site
Check 'seconde passe idempotente : rien déposé, rien modifié' ($r2.Uploaded.Count -eq 0 -and $r2.Skipped.Count -eq $plan.Uploads.Count -and $r2.ColumnsFilled.Count -eq 0 -and $global:M.Calls.Count -eq $callsBefore)

# Données de l'éditeur sur une liste « photos » : jamais touchées, même au premier passage
Reset-M
$only = Add-MockItem 'Formateurs' 'Amélie Martin' 'https://exemple.sharepoint.com/vraie-photo.png' 'PhotoUrl'
[void](Invoke-BbiSeedAssets -Plan $plan -SiteUrl $site)
Check 'vraie photo de formateur conservée' ($only.FieldValues['PhotoUrl'].Url -eq 'https://exemple.sharepoint.com/vraie-photo.png')

# Bibliothèque et colonne absentes : avertissements, pas d'exception
Reset-M -NoGallery
$global:M.Fields.Remove('Formateurs|PhotoUrl')
$threw = $false; $r3 = $null
try { $r3 = Invoke-BbiSeedAssets -Plan $plan -SiteUrl $site } catch { $threw = $true }
Check 'bibliothèque ou colonne absente : pas d''exception' (-not $threw)
Check 'bibliothèque absente signalée' ($r3 -and @($r3.Warnings | Where-Object { $_ -match 'Galerie médias' }).Count -ge 1)
Check 'colonne absente signalée' ($r3 -and @($r3.Warnings | Where-Object { $_ -match 'Formateurs/PhotoUrl' }).Count -ge 1)
Check 'les autres dépôts continuent' ($r3 -and $r3.Uploaded.Count -gt 20)

# Fichier source manquant
Reset-M
$broken = [pscustomobject]@{ Uploads = @($plan.Uploads[0] | Select-Object *); Columns = @(); RequiredFields = @(); HeroBanners = @() }
$broken.Uploads[0].LocalPath = Join-Path $assets 'inexistant.jpg'
$r4 = Invoke-BbiSeedAssets -Plan $broken -SiteUrl $site
Check 'fichier source absent : signalé, rien déposé' ($r4.Missing.Count -eq 1 -and $global:M.Files.Count -eq 0)

Write-Host ""
Write-Host "$script:passed contrôle(s) réussi(s), $script:failed échec(s)." -ForegroundColor $(if ($script:failed -eq 0) { 'Green' } else { 'Red' })
exit $(if ($script:failed -eq 0) { 0 } else { 1 })
