<#
.SYNOPSIS
    Fonctions partagées du kit « organisation » : lecture et validation de la
    configuration, calcul du plan (sites, URL, groupes), fichier d'environnement.

.DESCRIPTION
    Ce fichier n'est pas exécuté seul : New-BbiOrganization.ps1, Test-BbiOrganization.ps1
    et verify-organisation.ps1 le chargent avec « . .\BbiOrganization.ps1 ».
    Aucune fonction d'ici n'appelle SharePoint, sauf Connect-Bbi : tout le reste se
    teste hors ligne (voir verify-organisation.ps1).
#>

. (Join-Path $PSScriptRoot 'BbiSlug.ps1')

# Valeur d'une propriété optionnelle (chaîne vide ou absente → valeur par défaut)
function Get-BbiOptional {
    param($Object, [string]$Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop -or $null -eq $prop.Value) { return $Default }
    if ($prop.Value -is [string] -and -not $prop.Value.Trim()) { return $Default }
    return $prop.Value
}

function Connect-Bbi {
    param([Parameter(Mandatory)][string]$Url, [string]$ClientId = '')
    $p = @{ Url = $Url; Interactive = $true }
    if ($ClientId) { $p.ClientId = $ClientId }
    Connect-PnPOnline @p
}

# Liste des erreurs de configuration (vide si la configuration est valide)
function Test-BbiOrganizationConfig {
    param([Parameter(Mandatory)]$Config)
    $errors = New-Object System.Collections.Generic.List[string]
    $emailRx = '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    $colorRx = '^#[0-9A-Fa-f]{6}$'
    $slugRx  = '^[a-z0-9]+(-[a-z0-9]+)*$'

    $tenant = "$(Get-BbiOptional $Config.tenant 'nom' '')"
    if (-not $tenant) { $errors.Add("tenant.nom est obligatoire (la partie avant .sharepoint.com, par exemple « businessbuilderinter »).") }
    elseif ($tenant -cnotmatch '^[a-z0-9-]+$') { $errors.Add("tenant.nom « $tenant » : minuscules, chiffres et tirets uniquement.") }

    $siege = $Config.siege
    if ($null -eq $siege) {
        $errors.Add("siege est obligatoire.")
    } else {
        if (-not "$(Get-BbiOptional $siege 'titre' '')") { $errors.Add("siege.titre est obligatoire.") }
        $alias = "$(Get-BbiOptional $siege 'alias' '')"
        if (-not $alias) { $errors.Add("siege.alias est obligatoire (fin de l'URL : /sites/<alias>).") }
        elseif ($alias -cnotmatch $slugRx) { $errors.Add("siege.alias « $alias » : minuscules, chiffres et tirets uniquement.") }
        $c = "$(Get-BbiOptional $siege 'couleur' '')"
        if ($c -and $c -notmatch $colorRx) { $errors.Add("siege.couleur « $c » : format attendu #RRGGBB.") }
    }

    $prefix = "$(Get-BbiOptional $Config.options 'prefixeFiliale' 'intranet-')"
    if ($prefix -and $prefix -cnotmatch '^[a-z0-9-]+$') { $errors.Add("options.prefixeFiliale « $prefix » : minuscules, chiffres et tirets uniquement.") }

    $support = "$(Get-BbiOptional $Config.organisation 'emailSupport' '')"
    if ($support -and $support -notmatch $emailRx) { $errors.Add("organisation.emailSupport : adresse e-mail invalide « $support ».") }

    $form = "$(Get-BbiOptional $Config.organisation 'formulaireSatisfaction' '')"
    if ($form -and $form -notmatch '^https://\S+$') { $errors.Add("organisation.formulaireSatisfaction : adresse https attendue « $form ».") }

    $seen = @{}
    $i = 0
    foreach ($f in @($Config.filiales)) {
        $i++
        if ($null -eq $f) { continue }
        $label = "filiales[$i]"
        $titre = "$(Get-BbiOptional $f 'titre' '')"
        $ville = "$(Get-BbiOptional $f 'ville' '')"
        if (-not $titre) { $errors.Add("$label.titre est obligatoire.") }
        if (-not $ville) {
            $errors.Add("$label.ville est obligatoire (elle fournit l'URL du site).")
        } else {
            $slug = ConvertTo-BbiSlug -Prefix $prefix -Value $ville
            if (-not $slug) { $errors.Add("$label.ville « $ville » ne donne aucun nom de site utilisable.") }
            elseif ($seen.ContainsKey($slug)) { $errors.Add("$label.ville « $ville » donne le même site que « $($seen[$slug]) » ($slug).") }
            else { $seen[$slug] = $ville }
            if ($siege -and "$(Get-BbiOptional $siege 'alias' '')" -eq $slug) { $errors.Add("$label.ville « $ville » donne la même URL que le siège ($slug).") }
        }
        $c = "$(Get-BbiOptional $f 'couleur' '')"
        if ($c -and $c -notmatch $colorRx) { $errors.Add("$label.couleur « $c » : format attendu #RRGGBB.") }
    }

    $people = @()
    if ($siege) {
        foreach ($k in 'proprietaires', 'membres', 'visiteurs') {
            $people += @(Get-BbiOptional $siege $k @()) | ForEach-Object { [pscustomobject]@{ Where = "siege.$k"; Mail = $_ } }
        }
    }
    $j = 0
    foreach ($f in @($Config.filiales)) {
        $j++
        foreach ($k in 'proprietaires', 'membres', 'visiteurs') {
            $people += @(Get-BbiOptional $f $k @()) | ForEach-Object { [pscustomobject]@{ Where = "filiales[$j].$k"; Mail = $_ } }
        }
    }
    foreach ($m in @(Get-BbiOptional $Config.groupes.editeurs 'membres' @())) {
        $people += [pscustomobject]@{ Where = 'groupes.editeurs.membres'; Mail = $m }
    }
    $demoAccounts = Get-BbiOptional (Get-BbiOptional $Config 'demonstration' $null) 'comptes' $null
    foreach ($k in 'clients', 'apprenants', 'employes', 'rh', 'direction') {
        foreach ($m in @(Get-BbiOptional $demoAccounts $k @())) { $people += [pscustomobject]@{ Where = "demonstration.comptes.$k"; Mail = $m } }
    }
    foreach ($p in $people) {
        if ("$($p.Mail)" -notmatch $emailRx) { $errors.Add("$($p.Where) : adresse e-mail invalide « $($p.Mail) ».") }
    }
    # Pas de « return , » : les appelants enveloppent l'appel dans @(...) pour obtenir un tableau, vide ou non.
    return $errors.ToArray()
}

