<#
.SYNOPSIS
    Images et documents de démonstration : plan (quel fichier va où, quelle colonne reçoit quelle URL)
    et téléversement idempotent dans un site SharePoint.

.DESCRIPTION
    Ce fichier n'est pas exécuté seul : il se charge avec « . .\BbiSeedAssets.ps1 ».
    Aucune fonction ne s'exécute au chargement.

      Get-BbiSeedAssetPlan      pur, sans SharePoint : le plan de téléversement et de remplissage
      Get-BbiSeedHeroSlidesText pur : le texte de la propriété « heroSlides » avec les bandeaux téléversés
      Invoke-BbiSeedAssets      applique le plan (connexion PnP déjà ouverte sur le site cible)

    Règles :
      - un fichier déjà présent n'est jamais renvoyé (idempotent) ;
      - une colonne image n'est remplie QUE si elle est vide : on n'écrase jamais le travail d'un éditeur ;
      - une liste ou une colonne absente est signalée, jamais créée ici (le script de provisionnement s'en charge) ;
      - le nom de l'entreprise est toujours écrit en entier : « Business Builders International ».

    Les fichiers eux-mêmes sont produits une fois pour toutes par assets-demo/New-DemoImages.ps1
    et versionnés : le déploiement n'a donc besoin ni de System.Drawing ni d'Internet.
#>

$script:BbiCompany = 'Business Builders International'

function Get-BbiSeedAssetPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$AssetsDirectory)

    $uploads = New-Object System.Collections.Generic.List[object]
    function Add-Up {
        param([string]$Key, [string]$Sub, [string]$File, [string]$Target, [string]$Library = '', [string]$Folder = '', [hashtable]$Values = @{})
        $uploads.Add([pscustomobject]@{
                Key = $Key; LocalPath = (Join-Path (Join-Path $AssetsDirectory $Sub) $File); FileName = $File
                Target = $Target                      # 'SiteAssets' (dossier de la bibliothèque des ressources du site) ou 'Library'
                Library = $Library                    # titre de la bibliothèque (Target = Library)
                Folder = $Folder                      # chemin relatif au site (Target = SiteAssets)
                Values = $Values
            })
    }

    # --- Actualités : liste Actualites, colonne ImageUrl (Hyperlink)
    $news = @(
        @('news-01-formateurs-certifies.jpg', '13 nouveaux formateurs certifiés'),
        @('news-02-catalogue-evolue.jpg', 'Le catalogue des formations évolue'),
        @('news-03-ateliers-de-rentree.jpg', 'Retour sur les ateliers de rentrée'),
        @('news-04-audit-qualiopi.jpg', ''), @('news-05-pole-coaching.jpg', ''), @('news-06-antenne-dakar.jpg', ''),
        @('news-07-webinaire-changement.jpg', ''), @('news-08-prix-pedagogie.jpg', ''))
    $newsMatch = @{}; $newsPool = @()
    foreach ($n in $news) {
        $key = "news:$($n[0])"; Add-Up $key 'news' $n[0] 'SiteAssets' -Folder 'SiteAssets/demo/news'
        $newsPool += $key; if ($n[1]) { $newsMatch[$n[1]] = $key }
    }

    # --- Formateurs : colonne PhotoUrl (Hyperlink). Noms = seed de provision-bbi-intranet.ps1.
    $trainers = [ordered]@{
        'Amélie Martin' = 'formateur-amelie-martin.png'; 'Stéphane Laurent' = 'formateur-stephane-laurent.png'
        'Khadija Diallo' = 'formateur-khadija-diallo.png'; 'Thomas Bernard' = 'formateur-thomas-bernard.png'
        'Marie-Claire Ngoma' = 'formateur-marie-claire-ngoma.png'; 'Youssef El Amrani' = 'formateur-youssef-el-amrani.png'
        'Claire Fontaine' = 'formateur-claire-fontaine.png'; 'Jean-Marc Okafor' = 'formateur-jean-marc-okafor.png' }
    $trainerMatch = @{}
    foreach ($name in $trainers.Keys) {
        $key = "trainer:$($trainers[$name])"; Add-Up $key 'trainers' $trainers[$name] 'SiteAssets' -Folder 'SiteAssets/demo/formateurs'
        $trainerMatch[$name] = $key
    }

    # --- Employé du mois : colonne PhotoUrl (Hyperlink)
    Add-Up 'employee:lea' 'employee' 'employe-du-mois-lea-marchand.png' 'SiteAssets' -Folder 'SiteAssets/demo/employes'

    # --- Nos références : colonne LogoUrl (Hyperlink)
    $refs = [ordered]@{ 'Groupe Atlantide' = 'client-groupe-atlantide.png'; 'Orbis Industries' = 'client-orbis-industries.png'; 'Sahel Energies' = 'client-sahel-energies.png' }
    $refMatch = @{}
    foreach ($name in $refs.Keys) {
        $key = "ref:$($refs[$name])"; Add-Up $key 'references' $refs[$name] 'SiteAssets' -Folder 'SiteAssets/demo/references'
        $refMatch[$name] = $key
    }

    # --- Bandeaux du héros : propriété web part « heroSlides » (pas une liste)
    $banners = @('bandeau-offres.jpg', 'bandeau-methode.jpg', 'bandeau-reseau.jpg')
    foreach ($b in $banners) { Add-Up "banner:$b" 'banners' $b 'SiteAssets' -Folder 'SiteAssets/demo/bandeaux' }

    # --- Galerie médias : bibliothèque d'images, colonnes Title, Album (Choice), Lieu, Credit, DatePhoto.
    #     Mêmes lignes que galleryData.ts (sans l'abréviation de l'entreprise). Album : valeurs du Choice du provisionnement.
    $co = $script:BbiCompany
    $gallery = @(
        @('galerie-01-atelier-prise-de-parole.jpg', 'Atelier « Prise de parole en public » — Paris', 'Sessions de formation', 'Paris', "Communication $co", 6),
        @('galerie-02-seminaire-formateurs-dakar.jpg', 'Séminaire annuel des formateurs — Dakar', 'Événements', 'Dakar', "Équipe $co", 14),
        @('galerie-03-remise-attestations.jpg', 'Remise des attestations — promotion de septembre', 'Certifications', 'Paris', 'Direction pédagogique', 22),
        @('galerie-04-tournage-module-elearning.jpg', 'Tournage du module e-learning — plateau', 'Coulisses', 'Studio', "Communication $co", 31),
        @('galerie-05-coaching-entrepreneurs-promo-12.jpg', "Coaching d'entrepreneurs — promotion 12", 'Sessions de formation', 'Lyon', "Équipe $co", 44),
        @('galerie-06-atelier-ideation-catalogue.jpg', "Atelier d'idéation : refonte du catalogue", 'Événements', 'Abidjan', 'Direction pédagogique', 58),
        @('galerie-07-audit-blanc-qualiopi.jpg', 'Qualiopi : audit blanc réussi', 'Certifications', 'Paris', 'Qualité', 72),
        @('galerie-08-coulisses-traiter-objections.jpg', 'Coulisses du module « Traiter les objections »', 'Coulisses', 'Studio', "Communication $co", 88),
        @('galerie-09-table-ronde-talents.jpg', 'Table ronde « Recruter et fidéliser ses talents »', 'Événements', 'Paris', "Communication $co", 96),
        @('galerie-10-management-cohorte-7.jpg', "Management d'équipe — cohorte 7, module 2", 'Sessions de formation', 'Paris', "Équipe $co", 104),
        @('galerie-11-immersion-terrain-formateurs.jpg', 'Formation des formateurs — immersion terrain', 'Certifications', 'Lyon', 'Direction pédagogique', 118),
        @('galerie-12-afterwork-reseau-abidjan.jpg', 'Afterwork réseau — antenne Abidjan', 'Événements', 'Abidjan', "Équipe $co", 132))
    foreach ($g in $gallery) {
        Add-Up "gallery:$($g[0])" 'gallery' $g[0] 'Library' -Library 'Galerie médias' -Values @{ Title = $g[1]; Album = $g[2]; Lieu = $g[3]; Credit = $g[4]; _DatePhotoDaysAgo = $g[5] }
    }

    # --- Supports publiés : TypeSupport (Choice), StatutSupport (Choice), DateValidite
    Add-Up 'support:management' 'documents\supports' 'support-management-equipe.pdf' 'Library' -Library 'Supports publiés' -Values @{ Title = "Support de cours : Management d'équipe"; TypeSupport = 'Manuel participant'; StatutSupport = 'Publié'; FormateurAuteur = 'Amélie Martin' }
    Add-Up 'support:valeur' 'documents\supports' 'support-vendre-la-valeur.pdf' 'Library' -Library 'Supports publiés' -Values @{ Title = 'Support de cours : Vendre la valeur, pas le prix'; TypeSupport = 'Slides animateur'; StatutSupport = 'Publié'; FormateurAuteur = 'Khadija Diallo' }
    Add-Up 'support:coaching' 'documents\supports' 'guide-participant-coaching-entrepreneurs.docx' 'Library' -Library 'Supports publiés' -Values @{ Title = "Guide du participant : Coaching d'entrepreneurs"; TypeSupport = 'Exercices'; StatutSupport = 'Publié'; FormateurAuteur = 'Claire Fontaine' }

    # --- Documents administratifs : Categorie (Choice), Public (Choice), Reference
    Add-Up 'admin:reglement' 'documents\administratifs' 'reglement-interieur.pdf' 'Library' -Library 'Documents administratifs' -Values @{ Title = 'Règlement intérieur'; Categorie = 'RH'; Public = 'Tous'; Reference = 'RH-001' }
    Add-Up 'admin:qualite' 'documents\administratifs' 'procedure-qualite-formation.docx' 'Library' -Library 'Documents administratifs' -Values @{ Title = 'Procédure qualité : déroulement d''une formation'; Categorie = 'Qualité'; Public = 'Tous'; Reference = 'QUA-001' }
    Add-Up 'admin:teletravail' 'documents\administratifs' 'charte-teletravail.pdf' 'Library' -Library 'Documents administratifs' -Values @{ Title = 'Charte du télétravail'; Categorie = 'RH'; Public = 'Tous'; Reference = 'RH-002' }

    # Colonnes à remplir. Match : valeur de Title de la ligne -> fichier. Pool : fichiers pour les autres lignes, dans l'ordre.
    $columns = @(
        [pscustomobject]@{ List = 'Actualites'; Field = 'ImageUrl'; Type = 'Hyperlink'; Match = $newsMatch; Pool = $newsPool }
        [pscustomobject]@{ List = 'Formateurs'; Field = 'PhotoUrl'; Type = 'Hyperlink'; Match = $trainerMatch; Pool = @() }
        [pscustomobject]@{ List = 'Employés du mois'; Field = 'PhotoUrl'; Type = 'Hyperlink'; Match = @{ 'Léa Marchand' = 'employee:lea' }; Pool = @('employee:lea') }
        [pscustomobject]@{ List = 'Nos références'; Field = 'LogoUrl'; Type = 'Hyperlink'; Match = $refMatch; Pool = @() }
    )

    # Ce que le script de provisionnement doit avoir créé (nom interne exact, type) pour que le plan s'applique.
    $required = @(
        @{ List = 'Actualites'; Field = 'ImageUrl'; Type = 'Hyperlink' }
        @{ List = 'Formateurs'; Field = 'PhotoUrl'; Type = 'Hyperlink' }
        @{ List = 'Employés du mois'; Field = 'PhotoUrl'; Type = 'Hyperlink' }
        @{ List = 'Nos références'; Field = 'LogoUrl'; Type = 'Hyperlink' }
        @{ List = 'Galerie médias'; Field = 'Album'; Type = 'Choice' }
        @{ List = 'Galerie médias'; Field = 'Lieu'; Type = 'Text' }
        @{ List = 'Galerie médias'; Field = 'Credit'; Type = 'Text' }
        @{ List = 'Galerie médias'; Field = 'DatePhoto'; Type = 'DateTime' }
        @{ List = 'Supports publiés'; Field = 'TypeSupport'; Type = 'Choice' }
        @{ List = 'Supports publiés'; Field = 'StatutSupport'; Type = 'Choice' }
        @{ List = 'Supports publiés'; Field = 'FormateurAuteur'; Type = 'Text' }
        @{ List = 'Documents administratifs'; Field = 'Categorie'; Type = 'Choice' }
        @{ List = 'Documents administratifs'; Field = 'Public'; Type = 'Choice' }
        @{ List = 'Documents administratifs'; Field = 'Reference'; Type = 'Text' }
    )

    [pscustomobject]@{
        AssetsDirectory = $AssetsDirectory
        Uploads = $uploads.ToArray()
        Columns = $columns
        RequiredFields = $required
        HeroBanners = @($banners | ForEach-Object { "banner:$_" })
    }
}

