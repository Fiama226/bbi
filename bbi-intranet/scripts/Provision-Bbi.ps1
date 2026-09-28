#Requires -Version 7.4
#Requires -Modules PnP.PowerShell
<# Connect-PnPOnline must be called by the operator before running this script.
   No destructive reset, no demo personal data and no permission changes. #>
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
  [switch]$SeedNavigation,
  [switch]$CreateHomePage,
  [switch]$SetAsHomePage,
  [ValidatePattern('^[a-zA-Z0-9_-]+$')][string]$PageName = 'Accueil-BBI'
)
$ErrorActionPreference = 'Stop'
if ($SetAsHomePage -and -not $CreateHomePage) { throw '-SetAsHomePage exige -CreateHomePage.' }
$null = Get-PnPWeb # Fail before creating anything when not connected.
$schema = Get-Content (Join-Path $PSScriptRoot 'lists.schema.json') -Raw | ConvertFrom-Json
foreach ($definition in $schema) {
  $list = Get-PnPList -Identity $definition.title -ErrorAction SilentlyContinue
  if (-not $list) {
    if ($PSCmdlet.ShouldProcess($definition.title, 'Créer la liste/bibliothèque')) {
      $list = New-PnPList -Title $definition.title -Template $definition.template -EnableVersioning
    } else { continue }
  }
  $expectedTemplate = if ($definition.template -eq 'DocumentLibrary') { 101 } else { 100 }
  if ([int]$list.BaseTemplate -ne $expectedTemplate) { throw "Type incompatible pour $($definition.title). Aucun objet existant ne sera remplacé." }
  foreach ($column in $definition.fields) {
    $field = Get-PnPField -List $list -Identity $column.name -ErrorAction SilentlyContinue
    if ($field) {
      if ($field.TypeAsString -ne $column.type) { throw "Type incompatible : $($definition.title).$($column.name), attendu $($column.type), trouvé $($field.TypeAsString)." }
    } elseif ($PSCmdlet.ShouldProcess("$($definition.title).$($column.name)", 'Créer la colonne')) {
      $field = Add-PnPField -List $list -DisplayName $column.name -InternalName $column.name -Type $column.type -AddToDefaultView
      if ($column.type -eq 'Note') { Set-PnPField -List $list -Identity $column.name -Values @{ RichText = $false } | Out-Null }
    }
  }
  # Prepare filters used by the webparts for growth beyond the list view threshold.
  $indexed = @('DateDebut','DateFin','FormateurEmail','StatutCatalogue','DatePublication','Ordre')
  foreach ($column in $definition.fields | Where-Object { $_.name -in $indexed }) {
    if ($PSCmdlet.ShouldProcess("$($definition.title).$($column.name)", 'Indexer la colonne')) {
      Set-PnPField -List $list -Identity $column.name -Values @{ Indexed = $true } | Out-Null
    }
  }
}
if ($SeedNavigation) {
  $links = @(
    @{Title='Nos formations'; Description='Trouvez votre prochain parcours.'; Categorie='catalog'; Ordre=1},
    @{Title='Espace formateurs'; Description='Préparez vos interventions.'; Categorie='trainer'; Ordre=2},
    @{Title='Mon planning'; Description='Retrouvez les sessions à venir.'; Categorie='sessions'; Ordre=3},
    @{Title='Support & FAQ'; Description='Une équipe pour vous accompagner.'; Categorie='support'; Ordre=4}
  )
  $linksList = Get-PnPList -Identity 'BBI Liens' -ErrorAction SilentlyContinue
  $existing = if ($linksList) { @(Get-PnPListItem -List 'BBI Liens' -PageSize 100 | ForEach-Object { $_['Title'] }) } else { @() }
  foreach ($link in $links) {
    if ($link.Title -notin $existing -and $PSCmdlet.ShouldProcess($link.Title, 'Ajouter le lien de navigation')) {
      Add-PnPListItem -List 'BBI Liens' -Values $link | Out-Null
    }
  }
}
if ($CreateHomePage) {
  $page = Get-PnPPage -Identity "$PageName.aspx" -ErrorAction SilentlyContinue
  if ($page) {
    Write-Warning "La page $PageName.aspx existe déjà : son contenu est conservé, aucun composant n’est ajouté."
  } elseif ($PSCmdlet.ShouldProcess("$PageName.aspx", 'Créer et publier une page avec BBI Accueil (sources réelles)')) {
    $page = Add-PnPPage -Name $PageName -Title 'Accueil BBI' -LayoutType Home
    $homeId = (Get-Content (Join-Path $PSScriptRoot 'webpart-ids.json') -Raw | ConvertFrom-Json).home
    $component = Get-PnPAvailableClientSideComponents -Page $page | Where-Object { $_.Id.ToString() -eq $homeId }
    if (-not $component) { throw 'BBI Accueil introuvable. Déployez le .sppkg avant de créer la page. La page créée est restée en brouillon ; ajoutez ensuite BBI Accueil manuellement.' }
    Add-PnPPageSection -Page $page -SectionTemplate OneColumn -Order 1 | Out-Null
    Add-PnPPageWebPart -Page $page -Component $component -Section 1 -Column 1 -WebPartProperties @{ demoMode=$false; title='BBI Intranet'; maxItems=4; sourcesJson='{}' } | Out-Null
    Set-PnPPage -Identity $PageName -Publish | Out-Null
  }
  if ($SetAsHomePage -and $PSCmdlet.ShouldProcess('Page d’accueil du site', "Remplacer par SitePages/$PageName.aspx")) {
    Set-PnPHomePage -RootFolderRelativeUrl "SitePages/$PageName.aspx"
  }
}
Write-Host 'Terminé. Aucun droit ni politique de protection documentaire n’a été modifié.'