function Read-BbiOrganizationConfig {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Configuration introuvable : $Path`nCopiez deploy/organisation.example.json en deploy/organisation.json puis adaptez-le."
    }
    try {
        $cfg = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        throw "Configuration illisible (JSON invalide) : $Path`n$($_.Exception.Message)"
    }
    $errors = @(Test-BbiOrganizationConfig -Config $cfg)
    if ($errors.Count -gt 0) {
        throw ("Configuration invalide ($Path) :`n  - " + ($errors -join "`n  - "))
    }
    return $cfg
}

# Plan de l'organisation : tout ce que les scripts vont créer, calculé sans toucher SharePoint.
function Get-BbiOrganizationPlan {
    param([Parameter(Mandatory)]$Config, [string[]]$Filiale = @(), [string]$BaseDirectory = $PWD.Path)

    $tenant    = "$($Config.tenant.nom)"
    $tenantUrl = "https://$tenant.sharepoint.com"
    $prefix    = "$(Get-BbiOptional $Config.options 'prefixeFiliale' 'intranet-')"
    $filter    = @($Filiale | ForEach-Object { ConvertTo-BbiSlug -Value $_ } | Where-Object { $_ })

    $siegeAlias = "$($Config.siege.alias)"
    $siege = [pscustomobject]@{
        Titre         = "$($Config.siege.titre)"
        Alias         = $siegeAlias
        Url           = "$tenantUrl/sites/$siegeAlias"
        Ville         = "$(Get-BbiOptional $Config.siege 'ville' '')"
        Pays          = "$(Get-BbiOptional $Config.siege 'pays' '')"
        Couleur       = "$(Get-BbiOptional $Config.siege 'couleur' '#0E265C')"
        Initiales     = "$(Get-BbiOptional $Config.siege 'initiales' '')"
        Responsable   = "$(Get-BbiOptional $Config.siege 'responsable' '')"
        Email         = "$(Get-BbiOptional $Config.siege 'email' '')"
        Telephone     = "$(Get-BbiOptional $Config.siege 'telephone' '')"
        Adresse       = "$(Get-BbiOptional $Config.siege 'adresse' '')"
        Proprietaires = @(Get-BbiOptional $Config.siege 'proprietaires' @())
        Membres       = @(Get-BbiOptional $Config.siege 'membres' @())
        Visiteurs     = @(Get-BbiOptional $Config.siege 'visiteurs' @())
    }

    $filiales = @()
    $ordre = 0
    foreach ($f in @($Config.filiales)) {
        if ($null -eq $f) { continue }
        $ordre++
        $ville = "$($f.ville)"
        $slug  = ConvertTo-BbiSlug -Prefix $prefix -Value $ville
        $filiales += [pscustomobject]@{
            Titre         = "$($f.titre)"
            Ville         = $ville
            Pays          = "$(Get-BbiOptional $f 'pays' '')"
            Slug          = $slug
            Url           = "$tenantUrl/sites/$slug"
            Ordre         = $ordre
            Couleur       = "$(Get-BbiOptional $f 'couleur' '#0E265C')"
            Initiales     = "$(Get-BbiOptional $f 'initiales' '')"
            Responsable   = "$(Get-BbiOptional $f 'responsable' '')"
            Email         = "$(Get-BbiOptional $f 'email' '')"
            Telephone     = "$(Get-BbiOptional $f 'telephone' '')"
            Adresse       = "$(Get-BbiOptional $f 'adresse' '')"
            Proprietaires = @(Get-BbiOptional $f 'proprietaires' @())
            Membres       = @(Get-BbiOptional $f 'membres' @())
            Visiteurs     = @(Get-BbiOptional $f 'visiteurs' @())
            Selectionnee  = ($filter.Count -eq 0 -or ($filter -contains (ConvertTo-BbiSlug -Value $ville)))
        }
    }

    $packagePath = "$(Get-BbiOptional $Config.options 'cheminPaquet' '../deliverables/spfx/bbi-portail.sppkg')"
    if (-not [IO.Path]::IsPathRooted($packagePath)) { $packagePath = [IO.Path]::GetFullPath((Join-Path $BaseDirectory $packagePath)) }
    $logo = "$(Get-BbiOptional $Config.identite 'logo' '')"
    if ($logo -and -not [IO.Path]::IsPathRooted($logo)) { $logo = [IO.Path]::GetFullPath((Join-Path $BaseDirectory $logo)) }

    return [pscustomobject]@{
        Organisation    = "$(Get-BbiOptional $Config.organisation 'nom' $Config.siege.titre)"
        Tenant          = $tenant
        TenantUrl       = $tenantUrl
        AdminUrl        = "https://$tenant-admin.sharepoint.com"
        Lcid            = [int](Get-BbiOptional $Config.organisation 'langue' 1036)
        EmailSupport    = "$(Get-BbiOptional $Config.organisation 'emailSupport' '')"
        TelephoneSupport = "$(Get-BbiOptional $Config.organisation 'telephoneSupport' '')"
        FormulaireSatisfaction = "$(Get-BbiOptional $Config.organisation 'formulaireSatisfaction' '')"
        Prefixe         = $prefix
        Hub             = [bool](Get-BbiOptional $Config.options 'hub' $true)
        DonneesDemo     = [bool](Get-BbiOptional $Config.options 'donneesDemo' $true)
        DemonstrationDroits = [bool](Get-BbiOptional $Config.options 'demonstrationDroits' $false)
        DeployerApp     = [bool](Get-BbiOptional $Config.options 'deployerApplication' $true)
        CheminPaquet    = $packagePath
        GroupeEditeurs  = "$(Get-BbiOptional $Config.groupes.editeurs 'nom' 'BBI-Concepteurs')"
        EditeursMembres = @(Get-BbiOptional $Config.groupes.editeurs 'membres' @())
        LectureTous     = [bool](Get-BbiOptional $Config.groupes 'lectureTous' $false)
        NomTheme        = "$(Get-BbiOptional $Config.identite 'nomTheme' 'Business Builders International Bleu nuit')"
        Logo            = $logo
        PiedDePage      = @(Get-BbiOptional $Config.identite 'piedDePage' @())
        TitrePiedDePage = "$(Get-BbiOptional $Config.identite 'titrePiedDePage' (Get-BbiOptional $Config.organisation 'nom' $Config.siege.titre))"
        Siege           = $siege
        Filiales        = $filiales
    }
}

