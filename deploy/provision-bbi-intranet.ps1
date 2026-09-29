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
      8. jeu de données d'exemple (optionnel) pour valider immédiatement.

    Le script est IDEMPOTENT : relancez-le autant de fois que nécessaire, il ne recrée
    pas ce qui existe déjà. Utilisez -DryRun pour simuler sans rien modifier.

.PREREQUIS
    PnP.PowerShell 2.x :  Install-Module PnP.PowerShell -Scope CurrentUser
    Droits : administrateur SharePoint (propriétaire du site au minimum).
    La solution bbi-intranet.sppkg doit être déployée dans le catalogue d'applications.

.EXEMPLES
    # Simulation (aucune modification)
    .\provision-bbi-intranet.ps1 -DryRun

    # Provisionnement complet + données d'exemple
    .\provision-bbi-intranet.ps1 -SeedDemoData

    # Audit uniquement : vérifie que tout est conforme au code SPFx
    .\provision-bbi-intranet.ps1 -VerifyOnly

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
    [switch]$VerifyOnly
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------------
# Environnement (tenant + site) — source unique : bbi-environnement.json
# ------------------------------------------------------------------
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvironmentFile = Join-Path (Split-Path -Parent $scriptRoot) 'bbi-environnement.json'

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
        [switch]$OnQuickLaunch
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
        Add-PnPPageWebPart -Page $Page -ComponentId $ComponentId -WebPartProperties $PropertiesJson `
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

# ==================================================================
# 1. CONNEXION
# ==================================================================
Write-Title "1/9 · Connexion à SharePoint"
if (-not $DryRun -and -not $VerifyOnly) {
    Connect-PnPOnline -Url $SiteUrl -Interactive
    Write-Ok "Connecté à $SiteUrl"
} else {
    Write-Step "Mode simulation/audit : connexion requise pour l'analyse, aucune écriture."
    Connect-PnPOnline -Url $SiteUrl -Interactive
}
if ($script:DataSiteUrl -ne $SiteUrl) {
    Write-Step "Les listes métier seront créées sur : $($script:DataSiteUrl)"
}

# ==================================================================
# 2. LISTES MÉTIER (colonnes attendues par le code SPFx)
# ==================================================================
Write-Title "2/9 · Listes métier"

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

# --- Organigramme : IOrgNode { Title, Role, Pole, Parent, PhotoUrl, Email, Phone, Location, Order }
Ensure-BbiList -Title 'Organigramme' -Template GenericList | Out-Null
Ensure-BbiField -List 'Organigramme' -DisplayName 'Poste'        -InternalName 'Role'     -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Pôle'         -InternalName 'Pole'     -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Responsable'  -InternalName 'Parent'   -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Photo (URL)'  -InternalName 'PhotoUrl' -Type Hyperlink
Ensure-BbiField -List 'Organigramme' -DisplayName 'E-mail'       -InternalName 'Email'    -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Téléphone'    -InternalName 'Phone'    -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Localisation' -InternalName 'Location' -Type Text
Ensure-BbiField -List 'Organigramme' -DisplayName 'Ordre'        -InternalName 'Ordre'    -Type Number
Ensure-BbiView  -List 'Organigramme' -Title 'Organigramme complet' -Fields @('Title','Role','Pole','Parent','Location') `
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

# ==================================================================
# 3. BIBLIOTHÈQUES DOCUMENTAIRES
# ==================================================================
Write-Title "3/9 · Bibliothèques"

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