# ------------------------------------------------------------------
# Utilitaires purs
# ------------------------------------------------------------------
function Get-BbiSiteParts {
    param([Parameter(Mandatory)][string]$SiteUrl)
    $u = [uri]$SiteUrl.TrimEnd('/')
    [pscustomobject]@{ Origin = $u.GetLeftPart([System.UriPartial]::Authority); WebPath = $u.AbsolutePath.TrimEnd('/') }
}

# Texte de la propriété « heroSlides » : une ligne par diapositive, avec le bandeau téléversé comme visuel.
function Get-BbiSeedHeroSlidesText {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Plan, [Parameter(Mandatory)][string]$SiteUrl)
    $p = Get-BbiSiteParts -SiteUrl $SiteUrl
    $img = { param($file) "$($p.WebPath)/SiteAssets/demo/bandeaux/$file" }
    $co = $script:BbiCompany
    @(
        '# Une ligne par diapositive du héros (les lignes # sont des commentaires)',
        '# image | sur-titre | titre | accroche | bouton | lien',
        "$(& $img 'bandeau-offres.jpg') | $co | Renforcer les capacités de vos équipes et de vos organisations. | Formation, conseil et coaching pour transformer vos ambitions en résultats durables. | Découvrir nos offres | #offres",
        "$(& $img 'bandeau-methode.jpg') | Notre méthode | Des accompagnements conçus pour le terrain. | Des mises en situation concrètes, des experts certifiés et un suivi à 30 jours. | Voir les sessions et missions | #sessions",
        "$(& $img 'bandeau-reseau.jpg') | Réseau international | Une même exigence de qualité, partout. | Un référentiel pédagogique unique et des antennes locales dans chaque région. | Découvrir la communauté | #communaute"
    ) -join "`n"
}

