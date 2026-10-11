# Diagnostic en lecture seule de la page d'accueil : mise en page, sections, composants, version, contenu brut.
param(
    [string]$SiteUrl = 'https://businessbuilderinter.sharepoint.com/sites/intranet',
    [string]$ClientId = $env:BBI_CLIENT_ID
)
Import-Module PnP.PowerShell -ErrorAction Stop
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

$page = Get-PnPPage -Identity 'accueil.aspx'
"Layout     : $($page.LayoutType)"
"Sections   : $(@($page.Sections).Count)"
foreach ($s in @($page.Sections)) { "  section $($s.Order) type=$($s.Type) colonnes=$(@($s.Columns).Count) controles=$(@($s.Controls).Count)" }
"Composants : $(@(Get-PnPPageComponent -Page 'accueil.aspx').Count)"
Get-PnPPageComponent -Page 'accueil.aspx' | Select-Object Title, WebPartId, ComponentId, Section, Column | Format-Table | Out-String

$item = Get-PnPListItem -List 'Pages du site' -Id $page.PageId -Fields 'CanvasContent1', '_UIVersionString', 'PageLayoutType', 'FileLeafRef'
"Version    : $($item['_UIVersionString'])  Layout: $($item['PageLayoutType'])"
$canvas = "$($item['CanvasContent1'])"
"Canvas ($($canvas.Length) car.) : $($canvas.Substring(0, [Math]::Min(900, $canvas.Length)))"

"Composants disponibles correspondant à l'accueil :"
Get-PnPPageComponent -Page 'accueil.aspx' -ListAvailable | Where-Object { "$($_.Id)" -like '*6a9b6e3b*' -or $_.Name -like '*Accueil*' } | Select-Object Name, Id | Format-Table | Out-String