# ==================================================================
# 4. SÉCURISATION DE LA BIBLIOTHÈQUE « SUPPORTS PUBLIÉS »
# ==================================================================
Write-Title "4/9 · Sécurité documentaire (lecture seule par défaut)"
if ($DryRun -or $VerifyOnly) {
    Write-Step "[SIMULATION] héritage rompu sur « Supports publiés » + contribution réservée à $EditorsGroup"
} else {
    try {
        Set-PnPList -Identity 'Supports publiés' -BreakRoleInheritance -CopyRoleAssignments | Out-Null
        Write-Ok "Héritage rompu : les apprenants conservent la Lecture."
        try {
            Set-PnPListPermission -List 'Supports publiés' -Identity 'Membres du site' -RemoveRole 'Contribute','Edit' -ErrorAction SilentlyContinue
            Set-PnPListPermission -List 'Supports publiés' -Identity 'Visiteurs' -RemoveRole 'Contribute','Edit' -ErrorAction SilentlyContinue
        } catch { Write-Warn2 "Ajustement des rôles par défaut ignoré : $($_.Exception.Message)" }
        try {
            Set-PnPListPermission -List 'Supports publiés' -Identity $EditorsGroup -AddRole 'Contribute'
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
Write-Title "5/9 · Pages et web parts"
Write-Step "Astuce : les propriétés ci-dessous correspondent aux réglages recommandés (modifiables ensuite dans le volet Propriétés)."

$homeProps = @{
    siteUrl               = $script:DataSiteUrl
    newsListTitle         = 'Actualites'
    sessionsListTitle     = 'Sessions'
    trainersListTitle     = 'Formateurs'
    formationsListTitle   = 'Formations'
    documentsLibraryTitle = 'Supports publiés'
    galleryLibraryTitle   = 'Galerie médias'
    employeeListTitle     = 'Employés du mois'
    certificationsListTitle = 'Certifications'
    orgChartListTitle     = 'Organigramme'
    maxItems              = 6
    enableGallery         = $true
    enableAnnouncement    = $true
    layoutCompact         = $false
    heroEyebrow           = 'Business Builders International'
    heroTitle             = "L'expertise qui fait grandir les dirigeants."
    heroSubtitle          = "Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables."
    heroSlides            = " | Business Builders International | L'expertise qui fait grandir les dirigeants. | Formations, accompagnement et intelligence collective pour transformer vos ambitions en résultats durables. | Explorer les formations | #formations`n | Notre méthode | Des parcours conçus pour le terrain. | Des mises en situation concrètes, des formateurs certifiés et un ancrage à 30 jours. | Voir les prochaines sessions | #sessions`n | Réseau international | 9 pays, une même exigence de qualité. | Un référentiel pédagogique unique et des antennes locales dans chaque région. | Découvrir l'organisation | #organigramme`n | Qualité certifiée | Qualiopi, un gage de confiance. | Des process audités et une amélioration continue au service de vos financeurs. | Voir les certifications | #vie-equipe"
    primaryCtaLabel       = 'Explorer les formations'
    primaryCtaUrl         = '#formations'
    secondaryCtaLabel     = 'Voir les prochaines sessions'
    secondaryCtaUrl       = '#sessions'
    navLinks              = "# Accueil | #accueil`n# Formations | #formations`n# Sessions | #sessions`n# Actualités | #actualites`n# Ressources | #ressources`n# Communauté | #communaute`n# Organigramme | #organigramme"
    quickLinks            = "▦ | Catalogue des formations | Parcours, modalités et durées | #formations`n▣ | Prochaines sessions | Planning et inscriptions | #sessions`n▤ | Supports & médias | Documents, photos et vidéos | #ressources`n◈ | Organigramme | Équipes, pôles et contacts | #organigramme`n◎ | Communauté BBI | Formateurs et experts | #communaute`n✦ | Actualités BBI | Les nouvelles du réseau | #actualites"
    kpis                  = "1 500+ | Professionnels accompagnés`n10+ | Formations au catalogue`n9 | Pays couverts par le réseau`n96 % | De satisfaction constatée"
    enableGallery         = $true
} | ConvertTo-Json -Compress

# --- Page d'accueil : page APPLICATIVE (aucun en-tête, aucune navigation)
Ensure-BbiPage -Name 'accueil' -Title 'Accueil' -LayoutType 'SingleWebPartAppPage' | Out-Null
Ensure-BbiWebPart -Page 'accueil.aspx' -ComponentId $WP_HOME -PropertiesJson $homeProps -Name 'BBI Accueil (plein écran)'

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

# ==================================================================
# 6. THÈME, EN-TÊTE, LOGO
# ==================================================================
Write-Title "6/9 · Identité visuelle"
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
    if (-not (Get-PnPTenantTheme -Identity 'BBI Bleu nuit' -ErrorAction SilentlyContinue)) {
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
# 7. NAVIGATION DU SITE
# ==================================================================
Write-Title "7/9 · Navigation"
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
Ensure-BbiNavNode -Title 'BBI Intranet' -Url "$SiteUrl/SitePages/accueil.aspx"
# Le portail est mono-page : les vues (dont l'organigramme) sont des ancres internes.
Ensure-BbiNavNode -Title 'Organigramme' -Url "$SiteUrl/SitePages/accueil.aspx#organigramme"

# ==================================================================
# 8. DONNÉES D'EXEMPLE
# ==================================================================
if ($SeedDemoData -and -not $DryRun -and -not $VerifyOnly) {
    Write-Title "8/9 · Données d'exemple"
    $today = Get-Date

    # Actualités
    if ((Get-PnPListItem -List 'Actualites' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion des actualités d'exemple" {
            Add-PnPListItem -List 'Actualites' -Values @{
                Title = '12 nouveaux formateurs certifiés'
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
                @{ Title = 'Amélie Martin';   Role = 'Responsable pédagogique'; Filiere = 'Management & Qualité';   Initials = 'AM'; Phone = '+33 6 12 45 78 90'; Email = 'amelie.martin@businessbuilders.fr'; WhatsApp = '+33612457890'; Location = 'Paris — Siège'; Bio = "Pilote l'ingénierie pédagogique du réseau et accompagne la montée en compétences des formateurs BBI."; Specialites = 'Management de proximité · Ingénierie pédagogique'; Certifications = 'Qualiopi · Coach professionnel (RNCP)' },
                @{ Title = 'Stéphane Laurent'; Role = 'Coach certifié';          Filiere = 'Coaching & leadership'; Initials = 'SL'; Phone = '+33 6 23 56 89 01'; Email = 'stephane.laurent@businessbuilders.fr'; WhatsApp = '+33623568901'; Location = 'Lyon'; Bio = "Coach certifié et ancien directeur commercial : posture, prise de parole et relation client."; Specialites = 'Coaching de dirigeants · Prise de parole'; Certifications = 'Coach certifié ICF · Process Communication' },
                @{ Title = 'Khadija Diallo';   Role = 'Formatrice';              Filiere = 'Commerce & négociation'; Initials = 'KD'; Phone = '+221 77 456 78 90'; Email = 'khadija.diallo@businessbuilders.fr'; WhatsApp = '+221774567890'; Location = 'Dakar — Antenne'; Bio = "Spécialiste de la négociation complexe, elle anime les parcours commerciaux sur le terrain."; Specialites = 'Négociation · Prospection terrain'; Certifications = 'Méthode BBI Vente · TOSA' },
                @{ Title = 'Thomas Bernard';   Role = 'Formateur';               Filiere = 'Digital & prospection'; Initials = 'TB'; Phone = '+33 6 34 67 90 12'; Email = 'thomas.bernard@businessbuilders.fr'; WhatsApp = '+33634679012'; Location = 'Paris — Siège'; Bio = "Ancien responsable growth : il outille les équipes commerciales et anime le module « Prospection digitale »."; Specialites = 'Prospection digitale · Outils CRM'; Certifications = 'Google Ads · HubSpot Academy' },
                @{ Title = 'Marie-Claire Ngoma'; Role = 'Consultante qualité';   Filiere = 'Qualité & certification'; Initials = 'MN'; Phone = '+225 07 12 34 56 78'; Email = 'marie-claire.ngoma@businessbuilders.fr'; WhatsApp = '+2250712345678'; Location = 'Abidjan — Antenne'; Bio = "Accompagne les organismes de formation dans leur mise en conformité Qualiopi."; Specialites = 'Qualiopi · Audit interne'; Certifications = 'Auditeur qualité certifié' },
                @{ Title = 'Youssef El Amrani'; Role = 'Formateur';              Filiere = 'Leadership & changement'; Initials = 'YA'; Phone = '+33 6 45 78 01 23'; Email = 'youssef.elamrani@businessbuilders.fr'; WhatsApp = '+33645780123'; Location = 'Distanciel'; Bio = "Intervient sur les transformations d'organisation et la conduite du changement."; Specialites = 'Conduite du changement · Leadership'; Certifications = 'Méthode BBI Leadership' },
                @{ Title = 'Claire Fontaine';  Role = 'Coach certifiée';          Filiere = 'Coaching d''entrepreneurs'; Initials = 'CF'; Phone = '+33 6 56 89 12 34'; Email = 'claire.fontaine@businessbuilders.fr'; WhatsApp = '+33656891234'; Location = 'Paris — Siège'; Bio = "Accompagne les créateurs et repreneurs : structuration du projet et posture de dirigeant."; Specialites = 'Coaching entrepreneurial · Codéveloppement'; Certifications = 'Coach certifiée · Green Belt Lean' },
                @{ Title = 'Jean-Marc Okafor'; Role = 'Directeur pédagogique';   Filiere = 'Management'; Initials = 'JO'; Phone = '+33 6 67 90 23 45'; Email = 'jean-marc.okafor@businessbuilders.fr'; WhatsApp = '+33667902345'; Location = 'Paris — Siège'; Bio = "Fixe les orientations pédagogiques du réseau et garantit l'homogénéité des parcours."; Specialites = 'Stratégie pédagogique · Management'; Certifications = 'Qualiopi · MBA' }
            )
            foreach ($formateur in $formateurs) { Add-PnPListItem -List 'Formateurs' -Values $formateur | Out-Null }
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

    # Organigramme
    if ((Get-PnPListItem -List 'Organigramme' -PageSize 1).Count -eq 0) {
        Invoke-Bbi "Insertion de l'organigramme" {
            $organigramme = @(
                @{ Title = 'Jean-Marc Okafor';   Role = 'Directeur général';                  Pole = 'Direction générale';       Ordre = 1; Email = 'jean-marc.okafor@businessbuilders.fr';   Phone = '+33 1 84 20 10 20'; Location = 'Paris — Siège' },
                @{ Title = 'Amélie Martin';      Role = 'Directrice pédagogique';             Pole = 'Pédagogie & ingénierie';   Ordre = 2; Parent = 'Jean-Marc Okafor'; Email = 'amelie.martin@businessbuilders.fr';  Phone = '+33 1 84 20 11 21'; Location = 'Paris — Siège' },
                @{ Title = 'Khadija Diallo';     Role = 'Directrice commerciale & réseau';    Pole = 'Développement';            Ordre = 3; Parent = 'Jean-Marc Okafor'; Email = 'khadija.diallo@businessbuilders.fr'; Phone = '+221 77 456 78 90'; Location = 'Dakar — Antenne' },
                @{ Title = 'Marie-Claire Ngoma'; Role = 'Directrice qualité & conformité';    Pole = 'Qualité';                  Ordre = 4; Parent = 'Jean-Marc Okafor'; Email = 'marie-claire.ngoma@businessbuilders.fr'; Phone = '+225 07 12 34 56 78'; Location = 'Abidjan — Antenne' },
                @{ Title = 'Thomas Bernard';     Role = 'Directeur opérations & digital';     Pole = 'Opérations';               Ordre = 5; Parent = 'Jean-Marc Okafor'; Email = 'thomas.bernard@businessbuilders.fr'; Phone = '+33 1 84 20 14 24'; Location = 'Paris — Siège' },
                @{ Title = 'Stéphane Laurent';   Role = 'Responsable coaching & leadership';  Pole = 'Pédagogie & ingénierie';   Ordre = 6; Parent = 'Amélie Martin'; Email = 'stephane.laurent@businessbuilders.fr'; Phone = '+33 6 23 56 89 01'; Location = 'Lyon' },
                @{ Title = 'Claire Fontaine';    Role = 'Responsable certification';          Pole = 'Pédagogie & ingénierie';   Ordre = 7; Parent = 'Amélie Martin'; Email = 'claire.fontaine@businessbuilders.fr'; Phone = '+33 6 56 89 12 34'; Location = 'Paris — Siège' },
                @{ Title = 'Youssef El Amrani';  Role = 'Responsable parcours management';    Pole = 'Pédagogie & ingénierie';   Ordre = 8; Parent = 'Amélie Martin'; Email = 'youssef.elamrani@businessbuilders.fr'; Phone = '+33 6 45 78 01 23'; Location = 'Distanciel' },
                @{ Title = 'Awa Traoré';         Role = 'Responsable antenne Bamako';         Pole = 'Développement';            Ordre = 9; Parent = 'Khadija Diallo'; Email = 'awa.traore@businessbuilders.fr'; Phone = '+223 76 12 34 56'; Location = 'Bamako — Antenne' },
                @{ Title = 'Samuel Kouassi';     Role = 'Responsable antenne Abidjan';        Pole = 'Développement';            Ordre = 10; Parent = 'Khadija Diallo'; Email = 'samuel.kouassi@businessbuilders.fr'; Phone = '+225 05 98 76 54 32'; Location = 'Abidjan — Antenne' },
                @{ Title = 'Fatou Ndiaye';       Role = 'Auditrice qualité';                  Pole = 'Qualité';                  Ordre = 11; Parent = 'Marie-Claire Ngoma'; Email = 'fatou.ndiaye@businessbuilders.fr'; Phone = '+221 77 123 45 67'; Location = 'Dakar — Antenne' },
                @{ Title = 'Léa Marchand';       Role = 'Cheffe de projet e-learning';        Pole = 'Opérations';               Ordre = 12; Parent = 'Thomas Bernard'; Email = 'lea.marchand@businessbuilders.fr'; Phone = '+33 1 84 20 19 29'; Location = 'Paris — Siège' }
            )
            foreach ($poste in $organigramme) { Add-PnPListItem -List 'Organigramme' -Values $poste | Out-Null }
        } | Out-Null
    }
}

# ==================================================================
# 9. RAPPORT
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
    @{ List = 'Organigramme'; Field = 'Parent';            UsedBy = 'Organigramme — rattachement hiérarchique' },
    @{ List = 'Organigramme'; Field = 'Ordre';             UsedBy = 'Organigramme — ordre d''affichage des postes' },
    @{ List = 'Organigramme'; Field = 'Role';              UsedBy = 'Organigramme — intitulé de poste' }
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

Write-Title "9/9 · Rapport"
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