# Valeur d'une colonne Hyperlink lue dans un élément (chaîne, FieldUrlValue ou table) -> URL ou $null
function Get-BbiHyperlinkUrl {
    param($Item, [string]$Field)
    $v = $null
    try { $v = $Item.FieldValues[$Field] } catch { $v = $null }
    if ($null -eq $v) { return $null }
    if ($v -is [string]) { return $(if ($v.Trim()) { $v.Trim() } else { $null }) }
    $url = $null
    try { $url = $v.Url } catch { $url = $null }
    if (-not $url -and $v -is [System.Collections.IDictionary]) { $url = $v['Url'] }
    if ($url -and "$url".Trim()) { return "$url".Trim() }
    return $null
}

# Quel fichier pour quelle ligne : par Title, sinon prochain du Pool non utilisé par un Match.
function Get-BbiColumnAssignments {
    param([Parameter(Mandatory)]$Column, [Parameter(Mandatory)]$Items)
    $matched = @($Column.Match.Values)
    $free = @($Column.Pool | Where-Object { $matched -notcontains $_ })
    $i = 0
    foreach ($item in $Items) {
        $title = "$($item.FieldValues['Title'])"
        $key = $null
        if ($Column.Match.ContainsKey($title)) { $key = $Column.Match[$title] }
        elseif ($free.Count -gt 0) { $key = $free[$i % $free.Count]; $i++ }
        [pscustomobject]@{ Item = $item; Key = $key }
    }
}

