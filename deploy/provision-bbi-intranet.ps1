<#
.SYNOPSIS
    BBI Intranet — provisionnement du site SharePoint Online (listes, bibliothèques,
    page d'accueil unique avec le portail BBI Accueil, thème et navigation).

.DESCRIPTION
    Ce script rend le site BBI fonctionnel avec la solution SPFx « bbi-intranet » :
      1. listes et bibliothèques métier avec les colonnes EXACTES attendues par le code SPFx ;
      2. vues utiles (catalogue actif, prochaines sessions, récemment publiés, albums) ;
      3. bibliothèque d'images « Galerie médias » + colonnes Album / Lieu / Crédit / Date ;
      4. une page d'accueil applicative (SingleWebPartAppPage) avec une seule web part BBI Accueil ;
      5. vues internes Catalogue, Sessions, Actualités, Ressources et Communauté ;
      6. extension « BBI Plein écran » (bord à bord) via une Custom Action ;
      7. thème « BBI Bleu nuit », logo, en-tête, navigation et pied de page ;
      8. jeu de données d'exemple (optionnel) pour valider immédiatement ;
      9. hub et filiales (optionnel, -ProvisionFiliales) : site hub, un site d'équipe par
         filiale de la liste « Implantations », portail BBI sur chacun et navigation hub.

    Le script est IDEMPOTENT : relancez-le autant de fois que nécessaire, il ne recrée
    pas ce qui existe déjà. Utilisez -DryRun pour simuler sans rien modifier.

.PREREQUIS
    PnP.PowerShell 2.x :  Install-Module PnP.PowerShell -Scope CurrentUser
    Droits : administrateur SharePoint (propriétaire du site au minimum).
    La solution bbi-portail.sppkg doit être déployée dans le catalogue d'applications.
    -ProvisionFiliales : rôle Administrateur SharePoint requis (Register-PnPHubSite,
    Get-PnPTenantSite, Get-PnPHubSite) + droit de créer des groupes Microsoft 365.

.EXEMPLES
    # Simulation (aucune modification)
    .\provision-bbi-intranet.ps1 -DryRun

    # Provisionnement complet + données d'exemple
    .\provision-bbi-intranet.ps1 -SeedDemoData

    # Audit uniquement : vérifie que tout est conforme au code SPFx
    .\provision-bbi-intranet.ps1 -VerifyOnly

    # Hub et filiales : simulation (sites d'équipe, rattachement au hub, navigation)
    .\provision-bbi-intranet.ps1 -ProvisionFiliales -DryRun

    # Hub et filiales : une seule filiale (premier passage recommandé)
    .\provision-bbi-intranet.ps1 -ProvisionFiliales -Filiale Abidjan

    # Autre site que celui par défaut (bbi-environnement.json)
    .\provision-bbi-intranet.ps1 -SiteUrl https://businessbuilderinter.sharepoint.com/sites/un-autre-site

.ENVIRONNEMENT
    Le tenant et le site sont lus dans « bbi-environnement.json » (racine du dépôt) :
        tenantHost : businessbuilderinter.sharepoint.com
        siteUrl    : https://businessbuilderinter.sharepoint.com/sites/intranet
    Les paramètres -SiteUrl / -DataSiteUrl / -EditorsGroup restent prioritaires s'ils sont fournis.

.NOTES
    Auteur : agence SPFx — Business Builders International
    Version : 1.5.0 — accompagne la solution bbi-intranet 1.5.0.0
#>

[CmdletBinding()]
param(
    # Site SharePoint à provisionner. Par défaut : « siteUrl » de bbi-environnement.json
    [string]$SiteUrl,

    # Site contenant les listes métier (par défaut : le site ci-dessus)
    [string]$DataSiteUrl,

    # Groupe SharePoint autorisé à MODIFIER les supports publiés
    # (par défaut : « editorsGroup » de bbi-environnement.json)
    [string]$EditorsGroup = '',

    # Crée des éléments d'exemple dans chaque liste
    [switch]$SeedDemoData,

    # Simule sans rien modifier
    [switch]$DryRun,

    # Vérifie la configuration et affiche un rapport, sans rien modifier
    [switch]$VerifyOnly,

    # Hub : enregistre le site comme hub, crée un site d'équipe par filiale (liste Implantations) et y déploie le portail
    [switch]$ProvisionFiliales,

    # Limite -ProvisionFiliales aux lignes dont Ville correspond (comparaison via ConvertTo-BbiSlug : accents et casse ignorés)
    [string[]]$Filiale,

    # N'ajoute pas le lien « BBI Intranet » au menu du site. Utilisé par la première passe de
    # New-BbiOrganization.ps1 : la seconde passe (-ProvisionFiliales) crée le lien du siège.
    [switch]$SkipNavigation,

    # Fichier d'environnement (tenant, site). Par défaut : bbi-environnement.json à la racine du dépôt.
    # New-BbiOrganization.ps1 le renseigne pour viser un autre tenant.
    [string]$EnvironmentFile = '',

    # Identifiant de l'application Entra ID pour la connexion interactive (PnP.PowerShell 2.x l'exige).
    # Par défaut : variable d'environnement BBI_CLIENT_ID.
    [string]$ClientId = $env:BBI_CLIENT_ID
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------
# Environnement (tenant + site) — source unique : bbi-environnement.json
# ------------------------------------------------------------------
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $EnvironmentFile) { $EnvironmentFile = Join-Path (Split-Path -Parent $scriptRoot) 'bbi-environnement.json' }

if (Test-Path $EnvironmentFile) {
    $BbiEnv = Get-Content $EnvironmentFile -Raw -Encoding UTF8 | ConvertFrom-Json
} else {
    $BbiEnv = $null
    Write-Host "  ! bbi-environnement.json introuvable — renseignez -SiteUrl." -ForegroundColor Yellow
}

if (-not $SiteUrl) {
    if ($BbiEnv -and $BbiEnv.siteUrl) {
        $SiteUrl = "$($BbiEnv.siteUrl)"
        Write-Host "  · Site lu dans bbi-environnement.json : $SiteUrl" -ForegroundColor DarkGray
    } else {
        throw "Aucun site : renseignez -SiteUrl ou le champ « siteUrl » de bbi-environnement.json."
    }
}
if (-not $DataSiteUrl) {
    if ($BbiEnv -and $BbiEnv.dataSiteUrl) { $DataSiteUrl = "$($BbiEnv.dataSiteUrl)" } else { $DataSiteUrl = $SiteUrl }
}
if (-not $EditorsGroup) {
    if ($BbiEnv -and $BbiEnv.editorsGroup) { $EditorsGroup = "$($BbiEnv.editorsGroup)" } else { $EditorsGroup = 'BBI-Concepteurs' }
}
$HubEnabled = $true
if ($BbiEnv -and $null -ne $BbiEnv.hubEnabled) { $HubEnabled = [bool]$BbiEnv.hubEnabled }
$FilialePrefix = 'intranet-'
if ($BbiEnv -and $BbiEnv.filialeSitePrefix) { $FilialePrefix = "$($BbiEnv.filialeSitePrefix)" }

$script:DataSiteUrl = $DataSiteUrl
$script:Changes = 0
$script:Report = New-Object System.Collections.Generic.List[object]

# ------------------------------------------------------------------
# Identifiants des composants SPFx (à ne pas modifier)
# ------------------------------------------------------------------
$WP_HOME      = '6a9b6e3b-44f1-4a70-8f0a-45c82b29126d'   # BBI Accueil (plein écran)
$WP_CATALOG   = 'd37a426e-48db-484f-bf10-c38675bb7b43'   # BBI Catalogue des formations
$WP_DOCUMENTS = 'c9a1e6d4-3b27-4e1f-8f5a-6d0b9c2e7a41'   # BBI Documents sécurisés
$WP_GALLERY   = 'f0f19a37-2c11-4812-9006-8aa71a9254f1'   # BBI Galerie médias
$WP_FICHE     = 'a9c99e25-db18-4419-894b-08bc9c5b9081'   # BBI Fiche formation (modèle)
$WP_SESSIONS  = '96216ee2-85b1-473b-aaec-e5b646a151ee'   # BBI Sessions & inscriptions
$WP_ARTICLE   = 'f769f3df-2c27-4a30-bce2-d4ae5793557b'   # BBI Article d'actualité (modèle)
$EXT_FULLSCREEN = 'ae430672-9740-4b5a-ace1-fd5d5ab6e9bf' # BBI Plein écran (Application Customizer)

# ------------------------------------------------------------------
# Connexion (avec -ClientId quand il est fourni)
# ------------------------------------------------------------------
function Connect-BbiSite {
    param([Parameter(Mandatory)][string]$Url)
    $connect = @{ Url = $Url; Interactive = $true }
    if ($ClientId) { $connect.ClientId = $ClientId }
    Connect-PnPOnline @connect
}

# ------------------------------------------------------------------
# Journalisation
# ------------------------------------------------------------------
function Write-Step  { param([string]$Message) Write-Host "  → $Message" -ForegroundColor Cyan }
function Write-Ok    { param([string]$Message) Write-Host "  ✓ $Message" -ForegroundColor Green }
function Write-Skip  { param([string]$Message) Write-Host "  · $Message (déjà en place)" -ForegroundColor DarkGray }
function Write-Warn2 { param([string]$Message) Write-Host "  ! $Message" -ForegroundColor Yellow }
function Write-Title { param([string]$Message) Write-Host "`n$Message" -ForegroundColor White -BackgroundColor DarkBlue }

function Add-Report {
    param([string]$Element, [string]$Statut, [string]$Detail = '')
    $script:Report.Add([pscustomobject]@{ Element = $Element; Statut = $Statut; Detail = $Detail })
}

# Wrapper : exécute une action sauf en mode simulation / audit
function Invoke-Bbi {
    param([string]$Description, [scriptblock]$Action)
    if ($DryRun -or $VerifyOnly) {
        Write-Step "[SIMULATION] $Description"
        return $null
    }
    Write-Step $Description
    $result = & $Action
    $script:Changes++
    return $result
}

# ------------------------------------------------------------------
# Fonctions utilitaires (idempotentes)
# ------------------------------------------------------------------
function Get-BbiList {
    param([string]$Title)
    return Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
}

function Ensure-BbiList {
    param(
        [string]$Title,
        [string]$Template = 'GenericList',   # GenericList | DocumentLibrary | PictureLibrary
        [switch]$OnQuickLaunch,
        [string]$Url = ''           # adresse relative de la liste (sinon SharePoint la déduit du titre)
    )
    $existing = Get-BbiList -Title $Title
    if ($existing) { Write-Skip "Liste « $Title »"; Add-Report "Liste $Title" 'OK'; return $existing }

    if ($DryRun -or $VerifyOnly) {
        Write-Warn2 "Liste « $Title » absente"
        Add-Report "Liste $Title" 'MANQUANT'
        return $null
    }
    Invoke-Bbi "Création de la liste « $Title » ($Template)" {
        $params = @{ Title = $Title; Template = $Template }
        if ($OnQuickLaunch) { $params.OnQuickLaunch = $true }
        if ($Url) { $params.Url = $Url }
        New-PnPList @params | Out-Null
    } | Out-Null
    Add-Report "Liste $Title" 'CRÉÉ'
    return (Get-BbiList -Title $Title)
}

function Ensure-BbiField {
    param(
        [string]$List,
        [string]$DisplayName,
        [string]$InternalName = $DisplayName,
        [string]$Type = 'Text',              # Text | Note | Choice | DateTime | Number | Hyperlink | Boolean
        [string[]]$Choices,
        [switch]$Required,
        [switch]$AddToDefaultView
    )
    $field = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
    if ($field) { Write-Skip "  colonne $DisplayName"; return }

    if ($DryRun -or $VerifyOnly) {
        Write-Warn2 "  colonne $DisplayName absente dans « $List »"
        Add-Report "Colonne $List/$InternalName" 'MANQUANT'
        return
    }
    Invoke-Bbi "  colonne $DisplayName dans « $List »" {
        $params = @{
            List          = $List
            DisplayName   = $DisplayName
            InternalName  = $InternalName
            Type          = $Type
            AddToDefaultView = $true
        }
        if ($Choices)  { $params.Choices = $Choices }
        if ($Required) { $params.Required = $true }
        Add-PnPField @params | Out-Null
    } | Out-Null
    Add-Report "Colonne $List/$InternalName" 'CRÉÉ'
}

function Ensure-BbiView {
    param(
        [string]$List,
        [string]$Title,
        [string[]]$Fields,
        [string]$Query,
        [int]$RowLimit = 30
    )
    $existing = Get-PnPView -List $List -Identity $Title -ErrorAction SilentlyContinue
    if ($existing) { Write-Skip "  vue $Title"; return }

    if ($DryRun -or $VerifyOnly) {
        Write-Warn2 "  vue $Title absente dans « $List »"
        Add-Report "Vue $List/$Title" 'MANQUANT'
        return
    }
    Invoke-Bbi "  vue « $Title » dans « $List »" {
        $params = @{ List = $List; Title = $Title; Fields = $Fields; RowLimit = $RowLimit }
        if ($Query) { $params.Query = $Query }
        Add-PnPView @params | Out-Null
    } | Out-Null
    Add-Report "Vue $List/$Title" 'CRÉÉ'
}

function Ensure-BbiPage {
    param(
        [string]$Name,                      # nom du fichier sans extension
        [string]$Title,
        [string]$LayoutType = 'Article',    # Article | Home | SingleWebPartAppPage
        [string]$PromoteAs = ''             # '' | 'Template' → disponible dans « Nouveau > Page »
    )
    $page = Get-PnPPage -Identity "$Name.aspx" -ErrorAction SilentlyContinue
    if ($page) {
        if ($PromoteAs -eq 'Template') {
            $isTemplate = $false
            try {
                $item = Get-PnPListItem -List 'Pages du site' -Id $page.Id -Fields 'PromotedState' -ErrorAction SilentlyContinue
                if ($item -and $item.FieldValues.PromotedState -eq 2) { $isTemplate = $true }
            } catch { }
            if ($isTemplate) { Write-Skip "  page $Name.aspx (modèle)"; return $page }
        } else {
            Write-Skip "  page $Name.aspx"
            Add-Report "Page $Name.aspx" 'OK'
            return $page
        }
    }

    if ($DryRun -or $VerifyOnly) {
        Write-Warn2 "  page $Name.aspx absente$(if ($PromoteAs -eq 'Template') { ' (modèle de page)' })"
        Add-Report "Page $Name.aspx" 'MANQUANT'
        return $null
    }

    if ($page -and $PromoteAs -eq 'Template') {
        Invoke-Bbi "  promotion de « $Name.aspx » en modèle de page" {
            Set-PnPPage -Identity "$Name.aspx" -PromoteAs Template -Publish | Out-Null
        } | Out-Null
        Add-Report "Page $Name.aspx (modèle)" 'CRÉÉ'
        return $page
    }

    Invoke-Bbi "  page « $Name.aspx » ($LayoutType)$(if ($PromoteAs -eq 'Template') { ' [modèle]' })" {
        $params = @{ Name = $Name; Title = $Title; LayoutType = $LayoutType; Publish = $true }
        if ($PromoteAs -eq 'Template') { $params.PromoteAs = 'Template' }
        Add-PnPPage @params | Out-Null
    } | Out-Null
    Add-Report "Page $Name.aspx" 'CRÉÉ'
    return (Get-PnPPage -Identity "$Name.aspx" -ErrorAction SilentlyContinue)
}

<#
    Inventaire des champs d'une bibliothèque (lecture seule) + détection d'une colonne
    optionnelle. Utilisé pour le paramétrage intelligent des web parts.
#>
$script:FieldCache = @{}
function Get-BbiListInventory {
    param([string]$List)
    if ($script:FieldCache.ContainsKey($List)) { return $script:FieldCache[$List] }
    $inventory = @{ Exists = $false; Fields = @() }
    try {
        $fields = Get-PnPField -List $List -ErrorAction SilentlyContinue
        if ($fields) {
            $inventory.Exists = $true
            $inventory.Fields = @($fields | ForEach-Object { $_.InternalName })
        }
    } catch { }
    $script:FieldCache[$List] = $inventory
    return $inventory
}

function Test-BbiField {
    param([string]$List, [string]$InternalName)
    $inventory = Get-BbiListInventory -List $List
    return [bool]($inventory.Exists -and ($inventory.Fields -contains $InternalName))
}

function Ensure-BbiWebPart {
    param(
        [string]$Page,
        [string]$ComponentId,
        [string]$PropertiesJson,
        [int]$Section = 1,
        [int]$Column = 1,
        [int]$Order = 1,
        [string]$Name
    )

    # Audit / simulation : on vérifie la présence réelle du composant sur la page.
    if ($DryRun -or $VerifyOnly) {
        try {
            $controls = Get-PnPPageComponent -Page $Page -ErrorAction SilentlyContinue
            $present = @($controls | Where-Object { $_.ComponentId -eq [Guid]$ComponentId }).Count -gt 0
        } catch {
            $present = $false
        }
        if ($present) {
            Write-Skip "  web part $Name sur $Page"
            Add-Report "Web part $Name → $Page" 'OK'
        } else {
            Write-Warn2 "  web part $Name absent de $Page"
            Add-Report "Web part $Name → $Page" 'MANQUANT'
        }
        return
    }

    # On retire une éventuelle instance existante avant de la recréer proprement.
    try {
        $controls = Get-PnPPageComponent -Page $Page -ErrorAction SilentlyContinue
        $existing = $controls | Where-Object { $_.ComponentId -eq [Guid]$ComponentId }
        if ($existing) {
            foreach ($control in $existing) {
                Remove-PnPPageComponent -Page $Page -InstanceId $control.InstanceId -ErrorAction SilentlyContinue
            }
            Write-Step "  remplacement du web part existant sur $Page"
        }
    } catch { }

    Invoke-Bbi "  ajout du web part $Name sur « $Page »" {
        Add-PnPPageWebPart -Page $Page -Component $ComponentId -WebPartProperties $PropertiesJson `
            -Section $Section -Column $Column -Order $Order | Out-Null
    } | Out-Null
    Add-Report "Web part $Name → $Page" 'CRÉÉ'
}

function Ensure-BbiCustomAction {
    param(
        [string]$Name,
        [string]$Title,
        [string]$ComponentId,
        [string]$PropertiesJson
    )
    $existing = Get-PnPCustomAction -Scope Web -ErrorAction SilentlyContinue |
        Where-Object { $_.ClientSideComponentId -eq [Guid]$ComponentId }
    if ($existing) { Write-Skip "  custom action $Title"; Add-Report "Custom action $Title" 'OK'; return }

    if ($DryRun -or $VerifyOnly) {
        Write-Warn2 "  custom action $Title absente"
        Add-Report "Custom action $Title" 'MANQUANT'
        return
    }
    Invoke-Bbi "  custom action « $Title »" {
        Add-PnPCustomAction -Name $Name -Title $Title -Location 'ClientSideExtension.ApplicationCustomizer' `
            -ClientSideComponentId $ComponentId -ClientSideComponentProperties $PropertiesJson -Scope Web | Out-Null
    } | Out-Null
    Add-Report "Custom action $Title" 'CRÉÉ'
}

function Ensure-BbiNavNode {
    param([string]$Title, [string]$Url, [string]$Location = 'TopNavigationBar')
    if ($DryRun -or $VerifyOnly) { Write-Step "[SIMULATION] navigation : $Title"; return }
    try {
        $nodes = Get-PnPNavigationNode -Location $Location -ErrorAction SilentlyContinue
        if ($nodes | Where-Object { $_.Title -eq $Title }) { Write-Skip "  nav $Title"; return }
        Add-PnPNavigationNode -Location $Location -Title $Title -Url $Url | Out-Null
        Write-Ok "  nav $Title"
    } catch {
        Write-Warn2 "  navigation $Title : $($_.Exception.Message)"
    }
}

# Slug d'alias de site (filiales)
. (Join-Path $scriptRoot 'BbiSlug.ps1')

# ------------------------------------------------------------------
# Provisionnement d'un site (sections 2 à 5) : réutilisé pour le siège et chaque filiale
# ------------------------------------------------------------------
function Invoke-BbiSiteProvisioning {
    param(
        [Parameter(Mandatory)][string]$TargetUrl,
        [Parameter(Mandatory)][string]$DataUrl,
        [bool]$SeedDemo = $false,
        [string]$StepPrefix = '',
        # Re-run sur un site existant : ne remplace pas la web part BBI Accueil déjà posée (propriétés conservées)
        [switch]$PreserveWebPart
    )
    # $SeedDemo : accepté pour compatibilité d'interface ; le jeu de démo reste en section 9/10 (siège uniquement).
    if ((Get-PnPConnection).Url.TrimEnd('/') -ne $TargetUrl.TrimEnd('/')) {
        Connect-BbiSite -Url $TargetUrl
        Write-Ok "Connecté à $TargetUrl"
    }
    $previousDataSite = $script:DataSiteUrl
    $script:DataSiteUrl = $DataUrl
    try {
        # ==================================================================
        # 2. LISTES MÉTIER (colonnes attendues par le code SPFx)
        # ==================================================================
        Write-Title "${StepPrefix}2/10 · Listes métier"

        # --- Actualités : IHomeNews { Title, Summary, Category, Published, AuthorName, ImageUrl, LinkUrl }
        Ensure-BbiList -Title 'Actualites' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Actualites' -DisplayName 'Résumé'        -InternalName 'Summary'    -Type Note
        Ensure-BbiField -List 'Actualites' -DisplayName 'Corps de l''article' -InternalName 'Body' -Type Note
        Ensure-BbiField -List 'Actualites' -DisplayName 'Rubrique'      -InternalName 'Category'   -Type Choice `
            -Choices @('Certification','Formations','Vie BBI','Événement','Communiqué')
        Ensure-BbiField -List 'Actualites' -DisplayName 'Date de publication' -InternalName 'Published' -Type DateTime
        Ensure-BbiField -List 'Actualites' -DisplayName 'Auteur'         -InternalName 'AuthorName' -Type Text
        Ensure-BbiField -List 'Actualites' -DisplayName 'Image (URL)'    -InternalName 'ImageUrl'   -Type Hyperlink
        Ensure-BbiField -List 'Actualites' -DisplayName 'Lien (URL)'     -InternalName 'LinkUrl'    -Type Hyperlink
        Ensure-BbiView  -List 'Actualites' -Title 'À la une' -Fields @('Title','Category','Published','AuthorName') `
            -Query '<OrderBy><FieldRef Name="Published" Ascending="FALSE"/></OrderBy>'

        # --- Sessions : IHomeSession { Title, StartDate, Modality, Location, Status, RegistrationUrl }
        Ensure-BbiList -Title 'Sessions' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Sessions' -DisplayName 'Date de début' -InternalName 'StartDate' -Type DateTime
        Ensure-BbiField -List 'Sessions' -DisplayName 'Date de fin'   -InternalName 'EndDate'   -Type DateTime
        Ensure-BbiField -List 'Sessions' -DisplayName 'Modalité'      -InternalName 'Modality' -Type Choice `
            -Choices @('Présentiel','Distanciel','Hybride')
        Ensure-BbiField -List 'Sessions' -DisplayName 'Lieu'          -InternalName 'Location' -Type Text
        Ensure-BbiField -List 'Sessions' -DisplayName 'Statut'        -InternalName 'Status'   -Type Text
        Ensure-BbiField -List 'Sessions' -DisplayName 'Inscription (URL)' -InternalName 'RegistrationUrl' -Type Hyperlink
        Ensure-BbiField -List 'Sessions' -DisplayName 'Formateur'      -InternalName 'Trainer'   -Type Text
        Ensure-BbiField -List 'Sessions' -DisplayName 'Formulaire de satisfaction (URL)' -InternalName 'LienSatisfaction' -Type Hyperlink
        Ensure-BbiField -List 'Sessions' -DisplayName 'Formulaire envoyé'  -InternalName 'SatisfactionEnvoyee' -Type Boolean
        Ensure-BbiView  -List 'Sessions' -Title 'Prochaines sessions' -Fields @('Title','StartDate','Modality','Location','Status') `
            -Query '<Where><Geq><FieldRef Name="StartDate"/><Value Type="DateTime"><Today/></Value></Geq></Where><OrderBy><FieldRef Name="StartDate"/></OrderBy>'
        Ensure-BbiView  -List 'Sessions' -Title 'Toutes les sessions' -Fields @('Title','StartDate','Modality','Location','Status') `
            -Query '<OrderBy><FieldRef Name="StartDate" Ascending="FALSE"/></OrderBy>'

        # --- Formateurs : IHomeTrainer { Title, Role, Filiere, Initials, PhotoUrl, Phone, Email, WhatsApp, Location, Bio… }
        Ensure-BbiList -Title 'Formateurs' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Rôle'        -InternalName 'Role'        -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Filière'     -InternalName 'Filiere'     -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Initiales'   -InternalName 'Initials'    -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Photo (URL)' -InternalName 'PhotoUrl'    -Type Hyperlink
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Téléphone'   -InternalName 'Phone'       -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'E-mail'      -InternalName 'Email'       -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'WhatsApp'    -InternalName 'WhatsApp'    -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Localisation' -InternalName 'Location'   -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Biographie'  -InternalName 'Bio'         -Type Note
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Spécialités' -InternalName 'Specialites' -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Certifications' -InternalName 'Certifications' -Type Text
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Profil LinkedIn' -InternalName 'LinkedIn' -Type Hyperlink
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Catégorie' -InternalName 'Categorie' -Type Choice `
            -Choices @('Formateur','Permanent','Direction','Appui')
        Ensure-BbiField -List 'Formateurs' -DisplayName 'Ordre' -InternalName 'Ordre' -Type Number
        Ensure-BbiView  -List 'Formateurs' -Title 'Annuaire formateurs' -Fields @('Title','Role','Filiere','Phone','Email','Location') `
            -Query '<OrderBy><FieldRef Name="Title"/></OrderBy>'

        # --- Employés du mois : IHomeEmployee { Title, Role, Pole, Month, Message, Highlights, PhotoUrl }
        Ensure-BbiList -Title 'Employés du mois' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Poste'        -InternalName 'Role'       -Type Text
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Pôle'         -InternalName 'Pole'       -Type Text
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Mois'         -InternalName 'Month'      -Type Text
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'En cours'     -InternalName 'IsCurrent'  -Type Boolean
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Motivation'   -InternalName 'Message'    -Type Note
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Faits marquants' -InternalName 'Highlights' -Type Text
        Ensure-BbiField -List 'Employés du mois' -DisplayName 'Photo (URL)'  -InternalName 'PhotoUrl'   -Type Hyperlink
        Ensure-BbiView  -List 'Employés du mois' -Title 'Mises à l''honneur' -Fields @('Title','Role','Pole','Month','IsCurrent') `
            -Query '<OrderBy><FieldRef Name="Created" Ascending="FALSE"/></OrderBy>'

        # --- Certifications : IHomeCertification { Title, Issuer, Scope, ValidUntil, Status }
        Ensure-BbiList -Title 'Certifications' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Certifications' -DisplayName 'Organisme'   -InternalName 'Issuer'     -Type Text
        Ensure-BbiField -List 'Certifications' -DisplayName 'Périmètre'   -InternalName 'Scope'      -Type Note
        Ensure-BbiField -List 'Certifications' -DisplayName 'Valable jusqu''au' -InternalName 'ValidUntil' -Type DateTime
        Ensure-BbiField -List 'Certifications' -DisplayName 'Statut'      -InternalName 'Status'     -Type Text
        Ensure-BbiView  -List 'Certifications' -Title 'Certifications & agréments' -Fields @('Title','Issuer','ValidUntil','Status') `
            -Query '<OrderBy><FieldRef Name="Created"/></OrderBy>'

        # --- Annonces : IHomeAnnouncement { Title, Message, Niveau, DateDebut, DateFin, LienUrl, Ordre }
        Ensure-BbiList -Title 'Annonces' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Annonces' -DisplayName 'Message'      -InternalName 'Message'   -Type Note
        Ensure-BbiField -List 'Annonces' -DisplayName 'Niveau'       -InternalName 'Niveau'    -Type Choice `
            -Choices @('Information','Important','Urgent')
        Ensure-BbiField -List 'Annonces' -DisplayName 'Date de début' -InternalName 'DateDebut' -Type DateTime
        Ensure-BbiField -List 'Annonces' -DisplayName 'Date de fin'   -InternalName 'DateFin'   -Type DateTime
        Ensure-BbiField -List 'Annonces' -DisplayName 'Lien (URL)'    -InternalName 'LienUrl'   -Type Hyperlink
        Ensure-BbiField -List 'Annonces' -DisplayName 'Ordre'         -InternalName 'Ordre'     -Type Number
        Ensure-BbiView  -List 'Annonces' -Title 'Annonces actives' -Fields @('Title','Niveau','DateDebut','DateFin') `
            -Query '<OrderBy><FieldRef Name="Ordre"/></OrderBy>'

        # --- Pensées du jour : IHomeThought { Title (citation), Auteur, DatePublication, Contexte }
        Ensure-BbiList -Title 'Pensées du jour' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Pensées du jour' -DisplayName 'Auteur'            -InternalName 'Auteur'          -Type Text
        Ensure-BbiField -List 'Pensées du jour' -DisplayName 'Date de publication' -InternalName 'DatePublication' -Type DateTime
        Ensure-BbiField -List 'Pensées du jour' -DisplayName 'Contexte'          -InternalName 'Contexte'        -Type Text
        Ensure-BbiView  -List 'Pensées du jour' -Title 'Toutes les citations' -Fields @('Title','Auteur','DatePublication') `
            -Query '<OrderBy><FieldRef Name="Title"/></OrderBy>'

        # --- Anniversaires : IHomeBirthday { Title (nom), Jour, Mois, Fonction, PhotoUrl, Message, Afficher }
        # RGPD : jour + mois uniquement — jamais l'année de naissance.
        Ensure-BbiList -Title 'Anniversaires' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Jour'      -InternalName 'Jour'      -Type Number
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Mois'      -InternalName 'Mois'      -Type Number
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Fonction'  -InternalName 'Fonction'  -Type Text
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Photo (URL)' -InternalName 'PhotoUrl' -Type Hyperlink
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Message'   -InternalName 'Message'   -Type Text
        Ensure-BbiField -List 'Anniversaires' -DisplayName 'Afficher'  -InternalName 'Afficher'  -Type Boolean
        Ensure-BbiView  -List 'Anniversaires' -Title 'Tous les anniversaires' -Fields @('Title','Jour','Mois','Fonction') `
            -Query '<OrderBy><FieldRef Name="Mois"/><FieldRef Name="Jour"/></OrderBy>'

        # --- Implantations : IHomeOffice { Title, EstSiege, Pays, Ville, Adresse, Telephone, Email, Responsable, LienCarte, Ordre }
        Ensure-BbiList -Title 'Implantations' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Implantations' -DisplayName 'Siège'        -InternalName 'EstSiege'    -Type Boolean
        Ensure-BbiField -List 'Implantations' -DisplayName 'Pays'         -InternalName 'Pays'        -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'Ville'        -InternalName 'Ville'       -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'Adresse'      -InternalName 'Adresse'     -Type Note
        Ensure-BbiField -List 'Implantations' -DisplayName 'Téléphone'    -InternalName 'Telephone'   -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'E-mail'       -InternalName 'Email'       -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'Responsable'  -InternalName 'Responsable' -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'Lien (carte)' -InternalName 'LienCarte'   -Type Hyperlink
        Ensure-BbiField -List 'Implantations' -DisplayName 'Ordre'        -InternalName 'Ordre'       -Type Number
        Ensure-BbiField -List 'Implantations' -DisplayName 'Site SharePoint' -InternalName 'SiteUrl'   -Type Hyperlink
        Ensure-BbiField -List 'Implantations' -DisplayName 'Couleur'         -InternalName 'Couleur'   -Type Text
        Ensure-BbiField -List 'Implantations' -DisplayName 'Initiales'       -InternalName 'Initiales' -Type Text
        Ensure-BbiView  -List 'Implantations' -Title 'Réseau complet' -Fields @('Title','EstSiege','Pays','Ville') `
            -Query '<OrderBy><FieldRef Name="Ordre"/></OrderBy>'

        # --- Nos références : IHomeClientReference { Title, LogoUrl, SiteWebUrl, Contact, Pays, Ville, Secteur, Ordre }
        Ensure-BbiList -Title 'Nos références' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Nos références' -DisplayName 'Logo (URL)'  -InternalName 'LogoUrl'    -Type Hyperlink
        Ensure-BbiField -List 'Nos références' -DisplayName 'Site web'    -InternalName 'SiteWebUrl' -Type Hyperlink
        Ensure-BbiField -List 'Nos références' -DisplayName 'Contact'     -InternalName 'Contact'    -Type Text
        Ensure-BbiField -List 'Nos références' -DisplayName 'Pays'        -InternalName 'Pays'       -Type Text
        Ensure-BbiField -List 'Nos références' -DisplayName 'Ville'       -InternalName 'Ville'      -Type Text
        Ensure-BbiField -List 'Nos références' -DisplayName 'Secteur'     -InternalName 'Secteur'    -Type Text
        Ensure-BbiField -List 'Nos références' -DisplayName 'Ordre'       -InternalName 'Ordre'      -Type Number
        Ensure-BbiView  -List 'Nos références' -Title 'Toutes les références' -Fields @('Title','Secteur','Pays','Ville') `
            -Query '<OrderBy><FieldRef Name="Ordre"/></OrderBy>'

        # --- Références pédagogiques : IHomePedagogicalReference { Title, Categorie, Auteur, Annee, LienUrl, Resume, Ordre }
        Ensure-BbiList -Title 'Références pédagogiques' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Catégorie' -InternalName 'Categorie' -Type Choice `
            -Choices @('Ouvrage','Norme','Méthode','Étude','Outil')
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Auteur'    -InternalName 'Auteur'  -Type Text
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Année'     -InternalName 'Annee'   -Type Number
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Lien (URL)' -InternalName 'LienUrl' -Type Hyperlink
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Résumé'    -InternalName 'Resume'  -Type Note
        Ensure-BbiField -List 'Références pédagogiques' -DisplayName 'Ordre'     -InternalName 'Ordre'   -Type Number
        Ensure-BbiView  -List 'Références pédagogiques' -Title 'Toutes les références' -Fields @('Title','Categorie','Auteur','Annee') `
            -Query '<OrderBy><FieldRef Name="Ordre"/></OrderBy>'

        # --- Formations : IFormation { Title, CodeFormation, Filiere, Modalite, DureeH, Niveau, StatutCatalogue }
        Ensure-BbiList -Title 'Formations' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Formations' -DisplayName 'Code formation' -InternalName 'CodeFormation'  -Type Text
        Ensure-BbiField -List 'Formations' -DisplayName 'Filière'        -InternalName 'Filiere'        -Type Text
        Ensure-BbiField -List 'Formations' -DisplayName 'Modalité'       -InternalName 'Modalite'       -Type Choice `
            -Choices @('Présentiel','Distanciel','Hybride')
        Ensure-BbiField -List 'Formations' -DisplayName 'Durée (heures)' -InternalName 'DureeH'         -Type Number
        Ensure-BbiField -List 'Formations' -DisplayName 'Niveau'         -InternalName 'Niveau'         -Type Choice `
            -Choices @('Débutant','Intermédiaire','Confirmé','Expert')
        Ensure-BbiField -List 'Formations' -DisplayName 'Statut catalogue' -InternalName 'StatutCatalogue' -Type Choice `
            -Choices @('Actif','En refonte','Archivé')
        Ensure-BbiField -List 'Formations' -DisplayName 'Description'     -InternalName 'Description'   -Type Note
        Ensure-BbiField -List 'Formations' -DisplayName 'Objectifs pédagogiques' -InternalName 'Objectifs' -Type Note
        Ensure-BbiField -List 'Formations' -DisplayName 'Programme'        -InternalName 'Programme'     -Type Note
        Ensure-BbiField -List 'Formations' -DisplayName 'Prérequis'        -InternalName 'Prerequis'     -Type Note
        Ensure-BbiField -List 'Formations' -DisplayName 'Public visé'      -InternalName 'PublicVise'    -Type Text
        Ensure-BbiField -List 'Formations' -DisplayName 'Formateurs référents' -InternalName 'FormateursReferents' -Type Text
        Ensure-BbiField -List 'Formations' -DisplayName 'Contact pédagogique'  -InternalName 'ContactReferent'     -Type Text
        Ensure-BbiView  -List 'Formations' -Title 'Catalogue actif' -Fields @('Title','CodeFormation','Filiere','Modalite','DureeH','Niveau') `
            -Query '<Where><Eq><FieldRef Name="StatutCatalogue"/><Value Type="Text">Actif</Value></Eq></Where><OrderBy><FieldRef Name="Title"/></OrderBy>'
        Ensure-BbiView  -List 'Formations' -Title 'Par filière' -Fields @('Title','CodeFormation','Filiere','Modalite') `
            -Query '<OrderBy><FieldRef Name="Filiere"/><FieldRef Name="Title"/></OrderBy>'

        # --- Offres : IOffer { Title, Pole, CodeOffre, Filiere, Format, Duree, PublicCible, Niveau, StatutCatalogue }
        Ensure-BbiList -Title 'Offres' -Template GenericList | Out-Null
        Ensure-BbiField -List 'Offres' -DisplayName 'Pôle'            -InternalName 'Pole'            -Type Choice `
            -Choices @('Formation','Conseil','Coaching')
        Ensure-BbiField -List 'Offres' -DisplayName 'Code'            -InternalName 'CodeOffre'       -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Filière'         -InternalName 'Filiere'         -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Format'          -InternalName 'Format'          -Type Choice `
            -Choices @('Présentiel','Distanciel','Hybride','Sur site client')
        Ensure-BbiField -List 'Offres' -DisplayName 'Durée'           -InternalName 'Duree'           -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Public cible'    -InternalName 'PublicCible'     -Type Text
        Ensure-BbiField -List 'Offres' -DisplayName 'Niveau'          -InternalName 'Niveau'          -Type Choice `
            -Choices @('Débutant','Intermédiaire','Confirmé','Expert')
        Ensure-BbiField -List 'Offres' -DisplayName 'Statut catalogue' -InternalName 'StatutCatalogue' -Type Choice `
            -Choices @('Actif','En refonte','Archivé')
        Ensure-BbiField -List 'Offres' -DisplayName 'Description'     -InternalName 'Description'     -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Objectifs'       -InternalName 'Objectifs'       -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Programme ou démarche' -InternalName 'Programme'  -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Prérequis'       -InternalName 'Prerequis'       -Type Note
        Ensure-BbiField -List 'Offres' -DisplayName 'Livrables'       -InternalName 'Livrables'       -Type Note
        Ensure-BbiView  -List 'Offres' -Title 'Catalogue actif' -Fields @('Title','Pole','CodeOffre','Filiere','Format','Duree','Niveau') `
            -Query '<Where><Eq><FieldRef Name="StatutCatalogue"/><Value Type="Text">Actif</Value></Eq></Where><OrderBy><FieldRef Name="Title"/></OrderBy>'
        Ensure-BbiView  -List 'Offres' -Title 'Par pôle' -Fields @('Title','Pole','CodeOffre','Filiere','Format','Duree') `
            -Query '<OrderBy><FieldRef Name="Pole"/><FieldRef Name="Title"/></OrderBy>'

        # --- Avis clients : formulaire de satisfaction envoyé après chaque séance (coaching, formation, conseil)
        Ensure-BbiList -Title 'Avis clients' -Template GenericList -Url 'Lists/AvisClients' | Out-Null
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Client ou entreprise' -InternalName 'Client'       -Type Text
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Pôle'                 -InternalName 'Pole'         -Type Choice `
            -Choices @('Formation','Conseil','Coaching')
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Offre ou séance'      -InternalName 'Seance'       -Type Text
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Date de la séance'    -InternalName 'DateSeance'   -Type DateTime
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Formateur ou coach'   -InternalName 'Formateur'    -Type Text
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Note globale (1 à 5)' -InternalName 'NoteGlobale'  -Type Number
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Note du contenu (1 à 5)' -InternalName 'NoteContenu' -Type Number
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Note de l''animation (1 à 5)' -InternalName 'NoteAnimation' -Type Number
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Note de l''organisation (1 à 5)' -InternalName 'NoteOrganisation' -Type Number
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Recommanderiez-vous BBI ? (0 à 10)' -InternalName 'Recommandation' -Type Number
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Points forts'         -InternalName 'PointsForts'  -Type Note
        Ensure-BbiField -List 'Avis clients' -DisplayName 'À améliorer'          -InternalName 'Ameliorations' -Type Note
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Commentaire libre'    -InternalName 'Commentaire'  -Type Note
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Témoignage autorisé'  -InternalName 'AutoriseTemoignage' -Type Boolean
        Ensure-BbiField -List 'Avis clients' -DisplayName 'Source'               -InternalName 'Source'       -Type Choice `
            -Choices @('Microsoft Forms','Formulaire SharePoint','Papier','Autre')
        Ensure-BbiView  -List 'Avis clients' -Title 'Tous les avis' -Fields @('Title','Client','Pole','Seance','DateSeance','NoteGlobale','Recommandation') `
            -Query '<OrderBy><FieldRef Name="DateSeance" Ascending="FALSE"/></OrderBy>'
        Ensure-BbiView  -List 'Avis clients' -Title 'Par pôle' -Fields @('Title','Pole','Seance','Formateur','NoteGlobale','Recommandation') `
        -Query '<OrderBy><FieldRef Name="Pole"/><FieldRef Name="DateSeance" Ascending="FALSE"/></OrderBy>'

        # ==================================================================
        # 3. BIBLIOTHÈQUES DOCUMENTAIRES
        # ==================================================================
        Write-Title "${StepPrefix}3/10 · Bibliothèques"

        # --- Supports publiés (lecture seule côté apprenants)
        Ensure-BbiList -Title 'Supports publiés' -Template DocumentLibrary | Out-Null
        Ensure-BbiField -List 'Supports publiés' -DisplayName 'Code formation' -InternalName 'CodeFormation' -Type Text
        Ensure-BbiField -List 'Supports publiés' -DisplayName 'Type de support' -InternalName 'TypeSupport'  -Type Choice `
            -Choices @('Slides animateur','Manuel participant','Exercices','Évaluation','Vidéo','Modèle')
        Ensure-BbiField -List 'Supports publiés' -DisplayName 'Statut' -InternalName 'StatutSupport' -Type Choice `
            -Choices @('Brouillon','À valider','Publié','À réviser')
        Ensure-BbiField -List 'Supports publiés' -DisplayName 'Date de validité' -InternalName 'DateValidite' -Type DateTime
        Ensure-BbiField -List 'Supports publiés' -DisplayName 'Formateur auteur' -InternalName 'FormateurAuteur' -Type Text
        Ensure-BbiView  -List 'Supports publiés' -Title 'Récemment publiés' -Fields @('DocIcon','Title','CodeFormation','TypeSupport','Modified') `
            -Query '<OrderBy><FieldRef Name="Modified" Ascending="FALSE"/></OrderBy>' -RowLimit 10
        Ensure-BbiView  -List 'Supports publiés' -Title 'Par formation' -Fields @('DocIcon','Title','TypeSupport','StatutSupport','Modified') `
            -Query '<OrderBy><FieldRef Name="CodeFormation"/><FieldRef Name="Title"/></OrderBy>'

        # --- Galerie médias (bibliothèque d'images alimentant la web part BBI Galerie médias)
        Ensure-BbiList -Title 'Galerie médias' -Template PictureLibrary | Out-Null
        Ensure-BbiField -List 'Galerie médias' -DisplayName 'Album'    -InternalName 'Album'     -Type Choice `
            -Choices @('Sessions de formation','Vie BBI','Certifications','Coulisses','Événements')
        Ensure-BbiField -List 'Galerie médias' -DisplayName 'Lieu'      -InternalName 'Lieu'      -Type Text
        Ensure-BbiField -List 'Galerie médias' -DisplayName 'Crédit photo' -InternalName 'Credit' -Type Text
        Ensure-BbiField -List 'Galerie médias' -DisplayName 'Date de la photo' -InternalName 'DatePhoto' -Type DateTime
        Ensure-BbiField -List 'Galerie médias' -DisplayName 'Lien vidéo (URL)' -InternalName 'LienVideo' -Type Hyperlink
        Ensure-BbiView  -List 'Galerie médias' -Title 'Albums' -Fields @('DocIcon','Title','Album','Lieu','DatePhoto') `
            -Query '<OrderBy><FieldRef Name="Album"/><FieldRef Name="DatePhoto" Ascending="FALSE"/></OrderBy>'
        Ensure-BbiView  -List 'Galerie médias' -Title 'Derniers ajouts' -Fields @('DocIcon','Title','Album','Lieu','Modified') `
            -Query '<OrderBy><FieldRef Name="Modified" Ascending="FALSE"/></OrderBy>'

        # --- Documents administratifs : IHomeAdminDocument { Title, Categorie, Public, Reference, DateValidite }
        # Bibliothèque distincte de « Supports publiés » (pédagogique) : RH, juridique, finance, qualité, modèles.
        Ensure-BbiList -Title 'Documents administratifs' -Template DocumentLibrary | Out-Null
        Ensure-BbiField -List 'Documents administratifs' -DisplayName 'Catégorie' -InternalName 'Categorie' -Type Choice `
            -Choices @('RH','Juridique','Finance','Qualité','Modèles')
        Ensure-BbiField -List 'Documents administratifs' -DisplayName 'Public' -InternalName 'Public' -Type Choice `
            -Choices @('Tous','Formateurs','Direction')
        Ensure-BbiField -List 'Documents administratifs' -DisplayName 'Référence' -InternalName 'Reference' -Type Text
        Ensure-BbiField -List 'Documents administratifs' -DisplayName 'Date de validité' -InternalName 'DateValidite' -Type DateTime
        Ensure-BbiView  -List 'Documents administratifs' -Title 'Récemment publiés' -Fields @('DocIcon','Title','Categorie','Public','Modified') `
            -Query '<OrderBy><FieldRef Name="Modified" Ascending="FALSE"/></OrderBy>' -RowLimit 12
        Ensure-BbiView  -List 'Documents administratifs' -Title 'Par catégorie' -Fields @('DocIcon','Title','Categorie','Reference','Modified') `
            -Query '<OrderBy><FieldRef Name="Categorie"/><FieldRef Name="Title"/></OrderBy>'

        # ==================================================================
        # 4. SÉCURISATION DE LA BIBLIOTHÈQUE « SUPPORTS PUBLIÉS »
        # ==================================================================
        Write-Title "${StepPrefix}4/10 · Sécurité documentaire (lecture seule par défaut)"
        if ($DryRun -or $VerifyOnly) {
            Write-Step "[SIMULATION] héritage rompu sur « Supports publiés » + contribution réservée à $EditorsGroup"
        } else {
            try {
                Set-PnPList -Identity 'Supports publiés' -BreakRoleInheritance -CopyRoleAssignments | Out-Null
                Write-Ok "Héritage rompu : les apprenants conservent la Lecture."
                try {
                    Set-PnPListPermission -Identity 'Supports publiés' -Group 'Membres du site' -RemoveRole 'Contribute','Edit' -ErrorAction SilentlyContinue
                    Set-PnPListPermission -Identity 'Supports publiés' -Group 'Visiteurs' -RemoveRole 'Contribute','Edit' -ErrorAction SilentlyContinue
                } catch { Write-Warn2 "Ajustement des rôles par défaut ignoré : $($_.Exception.Message)" }
                try {
                    Set-PnPListPermission -Identity 'Supports publiés' -Group $EditorsGroup -AddRole 'Contribute'
                    Write-Ok "Contribution limitée au groupe « $EditorsGroup »."
                } catch {
                    Write-Warn2 "Groupe « $EditorsGroup » introuvable : accordez la contribution manuellement (Paramètres de la bibliothèque > Autorisations)."
                }
                Add-Report 'Sécurité « Supports publiés »' 'OK'
            } catch {
                Write-Warn2 "Sécurité non appliquée automatiquement : $($_.Exception.Message)"
                Add-Report 'Sécurité « Supports publiés »' 'À FAIRE' 'Voir README § Sécurité'
            }
        }

        # ==================================================================
        # 5. PAGES + WEB PARTS
        # ==================================================================
        Write-Title "${StepPrefix}5/10 · Pages et web parts"
        Write-Step "Astuce : les propriétés ci-dessous correspondent aux réglages recommandés (modifiables ensuite dans le volet Propriétés)."

        $homePropsTable = @{
            siteUrl               = $DataUrl
            newsListTitle         = 'Actualites'
            sessionsListTitle     = 'Sessions'
            trainersListTitle     = 'Formateurs'
            formationsListTitle   = 'Formations'
            offersListTitle       = 'Offres'
            documentsLibraryTitle = 'Supports publiés'
            galleryLibraryTitle   = 'Galerie médias'
            employeeListTitle     = 'Employés du mois'
            certificationsListTitle = 'Certifications'
            announcementsListTitle = 'Annonces'
            thoughtsListTitle     = 'Pensées du jour'
            birthdaysListTitle    = 'Anniversaires'
            officesListTitle      = 'Implantations'
            clientReferencesListTitle = 'Nos références'
            pedagogicalReferencesListTitle = 'Références pédagogiques'
            adminDocumentsLibraryTitle = 'Documents administratifs'
            maxItems              = 6
            enableGallery         = $true
            enableAnnouncement    = $true
            layoutCompact         = $false
            heroEyebrow           = 'Business Builders International'
            heroTitle             = "Renforcer les capacités de vos équipes et de vos organisations."
            heroSubtitle          = "Formation, conseil et coaching pour transformer vos ambitions en résultats durables."
            heroSlides            = " | Business Builders International | Renforcer les capacités de vos équipes et de vos organisations. | Formation, conseil et coaching pour transformer vos ambitions en résultats durables. | Découvrir nos offres | #offres`n | Notre méthode | Des accompagnements conçus pour le terrain. | Des mises en situation concrètes, des experts certifiés et un suivi à 30 jours. | Voir les sessions et missions | #sessions`n | Réseau international | 9 pays, une même exigence de qualité. | Un référentiel pédagogique unique et des antennes locales dans chaque région. | Découvrir nos implantations | #implantations`n | Qualité certifiée | Qualiopi, un gage de confiance. | Des process audités et une amélioration continue au service de vos financeurs. | Voir les certifications | #vie-equipe"
            primaryCtaLabel       = 'Découvrir nos offres'
            primaryCtaUrl         = '#offres'
            secondaryCtaLabel     = 'Voir les sessions et missions'
            secondaryCtaUrl       = '#sessions'
            navLinks              = "# Accueil | #accueil`n# Nos offres | #offres`n# Sessions & missions | #sessions`n# Actualités | #actualites`n# Ressources | #ressources`n# Communauté | #communaute"
            quickLinks            = "▦ | Nos offres | Formation, conseil et coaching | #offres`n◆ | Références pédagogiques | Ouvrages, normes, méthodes et outils | #formations`n▣ | Prochaines sessions | Planning et inscriptions | #sessions`n▤ | Supports & médias | Documents, photos et vidéos | #ressources`n◈ | Nos implantations | Siège, filiales et antennes | #implantations`n◎ | Communauté BBI | Formateurs et experts | #communaute`n✦ | Actualités BBI | Les nouvelles du réseau | #actualites"
            kpis                  = "1 500+ | Professionnels accompagnés`n3 | Pôles : formation, conseil, coaching`n9 | Pays couverts par le réseau`n96 % | De satisfaction constatée"
            visionText            = "Être le partenaire de référence du renforcement de capacités des dirigeants, des équipes et des organisations en Afrique et au-delà."
            missionText           = "Accompagner nos clients par la formation, le conseil et le coaching, pour transformer leurs compétences en résultats durables."
            objectivesText        = "Proposer trois pôles d'expertise complémentaires : formation, conseil et coaching`nMesurer l'impact de chaque accompagnement sur le terrain`nPartager un référentiel de qualité commun à tout le réseau`nRenforcer la présence locale dans chaque pays d'implantation"
        }
        # Contact support (en haut à droite de la page) : lu dans le fichier d'environnement, sinon laissé tel quel.
        if ($BbiEnv -and "$($BbiEnv.supportEmail)".Trim()) { $homePropsTable.supportEmail = "$($BbiEnv.supportEmail)".Trim() }
        if ($BbiEnv -and "$($BbiEnv.supportPhone)".Trim()) { $homePropsTable.supportPhone = "$($BbiEnv.supportPhone)".Trim() }
        # Satisfaction : lien du formulaire envoyé après chaque séance (Microsoft Forms) et lien vers les avis reçus.
        $avisUrl = "$($TargetUrl.TrimEnd('/'))/Lists/AvisClients/AllItems.aspx"
        $satisfactionLinks = ''
        if ($BbiEnv -and "$($BbiEnv.satisfactionFormUrl)".Trim()) { $satisfactionLinks += "`n★ | Formulaire de satisfaction | À envoyer après chaque séance | $("$($BbiEnv.satisfactionFormUrl)".Trim())" }
        $satisfactionLinks += "`n★ | Avis clients | Notes et recommandations reçues | $avisUrl"
        $homePropsTable.quickLinks = "$($homePropsTable.quickLinks)$satisfactionLinks"
        $homeProps = $homePropsTable | ConvertTo-Json -Compress

        # --- Page d'accueil : page APPLICATIVE (aucun en-tête, aucune navigation)
        Ensure-BbiPage -Name 'accueil' -Title 'Accueil' -LayoutType 'SingleWebPartAppPage' | Out-Null
        $keepWebPart = $false
        if ($PreserveWebPart) {
            try {
                # PnP.Core IPageWebPart : l'identifiant du composant est exposé par WebPartId
                $keepWebPart = @(Get-PnPPageComponent -Page 'accueil.aspx' -ErrorAction SilentlyContinue |
                    Where-Object { "$($_.WebPartId)".Trim('{', '}') -eq $WP_HOME }).Count -gt 0
            } catch {
                $keepWebPart = $false
            }
        }
        if ($keepWebPart) {
            Write-Host "  · ${StepPrefix}web part BBI Accueil déjà en place (propriétés conservées)" -ForegroundColor DarkGray
            Add-Report "Web part BBI Accueil (plein écran) → accueil.aspx" 'OK' 'propriétés conservées'
        } else {
            Ensure-BbiWebPart -Page 'accueil.aspx' -ComponentId $WP_HOME -PropertiesJson $homeProps -Name 'BBI Accueil (plein écran)'
        }

        # --- Le portail utilise une seule page SharePoint : les destinations du menu
        #     (formations, sessions, actualités, ressources, communauté) sont des vues
        #     internes pilotées par la web part BBI Accueil, sans pages .aspx séparées.

        # --- Page d'accueil du site = accueil.aspx
        if (-not $DryRun -and -not $VerifyOnly) {
            Invoke-Bbi "Définition de accueil.aspx comme page d'accueil du site" {
                Set-PnPHomePage -RootFolderRelativeUrl 'SitePages/accueil.aspx'
            } | Out-Null
            Add-Report 'Page d''accueil du site' 'OK'
        }

        # --- Extension « BBI Plein écran » : rend la page applicative réellement bord à bord
        Ensure-BbiCustomAction -Name 'BbiFullScreen' -Title 'BBI Plein écran' -ComponentId $EXT_FULLSCREEN `
            -PropertiesJson (@{
                mode            = 'appPage'
                edgeToEdge      = $true
                hidePageTitle   = $true
                hideCommandBar  = $false
            } | ConvertTo-Json -Compress)
    } finally {
        $script:DataSiteUrl = $previousDataSite
    }
}

# ==================================================================
# 1. CONNEXION
# ==================================================================
Write-Title "1/10 · Connexion à SharePoint"
if (-not $DryRun -and -not $VerifyOnly) {
    Connect-BbiSite -Url $SiteUrl
    Write-Ok "Connecté à $SiteUrl"
} else {
    Write-Step "Mode simulation/audit : connexion requise pour l'analyse, aucune écriture."
    Connect-BbiSite -Url $SiteUrl
}
if ($script:DataSiteUrl -ne $SiteUrl) {
    Write-Step "Les listes métier seront créées sur : $($script:DataSiteUrl)"
}

Invoke-BbiSiteProvisioning -TargetUrl $SiteUrl -DataUrl $script:DataSiteUrl -SeedDemo:$SeedDemoData

# ==================================================================
# 6. HUB ET SITES DE FILIALE (liste Implantations → un site d'équipe par filiale)
# ==================================================================
if ($ProvisionFiliales) {
    Write-Title "6/10 · Hub et filiales"
    if (-not $HubEnabled) {
        Write-Warn2 "hubEnabled = false dans bbi-environnement.json : section ignorée."
    } else {
        $hubUrl = $SiteUrl.TrimEnd('/')
        if ((Get-PnPConnection).Url.TrimEnd('/') -ne $hubUrl) { Connect-BbiSite -Url $hubUrl }

        # 6.1 Hub
        $hub = try { Get-PnPHubSite -Identity $hubUrl -ErrorAction Stop } catch { $null }
        if ($hub) {
            Write-Skip "Site hub $hubUrl"
            Add-Report 'Site hub' 'OK'
        } else {
            Invoke-Bbi "Enregistrement de $hubUrl comme site hub" {
                Register-PnPHubSite -Site $hubUrl | Out-Null
            } | Out-Null
            Add-Report 'Site hub' ($(if ($DryRun -or $VerifyOnly) { 'MANQUANT' } else { 'CRÉÉ' }))
        }
        $hubIds = @()
        if ($hub) { $hubIds = @("$($hub.ID)", "$($hub.SiteId)") | Where-Object { $_ -and $_ -ne [Guid]::Empty.ToString() } }

        # 6.2 Filiales
        $tenantRoot = ([uri]$hubUrl).GetLeftPart([UriPartial]::Authority)
        $filialeSites = @()
        $hubRow = $null
        if (Get-BbiList -Title 'Implantations') {
            $allRows = @(Get-PnPListItem -List 'Implantations' -PageSize 200)
            $hubRow = $allRows | Where-Object { [bool]$_['EstSiege'] } | Select-Object -First 1
            $rows = $allRows |
                Where-Object { -not [bool]$_['EstSiege'] } |
                Sort-Object { [int]($_['Ordre'] ?? 9999) }
            if (-not $rows) { Write-Warn2 "Aucune filiale dans « Implantations » (lignes avec Siège décoché)." }

            if ($hubRow -and -not $hubRow['SiteUrl']?.Url) {
                Invoke-Bbi "Siège : SiteUrl ← $hubUrl" { Set-PnPListItem -List 'Implantations' -Identity $hubRow.Id -Values @{ SiteUrl = "$hubUrl, $($hubRow['Title'])" } | Out-Null } | Out-Null
            }

            $filialeFilter = @()
            if ($Filiale) { $filialeFilter = @($Filiale | ForEach-Object { ConvertTo-BbiSlug -Value $_ } | Where-Object { $_ }) }
            $usedSlugs = @{}
            foreach ($row in $rows) {
                $title = "$($row['Title'])"
                try {
                    # Le slug (alias et URL du site) vient de Ville uniquement : pas de repli sur le titre.
                    $ville = "$($row['Ville'])"
                    $slug  = ConvertTo-BbiSlug -Prefix $FilialePrefix -Value $ville
                    if (-not $slug) {
                        Write-Warn2 "Ligne $($row.Id) « $title » : Ville vide, ignorée (le slug du site vient de Ville)."
                        Add-Report "Site filiale $title" 'IGNORÉ' 'Ville vide'
                        continue
                    }
                    if ($filialeFilter.Count -gt 0 -and $filialeFilter -notcontains (ConvertTo-BbiSlug -Value $ville)) {
                        Write-Host "  · « $title » ($ville) hors du filtre -Filiale, ignorée" -ForegroundColor DarkGray
                        continue
                    }
                    if ($usedSlugs.ContainsKey($slug)) {
                        Write-Warn2 "Ligne $($row.Id) « $title » : Ville en double avec « $($usedSlugs[$slug]) », ignorée."
                        Add-Report "Site filiale $title" 'IGNORÉ' "Ville en double avec $($usedSlugs[$slug])"
                        continue
                    }
                    $usedSlugs[$slug] = $title
                    $url = "$tenantRoot/sites/$slug"
                    # Site déjà créé lors d'un passage précédent (URL réelle écrite dans SiteUrl) : on la réutilise.
                    $known = "$($row['SiteUrl']?.Url)".TrimEnd('/')
                    if ($known -and $known -like "$tenantRoot/*" -and $known -ne $hubUrl) { $url = $known }

                    $existing = try { Get-PnPTenantSite -Url $url -ErrorAction Stop } catch { $null }
                    if ($existing) {
                        Write-Skip "Site $url"
                        Add-Report "Site filiale $title" 'OK' $url
                    } else {
                        $created = Invoke-Bbi "Création du site d'équipe « $title » ($url)" {
                            New-PnPSite -Type TeamSite -Title $title -Alias $slug -IsPublic:$false -Lcid 1036 -Wait
                        }
                        if ($created) { $url = "$created".TrimEnd('/') }
                        Add-Report "Site filiale $title" ($(if ($DryRun -or $VerifyOnly) { 'MANQUANT' } else { 'CRÉÉ' })) $url
                    }

                    if (-not $DryRun -and -not $VerifyOnly) {
                        if ($existing -and $hubIds.Count -gt 0 -and $hubIds -contains "$($existing.HubSiteId)") {
                            Write-Skip "Rattachement au hub de $url"
                        } else {
                            Invoke-Bbi "Rattachement de $url au hub" {
                                Add-PnPHubSiteAssociation -Site $url -HubSite $hubUrl
                            } | Out-Null
                        }
                        $current = "$($row['SiteUrl']?.Url)"
                        if ($current -notlike "$url*") {
                            Invoke-Bbi "« $title » : SiteUrl ← $url" {
                                Set-PnPListItem -List 'Implantations' -Identity $row.Id -Values @{ SiteUrl = "$url, $title" } | Out-Null
                            } | Out-Null
                        }
                    } else {
                        Write-Step "[SIMULATION] rattachement au hub + écriture de SiteUrl pour « $title »"
                    }
                    $filialeSites += [pscustomobject]@{ Title = $title; Url = $url; Ordre = [int]($row['Ordre'] ?? 9999); Existing = [bool]$existing }
                } catch {
                    Write-Warn2 "« $title » : $($_.Exception.Message)"
                    Add-Report "Site filiale $title" 'ÉCHEC' $_.Exception.Message
                }
            }
        } else {
            Write-Warn2 "Liste « Implantations » absente : filiales non évaluées."
            Add-Report 'Liste Implantations' 'MANQUANT'
        }

        # 6.3 Portail sur chaque filiale (listes vides → repli démo côté web part)
        $editors = @()
        try { $editors = Get-PnPGroupMember -Group $EditorsGroup -ErrorAction Stop } catch { Write-Warn2 "Groupe « $EditorsGroup » introuvable sur le hub : membres non recopiés." }
        foreach ($site in $filialeSites) {
            if ($DryRun) {
                Write-Step "[SIMULATION] portail BBI sur $($site.Url) (listes, bibliothèques, page accueil.aspx, web part)"
                continue
            }
            if ($VerifyOnly) {
                # Audit : en -VerifyOnly, Invoke-BbiSiteProvisioning ne fait que signaler les éléments MANQUANT.
                if (-not $site.Existing) {
                    Write-Step "[AUDIT] $($site.Url) n'existe pas encore : portail non audité"
                    continue
                }
                try {
                    Invoke-BbiSiteProvisioning -TargetUrl $site.Url -DataUrl $site.Url -SeedDemo:$false -StepPrefix "[$($site.Title)] "
                } catch {
                    Write-Warn2 "« $($site.Title) » : $($_.Exception.Message)"
                    Add-Report "Portail filiale $($site.Title)" 'ÉCHEC' $_.Exception.Message
                }
                continue
            }
            try {
                # Site déjà présent avant ce passage : la web part BBI Accueil et ses réglages sont conservés.
                Invoke-BbiSiteProvisioning -TargetUrl $site.Url -DataUrl $site.Url -SeedDemo:$false -StepPrefix "[$($site.Title)] " -PreserveWebPart:$site.Existing
                $members = Get-PnPGroup -AssociatedMemberGroup
                foreach ($m in $editors) {
                    Invoke-Bbi "« $($site.Title) » : $($m.LoginName) ← Membres" {
                        Add-PnPGroupMember -LoginName $m.LoginName -Group $members -ErrorAction SilentlyContinue
                    } | Out-Null
                }
            } catch {
                Write-Warn2 "« $($site.Title) » : $($_.Exception.Message)"
                Add-Report "Portail filiale $($site.Title)" 'ÉCHEC' $_.Exception.Message
            }
        }

        # 6.4 Navigation hub (= navigation supérieure du site hub) : siège puis filiales par Ordre
        if ((Get-PnPConnection).Url.TrimEnd('/') -ne $hubUrl) { Connect-BbiSite -Url $hubUrl }
        $hubNavTitle = 'Siège'
        if ($hubRow -and "$($hubRow['Title'])".Trim()) { $hubNavTitle = "$($hubRow['Title'])".Trim() }
        Ensure-BbiNavNode -Title $hubNavTitle -Url "$hubUrl/SitePages/accueil.aspx"
        foreach ($site in ($filialeSites | Sort-Object Ordre)) {
            Ensure-BbiNavNode -Title $site.Title -Url "$($site.Url)/SitePages/accueil.aspx"
        }
    }
}

# ==================================================================
# 7. THÈME, EN-TÊTE, LOGO
# ==================================================================
Write-Title "7/10 · Identité visuelle"
$palette = @{
    'themePrimary'     = '#0E265C'
    'themeLighterAlt'  = '#F4F6FA'
    'themeLighter'     = '#D8DEEC'
    'themeLight'       = '#B4C1DC'
    'themeTertiary'    = '#6B7FAC'
    'themeSecondary'   = '#2E4A86'
    'themeDarkAlt'     = '#0D2253'
    'themeDark'        = '#0B1C46'
    'themeDarker'      = '#081534'
    'neutralLighterAlt'= '#F8F9FA'
    'neutralLighter'   = '#F0F2F5'
    'neutralLight'     = '#E1E4EA'
    'neutralQuaternaryAlt' = '#D0D5DC'
    'neutralQuaternary'    = '#C0C6CF'
    'neutralTertiaryAlt'   = '#C8CDD5'
    'neutralTertiary'      = '#9AA1AB'
    'neutralSecondaryAlt'  = '#6E747D'
    'neutralSecondary'     = '#4A5058'
    'neutralPrimaryAlt'    = '#2F3339'
    'neutralPrimary'       = '#21252B'
    'neutralDark'          = '#14171B'
    'black'                = '#0B0D0F'
    'white'                = '#FFFFFF'
}

if ($DryRun -or $VerifyOnly) {
    Write-Step "[SIMULATION] thème « BBI Bleu nuit » + en-tête + logo"
} else {
    if (-not (Get-PnPTenantTheme -Name 'BBI Bleu nuit' -ErrorAction SilentlyContinue)) {
        Invoke-Bbi "Publication du thème « BBI Bleu nuit »" {
            Add-PnPTenantTheme -Identity 'BBI Bleu nuit' -Palette $palette -IsInverted $false
        } | Out-Null
        Add-Report 'Thème tenant' 'CRÉÉ'
    } else { Write-Skip "Thème « BBI Bleu nuit »" }

    Invoke-Bbi "Application du thème au site" {
        Set-PnPWebTheme -Theme 'BBI Bleu nuit' -WebUrl $SiteUrl
    } | Out-Null

    Invoke-Bbi "En-tête de site (compact) + logo BBI" {
        $web = Get-PnPWeb -Includes HeaderLayout, HeaderEmphasis, SiteLogoUrl
        $web.HeaderLayout   = 'Compact'
        $web.HeaderEmphasis = 'Strong'
        $web.Update()
        Invoke-PnPQuery
    } | Out-Null
}

# ==================================================================
# 8. NAVIGATION DU SITE
# ==================================================================
Write-Title "8/10 · Navigation"
# Retire les anciens raccourcis du menu qui menaient vers des pages .aspx séparées.
if (-not $DryRun -and -not $VerifyOnly) {
    $legacyNavTitles = @('Catalogue', 'Sessions', 'Galerie', "Vie d'entreprise", 'Support')
    $topNodes = Get-PnPNavigationNode -Location 'TopNavigationBar' -ErrorAction SilentlyContinue
    foreach ($node in ($topNodes | Where-Object { $legacyNavTitles -contains $_.Title })) {
        Invoke-Bbi "Retrait de l'ancien lien de navigation « $($node.Title) »" {
            Remove-PnPNavigationNode -Identity $node.Id -Force -ErrorAction Stop
        } | Out-Null
    }
}
# Avec -ProvisionFiliales, le nœud du siège (6.4) pointe déjà vers cette page : pas de doublon.
if (-not $ProvisionFiliales -and -not $SkipNavigation) {
    Ensure-BbiNavNode -Title 'BBI Intranet' -Url "$SiteUrl/SitePages/accueil.aspx"
}
# Le portail est mono-page : les autres vues sont des ancres/routes internes.

# ==================================================================
# 9. DONNÉES D'EXEMPLE
# ==================================================================
if ($SeedDemoData -and -not $DryRun -and -not $VerifyOnly) {
    Write-Title "9/10 · Données d'exemple"
    $today = Get-Date

    # Offres (formation, conseil, coaching)
    if ((Get-PnPListItem -List 'Offres' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des offres d'exemple" {
            $offres = @(
                @{ Title = "Management d'équipe"; Pole = 'Formation'; CodeOffre = 'BBI-FOR-101'; Filiere = 'Management'; Format = 'Présentiel'; Duree = '2 jours'; Niveau = 'Confirmé'; PublicCible = 'Managers de proximité' },
                @{ Title = 'Vendre la valeur, pas le prix'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-110'; Filiere = 'Commerce'; Format = 'Présentiel'; Duree = '1 jour'; Niveau = 'Débutant'; PublicCible = 'Équipes commerciales' },
                @{ Title = 'Prospection digitale'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-140'; Filiere = 'Digital'; Format = 'Distanciel'; Duree = '½ journée'; Niveau = 'Débutant'; PublicCible = 'Commerciaux et indépendants' },
                @{ Title = 'Fondamentaux Qualiopi'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-301'; Filiere = 'Qualité & Certification'; Format = 'Distanciel'; Duree = '1 jour'; Niveau = 'Intermédiaire'; PublicCible = 'Responsables qualité' },
                @{ Title = 'Leadership & gestion du changement'; Pole = 'Formation'; CodeOffre = 'BBI-FOR-210'; Filiere = 'Management'; Format = 'Hybride'; Duree = '3 jours'; Niveau = 'Confirmé'; PublicCible = 'Cadres dirigeants' },
                @{ Title = 'Diagnostic organisationnel'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-101'; Filiere = 'Organisation'; Format = 'Sur site client'; Duree = '3 à 6 semaines'; Niveau = 'Confirmé'; PublicCible = 'Directions générales' },
                @{ Title = "Structuration d'un dispositif de formation"; Pole = 'Conseil'; CodeOffre = 'BBI-CON-120'; Filiere = 'Ingénierie de formation'; Format = 'Hybride'; Duree = '2 à 4 mois'; Niveau = 'Confirmé'; PublicCible = 'Organismes et directions RH' },
                @{ Title = 'Accompagnement au changement'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-210'; Filiere = 'Organisation'; Format = 'Sur site client'; Duree = '3 à 9 mois'; Niveau = 'Expert'; PublicCible = 'Comités de direction' },
                @{ Title = 'Mise en conformité qualité (Qualiopi, ISO 21001)'; Pole = 'Conseil'; CodeOffre = 'BBI-CON-301'; Filiere = 'Qualité & Certification'; Format = 'Hybride'; Duree = '6 à 10 semaines'; Niveau = 'Confirmé'; PublicCible = 'Organismes de formation' },
                @{ Title = 'Coaching de dirigeants'; Pole = 'Coaching'; CodeOffre = 'BBI-COA-101'; Filiere = 'Leadership'; Format = 'Hybride'; Duree = '6 mois'; Niveau = 'Expert'; PublicCible = 'Dirigeants et cadres supérieurs' },
                @{ Title = "Coaching d'équipe"; Pole = 'Coaching'; CodeOffre = 'BBI-COA-120'; Filiere = 'Management'; Format = 'Présentiel'; Duree = '4 mois'; Niveau = 'Confirmé'; PublicCible = 'Équipes de direction' },
                @{ Title = "Cycle d'accompagnement d'entrepreneurs"; Pole = 'Coaching'; CodeOffre = 'BBI-COA-201'; Filiere = 'Entrepreneuriat'; Format = 'Hybride'; Duree = '6 mois'; Niveau = 'Intermédiaire'; PublicCible = 'Porteurs de projet' }
            )
            foreach ($offre in $offres) {
                $offre['StatutCatalogue'] = 'Actif'
                Add-PnPListItem -List 'Offres' -Values $offre | Out-Null
            }
        } | Out-Null
    }

    # Avis clients (satisfaction)
    if ((Get-PnPListItem -List 'Avis clients' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des avis clients d'exemple" {
            $avis = @(
                @{ Title = 'Exemple : avis 1'; Client = 'Entreprise cliente A'; Pole = 'Formation'; Seance = "Management d'équipe"; DateSeance = $today.AddDays(-12); Formateur = 'Claire Fontaine'; NoteGlobale = 5; NoteContenu = 5; NoteAnimation = 5; NoteOrganisation = 4; Recommandation = 10; PointsForts = 'Cas pratiques très concrets, rythme adapté.'; Ameliorations = 'Prévoir une demi-journée de plus.'; Commentaire = 'Nous referons appel à BBI pour toute notre équipe.'; AutoriseTemoignage = $true; Source = 'Microsoft Forms' },
                @{ Title = 'Exemple : avis 2'; Client = 'Entreprise cliente B'; Pole = 'Coaching'; Seance = 'Coaching de dirigeants'; DateSeance = $today.AddDays(-20); Formateur = 'Jean-Marc Okafor'; NoteGlobale = 5; NoteContenu = 5; NoteAnimation = 5; NoteOrganisation = 5; Recommandation = 10; PointsForts = 'Écoute, bienveillance et exigence.'; Ameliorations = ''; Commentaire = 'Un accompagnement qui change la façon de décider.'; AutoriseTemoignage = $true; Source = 'Microsoft Forms' },
                @{ Title = 'Exemple : avis 3'; Client = 'Entreprise cliente C'; Pole = 'Conseil'; Seance = 'Diagnostic organisationnel'; DateSeance = $today.AddDays(-35); Formateur = 'Awa Traoré'; NoteGlobale = 4; NoteContenu = 4; NoteAnimation = 4; NoteOrganisation = 4; Recommandation = 9; PointsForts = 'Restitution claire et plan d''action réaliste.'; Ameliorations = 'Partager le calendrier plus tôt.'; Commentaire = ''; AutoriseTemoignage = $false; Source = 'Formulaire SharePoint' },
                @{ Title = 'Exemple : avis 4'; Client = 'Entreprise cliente D'; Pole = 'Formation'; Seance = 'Fondamentaux Qualiopi'; DateSeance = $today.AddDays(-8); Formateur = 'Khadija Diallo'; NoteGlobale = 4; NoteContenu = 5; NoteAnimation = 4; NoteOrganisation = 3; Recommandation = 8; PointsForts = 'Contenu à jour.'; Ameliorations = 'Salle trop petite.'; Commentaire = 'Très utile, merci.'; AutoriseTemoignage = $false; Source = 'Papier' },
                @{ Title = 'Exemple : avis 5'; Client = 'Entreprise cliente E'; Pole = 'Coaching'; Seance = "Coaching d'équipe"; DateSeance = $today.AddDays(-3); Formateur = 'Claire Fontaine'; NoteGlobale = 5; NoteContenu = 4; NoteAnimation = 5; NoteOrganisation = 5; Recommandation = 9; PointsForts = 'Équipe plus soudée dès la deuxième séance.'; Ameliorations = ''; Commentaire = ''; AutoriseTemoignage = $true; Source = 'Microsoft Forms' }
            )
            foreach ($a in $avis) { Add-PnPListItem -List 'Avis clients' -Values $a | Out-Null }
        } | Out-Null
    }

    # Actualités
    if ((Get-PnPListItem -List 'Actualites' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des actualités d'exemple" {
            Add-PnPListItem -List 'Actualites' -Values @{
                Title = '13 nouveaux formateurs certifiés'
                Summary = "Trois jours d'apprentissage collectif et 100 % de réussite à la certification."
                Category = 'Certification'
                Published = $today.AddDays(-3)
                AuthorName = 'Direction pédagogique'
            } | Out-Null
            Add-PnPListItem -List 'Actualites' -Values @{
                Title = 'Le catalogue des formations évolue'
                Summary = 'Nouveaux parcours de management et de développement commercial.'
                Category = 'Formations'
                Published = $today.AddDays(-10)
                AuthorName = 'Équipe BBI'
            } | Out-Null
            Add-PnPListItem -List 'Actualites' -Values @{
                Title = 'Retour sur les ateliers de rentrée'
                Summary = 'Nouvelles méthodes pédagogiques et partage de pratiques.'
                Category = 'Vie BBI'
                Published = $today.AddDays(-18)
                AuthorName = 'Communication BBI'
            } | Out-Null
        } | Out-Null
    }

    # Sessions
    if ((Get-PnPListItem -List 'Sessions' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des sessions d'exemple" {
            Add-PnPListItem -List 'Sessions' -Values @{ Title = "Management d'équipe — Cohorte 7"; StartDate = $today.AddDays(7);  Modality = 'Présentiel'; Location = 'Paris';  Status = 'Inscriptions ouvertes' } | Out-Null
            Add-PnPListItem -List 'Sessions' -Values @{ Title = "Coaching d'entrepreneurs — Module 1"; StartDate = $today.AddDays(14); Modality = 'Distanciel'; Location = 'Teams';  Status = 'Webinaire' } | Out-Null
            Add-PnPListItem -List 'Sessions' -Values @{ Title = 'Atelier « Traiter les objections »';  StartDate = $today.AddDays(21); Modality = 'Présentiel'; Location = 'Lyon';   Status = '3 places' } | Out-Null
        } | Out-Null
    }

    # Formations
    if ((Get-PnPListItem -List 'Formations' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion du catalogue d'exemple" {
            $formations = @(
                @{ Title = "Management d'équipe";        CodeFormation = 'BBI-MGT-101'; Filiere = 'Management';            Modalite = 'Présentiel'; DureeH = 14; Niveau = 'Confirmé';      StatutCatalogue = 'Actif' },
                @{ Title = "Coaching d'entrepreneurs";   CodeFormation = 'BBI-COA-201'; Filiere = 'Coaching';              Modalite = 'Hybride';    DureeH = 28; Niveau = 'Expert';        StatutCatalogue = 'Actif' },
                @{ Title = 'Vendre la valeur, pas le prix'; CodeFormation = 'BBI-COM-110'; Filiere = 'Commerce';           Modalite = 'Présentiel'; DureeH = 7;  Niveau = 'Débutant';      StatutCatalogue = 'Actif' },
                @{ Title = 'Prospection digitale';       CodeFormation = 'BBI-DIG-140'; Filiere = 'Digital';               Modalite = 'Distanciel'; DureeH = 3.5; Niveau = 'Débutant';     StatutCatalogue = 'Actif' },
                @{ Title = 'Fondamentaux Qualiopi';      CodeFormation = 'BBI-QUA-301'; Filiere = 'Qualité & Certification'; Modalite = 'Distanciel'; DureeH = 7; Niveau = 'Intermédiaire'; StatutCatalogue = 'Actif' }
            )
            foreach ($f in $formations) { Add-PnPListItem -List 'Formations' -Values $f | Out-Null }
        } | Out-Null
    }

    # Formateurs (avec coordonnées : la fiche s'ouvre au clic dans le portail)
    if ((Get-PnPListItem -List 'Formateurs' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des formateurs d'exemple" {
            $formateurs = @(
                @{ Title = 'Amélie Martin';   Role = 'Responsable pédagogique'; Filiere = 'Management & Qualité';   Initials = 'AM'; Phone = '+33 6 12 45 78 90'; Email = 'amelie.martin@businessbuilders.fr'; WhatsApp = '+33612457890'; Location = 'Paris — Siège'; Bio = "Pilote l'ingénierie pédagogique du réseau et accompagne la montée en compétences des formateurs BBI."; Specialites = 'Management de proximité · Ingénierie pédagogique'; Certifications = 'Qualiopi · Coach professionnel (RNCP)'; Categorie = 'Formateur'; Ordre = 0 },
                @{ Title = 'Stéphane Laurent'; Role = 'Coach certifié';          Filiere = 'Coaching & leadership'; Initials = 'SL'; Phone = '+33 6 23 56 89 01'; Email = 'stephane.laurent@businessbuilders.fr'; WhatsApp = '+33623568901'; Location = 'Lyon'; Bio = "Coach certifié et ancien directeur commercial : posture, prise de parole et relation client."; Specialites = 'Coaching de dirigeants · Prise de parole'; Certifications = 'Coach certifié ICF · Process Communication'; Categorie = 'Formateur'; Ordre = 1 },
                @{ Title = 'Khadija Diallo';   Role = 'Formatrice';              Filiere = 'Commerce & négociation'; Initials = 'KD'; Phone = '+221 77 456 78 90'; Email = 'khadija.diallo@businessbuilders.fr'; WhatsApp = '+221774567890'; Location = 'Dakar — Antenne'; Bio = "Spécialiste de la négociation complexe, elle anime les parcours commerciaux sur le terrain."; Specialites = 'Négociation · Prospection terrain'; Certifications = 'Méthode BBI Vente · TOSA'; Categorie = 'Formateur'; Ordre = 2 },
                @{ Title = 'Thomas Bernard';   Role = 'Formateur';               Filiere = 'Digital & prospection'; Initials = 'TB'; Phone = '+33 6 34 67 90 12'; Email = 'thomas.bernard@businessbuilders.fr'; WhatsApp = '+33634679012'; Location = 'Paris — Siège'; Bio = "Ancien responsable growth : il outille les équipes commerciales et anime le module « Prospection digitale »."; Specialites = 'Prospection digitale · Outils CRM'; Certifications = 'Google Ads · HubSpot Academy'; Categorie = 'Formateur'; Ordre = 3 },
                @{ Title = 'Marie-Claire Ngoma'; Role = 'Consultante qualité';   Filiere = 'Qualité & certification'; Initials = 'MN'; Phone = '+225 07 12 34 56 78'; Email = 'marie-claire.ngoma@businessbuilders.fr'; WhatsApp = '+2250712345678'; Location = 'Abidjan — Antenne'; Bio = "Accompagne les organismes de formation dans leur mise en conformité Qualiopi."; Specialites = 'Qualiopi · Audit interne'; Certifications = 'Auditeur qualité certifié'; Categorie = 'Appui'; Ordre = 4 },
                @{ Title = 'Youssef El Amrani'; Role = 'Formateur';              Filiere = 'Leadership & changement'; Initials = 'YA'; Phone = '+33 6 45 78 01 23'; Email = 'youssef.elamrani@businessbuilders.fr'; WhatsApp = '+33645780123'; Location = 'Distanciel'; Bio = "Intervient sur les transformations d'organisation et la conduite du changement."; Specialites = 'Conduite du changement · Leadership'; Certifications = 'Méthode BBI Leadership'; Categorie = 'Formateur'; Ordre = 5 },
                @{ Title = 'Claire Fontaine';  Role = 'Coach certifiée';          Filiere = 'Coaching d''entrepreneurs'; Initials = 'CF'; Phone = '+33 6 56 89 12 34'; Email = 'claire.fontaine@businessbuilders.fr'; WhatsApp = '+33656891234'; Location = 'Paris — Siège'; Bio = "Accompagne les créateurs et repreneurs : structuration du projet et posture de dirigeant."; Specialites = 'Coaching entrepreneurial · Codéveloppement'; Certifications = 'Coach certifiée · Green Belt Lean'; Categorie = 'Formateur'; Ordre = 6 },
                @{ Title = 'Jean-Marc Okafor'; Role = 'Directeur pédagogique';   Filiere = 'Management'; Initials = 'JO'; Phone = '+33 6 67 90 23 45'; Email = 'jean-marc.okafor@businessbuilders.fr'; WhatsApp = '+33667902345'; Location = 'Paris — Siège'; Bio = "Fixe les orientations pédagogiques du réseau et garantit l'homogénéité des parcours."; Specialites = 'Stratégie pédagogique · Management'; Certifications = 'Qualiopi · MBA'; Categorie = 'Direction'; Ordre = 7 }
            )
            foreach ($formateur in $formateurs) { Add-PnPListItem -List 'Formateurs' -Values $formateur | Out-Null }
        } | Out-Null
    }

    # Annonces
    if ((Get-PnPListItem -List 'Annonces' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des annonces d'exemple" {
            Add-PnPListItem -List 'Annonces' -Values @{ Title = 'Nouvelle session Qualiopi programmée'; Message = "L'audit de surveillance Qualiopi se tiendra le mois prochain."; Niveau = 'Important'; DateDebut = $today.AddDays(-2); DateFin = $today.AddDays(28); Ordre = 1 } | Out-Null
            Add-PnPListItem -List 'Annonces' -Values @{ Title = 'Nouveau catalogue de formations en ligne'; Message = '10 nouveaux modules sont disponibles au catalogue.'; Niveau = 'Information'; Ordre = 2 } | Out-Null
        } | Out-Null
    }

    # Pensées du jour
    if ((Get-PnPListItem -List 'Pensées du jour' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des pensées du jour d'exemple" {
            Add-PnPListItem -List 'Pensées du jour' -Values @{ Title = "La qualité n'est jamais un accident ; elle est toujours le résultat d'un effort intelligent."; Auteur = 'John Ruskin'; Contexte = 'Exigence qualité' } | Out-Null
            Add-PnPListItem -List 'Pensées du jour' -Values @{ Title = 'Le seul véritable échec est de ne pas essayer.'; Auteur = 'George Clemenceau'; Contexte = 'Culture de progrès' } | Out-Null
            Add-PnPListItem -List 'Pensées du jour' -Values @{ Title = "Former, c'est allumer un feu, pas remplir un vase."; Auteur = 'Proverbe pédagogique'; Contexte = 'Pédagogie' } | Out-Null
        } | Out-Null
    }

    # Anniversaires (jour + mois uniquement — jamais l'année de naissance)
    if ((Get-PnPListItem -List 'Anniversaires' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des anniversaires d'exemple" {
            Add-PnPListItem -List 'Anniversaires' -Values @{ Title = 'Camille Durand'; Jour = 12; Mois = (Get-Date).Month; Fonction = 'Formatrice management'; Afficher = $true } | Out-Null
            Add-PnPListItem -List 'Anniversaires' -Values @{ Title = 'Yannick Oyono'; Jour = 24; Mois = (Get-Date).Month; Fonction = 'Responsable antenne Abidjan'; Afficher = $true } | Out-Null
        } | Out-Null
    }

    # Implantations
    if ((Get-PnPListItem -List 'Implantations' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des implantations d'exemple" {
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Siège — Paris'; EstSiege = $true; Pays = 'France'; Ville = 'Paris'; Adresse = '12 rue de la Croissance, 75008 Paris'; Telephone = '+33 1 45 67 89 00'; Email = 'contact@businessbuilders.fr'; Responsable = 'Jean-Marc Okafor'; Ordre = 0; Couleur = '#0E265C'; Initiales = 'SP' } | Out-Null
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Filiale Abidjan'; Pays = "Côte d'Ivoire"; Ville = 'Abidjan'; Telephone = '+225 05 98 76 54 32'; Email = 'abidjan@businessbuilders.fr'; Responsable = 'Khadija Diallo'; Ordre = 1; Couleur = '#C8102E'; Initiales = 'AB' } | Out-Null
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Antenne Bamako'; Pays = 'Mali'; Ville = 'Bamako'; Telephone = '+223 76 12 34 56'; Email = 'bamako@businessbuilders.fr'; Responsable = 'Awa Traoré'; Ordre = 2; Couleur = '#6B2D8B'; Initiales = 'BK' } | Out-Null
            Add-PnPListItem -List 'Implantations' -Values @{ Title = 'Antenne Dakar'; Pays = 'Sénégal'; Ville = 'Dakar'; Email = 'dakar@businessbuilders.fr'; Ordre = 3; Couleur = '#B5651D'; Initiales = 'DK' } | Out-Null
        } | Out-Null
    }

    # Nos références
    if ((Get-PnPListItem -List 'Nos références' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des références clients d'exemple" {
            Add-PnPListItem -List 'Nos références' -Values @{ Title = 'Groupe Atlantide'; Secteur = 'Banque & assurance'; Pays = 'France'; Ville = 'Paris'; Ordre = 0 } | Out-Null
            Add-PnPListItem -List 'Nos références' -Values @{ Title = 'Orbis Industries'; Secteur = 'Industrie'; Pays = "Côte d'Ivoire"; Ville = 'Abidjan'; Ordre = 1 } | Out-Null
            Add-PnPListItem -List 'Nos références' -Values @{ Title = 'Sahel Energies'; Secteur = 'Énergie'; Pays = 'Mali'; Ville = 'Bamako'; Ordre = 2 } | Out-Null
        } | Out-Null
    }

    # Références pédagogiques
    if ((Get-PnPListItem -List 'Références pédagogiques' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des références pédagogiques d'exemple" {
            Add-PnPListItem -List 'Références pédagogiques' -Values @{ Title = "Les 7 habitudes de ceux qui réalisent tout ce qu'ils entreprennent"; Categorie = 'Ouvrage'; Auteur = 'Stephen Covey'; Annee = 1989; Ordre = 0 } | Out-Null
            Add-PnPListItem -List 'Références pédagogiques' -Values @{ Title = "Norme ISO 21001 — Organismes d'éducation/formation"; Categorie = 'Norme'; Annee = 2018; Ordre = 1 } | Out-Null
            Add-PnPListItem -List 'Références pédagogiques' -Values @{ Title = 'Méthode BBI Leadership'; Categorie = 'Méthode'; Ordre = 2 } | Out-Null
        } | Out-Null
    }

    # Employé du mois
    if ((Get-PnPListItem -List 'Employés du mois' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion de l'employé du mois" {
            Add-PnPListItem -List 'Employés du mois' -Values @{
                Title      = 'Léa Marchand'
                Role       = 'Cheffe de projet e-learning'
                Pole       = 'Opérations & digital'
                Month      = (Get-Culture).DateTimeFormat.GetMonthName((Get-Date).Month) + ' ' + (Get-Date).Year
                IsCurrent  = $true
                Message    = "Léa a piloté la refonte complète des modules e-learning et la mise en ligne des capsules du studio en un trimestre. Un travail d'orfèvre sur la qualité pédagogique et l'accessibilité, salué par les formateurs comme par les apprenants."
                Highlights = '5 modules repensés · 100 % des vidéos sous-titrées · 4,9/5 auprès des apprenants'
            } | Out-Null
        } | Out-Null
    }

    # Certifications & agréments
    if ((Get-PnPListItem -List 'Certifications' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des certifications" {
            Add-PnPListItem -List 'Certifications' -Values @{ Title = 'Qualiopi — Actions de formation'; Issuer = 'Cofrac / Marque Qualité'; Scope = 'Certification qualité des actions de formation, obligatoire pour les financeurs publics.'; ValidUntil = $today.AddDays(210); Status = 'Certifié' } | Out-Null
            Add-PnPListItem -List 'Certifications' -Values @{ Title = 'Datadock'; Issuer = 'Uniformation'; Scope = 'Référencement des organismes de formation auprès des OPCO.'; ValidUntil = $today.AddDays(120); Status = 'Référencé' } | Out-Null
            Add-PnPListItem -List 'Certifications' -Values @{ Title = 'Certification BBI Formateur référent'; Issuer = 'Business Builders International'; Scope = 'Référentiel interne : ingénierie, animation, évaluation et posture.'; Status = '42 formateurs certifiés' } | Out-Null
            Add-PnPListItem -List 'Certifications' -Values @{ Title = 'Préparation TOSA / ICDL'; Issuer = 'Centre agréé'; Scope = 'Compétences numériques certifiées, éligibles au CPF.'; ValidUntil = $today.AddDays(300); Status = 'Centre agréé' } | Out-Null
        } | Out-Null
    }

    # Documents administratifs : bibliothèque de fichiers, jamais seedée ici (comme
    # « Supports publiés ») -- Add-PnPListItem sans fichier n'est pas supporté sur une
    # bibliothèque. Tant qu'aucun document n'est publié, le portail affiche les
    # documents de démonstration intégrés à la web part.
}

# ==================================================================
# 10. RAPPORT
# ==================================================================
# Contrôle des colonnes optionnelles attendues par les modèles de page
Write-Title "Contrôle des colonnes optionnelles (modèles de page)"
$optionalChecks = @(
    @{ List = 'Formations';  Field = 'Objectifs';          UsedBy = 'Fiche formation — Objectifs pédagogiques' },
    @{ List = 'Formations';  Field = 'Programme';          UsedBy = 'Fiche formation — Programme' },
    @{ List = 'Formations';  Field = 'Prerequis';          UsedBy = 'Fiche formation — Prérequis' },
    @{ List = 'Formations';  Field = 'FormateursReferents'; UsedBy = 'Fiche formation — Formateurs référents' },
    @{ List = 'Actualites';  Field = 'Body';               UsedBy = "Article d'actualité — Corps de l'article" },
    @{ List = 'Sessions';    Field = 'EndDate';            UsedBy = 'Sessions — date de fin (agenda)' },
    @{ List = 'Sessions';    Field = 'Trainer';            UsedBy = 'Sessions — « animé par » dans la fiche formateur' },
    @{ List = 'Formateurs';  Field = 'PhotoUrl';           UsedBy = 'Annuaire — photo du formateur' },
    @{ List = 'Formateurs';  Field = 'Phone';              UsedBy = 'Fiche formateur — téléphone' },
    @{ List = 'Formateurs';  Field = 'Email';              UsedBy = 'Fiche formateur — e-mail et Teams' },
    @{ List = 'Formateurs';  Field = 'WhatsApp';           UsedBy = 'Fiche formateur — WhatsApp' },
    @{ List = 'Formateurs';  Field = 'Location';           UsedBy = 'Fiche formateur — localisation' },
    @{ List = 'Formateurs';  Field = 'Bio';                UsedBy = 'Fiche formateur — biographie' },
    @{ List = 'Formateurs';  Field = 'Specialites';        UsedBy = 'Fiche formateur — spécialités' },
    @{ List = 'Formateurs';  Field = 'Certifications';     UsedBy = 'Fiche formateur — certifications' },
    @{ List = 'Formateurs';  Field = 'Categorie';          UsedBy = 'Trombinoscope — filtre par catégorie' },
    @{ List = 'Formateurs';  Field = 'Ordre';              UsedBy = 'Trombinoscope — ordre d''affichage' },
    @{ List = 'Annonces';    Field = 'Niveau';             UsedBy = 'Bandeau d''annonces — niveau d''urgence' },
    @{ List = 'Annonces';    Field = 'DateDebut';          UsedBy = 'Bandeau d''annonces — fenêtre de diffusion' },
    @{ List = 'Implantations'; Field = 'EstSiege';         UsedBy = 'Implantations — siège affiché en premier' },
    @{ List = 'Implantations'; Field = 'SiteUrl';   UsedBy = 'Cartes de sites — bouton « Ouvrir le site »' },
    @{ List = 'Implantations'; Field = 'Couleur';   UsedBy = 'Cartes de sites — couleur du bandeau' },
    @{ List = 'Implantations'; Field = 'Initiales'; UsedBy = 'Cartes de sites — carré logo' },
    @{ List = 'Références pédagogiques'; Field = 'Categorie'; UsedBy = 'Références pédagogiques — regroupement par catégorie' }
)
foreach ($check in $optionalChecks) {
    if (Test-BbiField -List $check.List -InternalName $check.Field) {
        Write-Ok "  $($check.List).$($check.Field)"
        Add-Report "Colonne $($check.List)/$($check.Field)" 'OK' $check.UsedBy
    } else {
        Write-Warn2 "  $($check.List).$($check.Field) absent — $($check.UsedBy)"
        Add-Report "Colonne $($check.List)/$($check.Field)" 'MANQUANT' $check.UsedBy
    }
}

Write-Title "10/10 · Rapport"
if ($VerifyOnly -or $DryRun) {
    $missing = $script:Report | Where-Object { $_.Statut -eq 'MANQUANT' }
    if ($missing.Count -eq 0) {
        Write-Ok "Configuration conforme : tout est en place."
    } else {
        Write-Warn2 "$($missing.Count) élément(s) manquant(s) :"
        $missing | ForEach-Object { Write-Host "     - $($_.Element)" -ForegroundColor Yellow }
    }
} else {
    Write-Ok "$($script:Changes) action(s) appliquée(s)."
}

Write-Host ""
Write-Host "Composants attendus sur le site (solution bbi-intranet 1.3.0.0) :" -ForegroundColor White
Write-Host "  Accueil plein écran · Catalogue · Fiche formation (modèle) · Sessions & inscriptions ·" -ForegroundColor Gray
Write-Host "  Article d'actualité (modèle) · Galerie médias · Supports publiés · extension BBI Plein écran" -ForegroundColor Gray
if ($ProvisionFiliales) {
    Write-Host "Hub et filiales : relancez avec -VerifyOnly -ProvisionFiliales pour auditer ; ajoutez une ligne dans « Implantations » puis relancez pour créer un nouveau site." -ForegroundColor Gray
}
Write-Host ""
Write-Host "Étapes suivantes recommandées :" -ForegroundColor White
Write-Host "  1. Activez les étiquettes de confidentialité + IRM « afficher uniquement » sur « Supports publiés »." -ForegroundColor Gray
Write-Host "  2. Réglez « Ouvrir dans le navigateur » par défaut sur la bibliothèque des supports." -ForegroundColor Gray
Write-Host "  3. Ajoutez vos photos dans « Galerie médias » et renseignez la colonne Album." -ForegroundColor Gray
Write-Host "  4. Personnalisez le héros : volet Propriétés de la web part BBI Accueil (page accueil.aspx)." -ForegroundColor Gray
Write-Host "  5. Testez la page d'accueil sur mobile et tablette, puis dans Teams (onglet Viva Connections)." -ForegroundColor Gray
Write-Host "  6. Déployez les applications Teams : teams/New-BbiTeamsPackage.ps1 (voir teams/README.md)." -ForegroundColor Gray
Write-Host ""
Write-Host "Détail : voir deploy/README.md" -ForegroundColor Gray