function Write-BbiOrganizationPlan {
    param([Parameter(Mandatory)]$Plan)
    Write-Host ""
    Write-Host "Organisation : $($Plan.Organisation)" -ForegroundColor White
    Write-Host "Tenant       : $($Plan.TenantUrl)   (administration : $($Plan.AdminUrl))" -ForegroundColor Gray
    Write-Host "Hub          : $(if ($Plan.Hub) { 'oui, le siège devient hub, les filiales y sont rattachées' } else { 'non' })" -ForegroundColor Gray
    Write-Host "Application  : $(if ($Plan.DeployerApp) { $Plan.CheminPaquet } else { 'non déployée par le script' })" -ForegroundColor Gray
    Write-Host "Groupe éditeurs : $($Plan.GroupeEditeurs)   Thème : $($Plan.NomTheme)" -ForegroundColor Gray
    Write-Host "Démonstration des droits : $(if ($Plan.DemonstrationDroits) { 'oui, dix documents aux droits différents' } else { 'non' })" -ForegroundColor Gray
    Write-Host ""
    $rows = @()
    $rows += [pscustomobject]@{ Site = $Plan.Siege.Titre; Role = 'Siège (hub)'; Url = $Plan.Siege.Url; Proprio = $Plan.Siege.Proprietaires.Count; Membres = $Plan.Siege.Membres.Count; Visiteurs = $Plan.Siege.Visiteurs.Count; Inclus = 'oui' }
    foreach ($f in $Plan.Filiales) {
        $rows += [pscustomobject]@{ Site = $f.Titre; Role = "Filiale $($f.Ordre)"; Url = $f.Url; Proprio = $f.Proprietaires.Count; Membres = $f.Membres.Count; Visiteurs = $f.Visiteurs.Count; Inclus = $(if ($f.Selectionnee) { 'oui' } else { 'non (filtre -Filiale)' }) }
    }
    $rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    Write-Host "Chaque site reçoit : listes et bibliothèques du portail, page accueil.aspx avec la web part Business Builders International Accueil, thème, en-tête, pied de page." -ForegroundColor Gray
}