# ------------------------------------------------------------------
# Application du plan (connexion PnP déjà ouverte sur $SiteUrl)
# ------------------------------------------------------------------
function Invoke-BbiSeedAssets {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Plan, [Parameter(Mandatory)][string]$SiteUrl, [switch]$DryRun)

    $p = Get-BbiSiteParts -SiteUrl $SiteUrl
    $result = [pscustomobject]@{ Uploaded = @(); Skipped = @(); Missing = @(); ColumnsFilled = @(); ColumnsKept = @(); Warnings = @(); HeroSlides = (Get-BbiSeedHeroSlidesText -Plan $Plan -SiteUrl $SiteUrl) }
    $urls = @{}          # clé -> URL absolue du fichier
    $folderOf = @{}      # bibliothèque -> dossier relatif au site

    # 0. Un site d'équipe neuf n'a pas encore de bibliothèque « Ressources du site » (SiteAssets) :
    #    Resolve-PnPFolder échoue alors (« ServerRelativeUrl has not been initialized »). On la crée.
    if (-not $DryRun -and @($Plan.Uploads | Where-Object { $_.Target -eq 'SiteAssets' }).Count -gt 0) {
        try {
            $ctx = Get-PnPContext
            $assetsLib = $ctx.Web.Lists.EnsureSiteAssetsLibrary()
            $ctx.Load($assetsLib)
            $ctx.ExecuteQuery()
        } catch { $result.Warnings += "Bibliothèque « Ressources du site » non créée : $($_.Exception.Message)" }
    }

    # 1. Téléversements
    foreach ($up in $Plan.Uploads) {
        if (-not (Test-Path -LiteralPath $up.LocalPath)) { $result.Missing += $up.LocalPath; $result.Warnings += "Fichier source absent : $($up.LocalPath)"; continue }
        $folder = $up.Folder
        if ($up.Target -eq 'Library') {
            if (-not $folderOf.ContainsKey($up.Library)) {
                $lst = $null
                try { $lst = Get-PnPList -Identity $up.Library -Includes RootFolder -ErrorAction Stop } catch { $lst = $null }
                if (-not $lst) { $folderOf[$up.Library] = $null; $result.Warnings += "Bibliothèque absente : $($up.Library)" }
                else {
                    $root = "$($lst.RootFolder.ServerRelativeUrl)".TrimEnd('/')
                    $folderOf[$up.Library] = $(if ($p.WebPath -and $root.StartsWith($p.WebPath, [StringComparison]::OrdinalIgnoreCase)) { $root.Substring($p.WebPath.Length).TrimStart('/') } else { $root.TrimStart('/') })
                }
            }
            $folder = $folderOf[$up.Library]
            if (-not $folder) { continue }
        }
        $serverRel = "$($p.WebPath)/$folder/$($up.FileName)"
        $urls[$up.Key] = "$($p.Origin)$serverRel"

        $exists = $null
        try { $exists = Get-PnPFile -Url $serverRel -ErrorAction Stop } catch { $exists = $null }
        if ($exists) { $result.Skipped += $serverRel; continue }
        if ($DryRun) { $result.Uploaded += $serverRel; continue }

        if ($up.Target -eq 'SiteAssets') { Resolve-PnPFolder -SiteRelativePath $folder | Out-Null }
        $values = @{}
        foreach ($k in $up.Values.Keys) {
            if ($k -eq '_DatePhotoDaysAgo') { $values['DatePhoto'] = (Get-Date).Date.AddDays(-[int]$up.Values[$k]) } else { $values[$k] = $up.Values[$k] }
        }
        try {
            if ($values.Count -gt 0) { Add-PnPFile -Path $up.LocalPath -Folder $folder -Values $values | Out-Null }
            else { Add-PnPFile -Path $up.LocalPath -Folder $folder | Out-Null }
        } catch {
            # Une colonne de métadonnées absente ne doit pas empêcher le dépôt du fichier.
            $result.Warnings += "Métadonnées non appliquées à $($up.FileName) : $($_.Exception.Message)"
            Add-PnPFile -Path $up.LocalPath -Folder $folder | Out-Null
        }
        $result.Uploaded += $serverRel
    }

    # 2. Colonnes image des listes (uniquement si vides)
    foreach ($col in $Plan.Columns) {
        $field = $null
        # Colonnes de la liste elle-même (Get-PnPField -Identity peut renvoyer une colonne de site homonyme).
        try { $field = @(Get-PnPField -List $col.List -ErrorAction Stop) | Where-Object { $_.InternalName -eq $col.Field } | Select-Object -First 1 } catch { $field = $null }
        if (-not $field) { $result.Warnings += "Colonne absente : $($col.List)/$($col.Field) (à créer par le provisionnement)"; continue }
        $items = @()
        try { $items = @(Get-PnPListItem -List $col.List -PageSize 100 -ErrorAction Stop) } catch { $result.Warnings += "Liste absente : $($col.List)"; continue }
        $empty = @($items | Where-Object { -not (Get-BbiHyperlinkUrl -Item $_ -Field $col.Field) })
        foreach ($other in @($items | Where-Object { Get-BbiHyperlinkUrl -Item $_ -Field $col.Field })) { $result.ColumnsKept += "$($col.List)#$($other.Id)" }
        foreach ($a in (Get-BbiColumnAssignments -Column $col -Items $empty)) {
            if (-not $a.Key -or -not $urls.ContainsKey($a.Key)) { continue }
            $title = "$($a.Item.FieldValues['Title'])"
            if (-not $DryRun) { Set-PnPListItem -List $col.List -Identity $a.Item.Id -Values @{ $col.Field = "$($urls[$a.Key]), $title" } | Out-Null }
            $result.ColumnsFilled += "$($col.List)#$($a.Item.Id) $($col.Field)"
        }
    }
    return $result
}