# Fichier d'environnement lu par provision-bbi-intranet.ps1 (-EnvironmentFile)
function New-BbiEnvironmentFile {
    param([Parameter(Mandatory)]$Plan, [Parameter(Mandatory)][string]$Path)
    $envData = [ordered]@{
        _lisezMoi         = 'Fichier généré par New-BbiOrganization.ps1 à partir de organisation.json. Ne pas modifier à la main.'
        tenantHost        = "$($Plan.Tenant).sharepoint.com"
        tenantUrl         = $Plan.TenantUrl
        sitePath          = "/sites/$($Plan.Siege.Alias)"
        siteUrl           = $Plan.Siege.Url
        dataSiteUrl       = ''
        editorsGroup      = $Plan.GroupeEditeurs
        hubEnabled        = $Plan.Hub
        filialeSitePrefix = $Plan.Prefixe
        workbenchUrl      = "$($Plan.TenantUrl)/_layouts/15/workbench.aspx"
        supportEmail      = $Plan.EmailSupport
        supportPhone      = $Plan.TelephoneSupport
        satisfactionFormUrl = $Plan.FormulaireSatisfaction
    }
    $json = $envData | ConvertTo-Json -Depth 4
    [IO.File]::WriteAllText($Path, $json, (New-Object System.Text.UTF8Encoding($false)))
    return $Path
}
