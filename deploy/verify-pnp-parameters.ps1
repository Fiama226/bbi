#Requires -Version 7.0
<#
.SYNOPSIS
    Vérifie que chaque appel PnP.PowerShell des scripts deploy/*.ps1 utilise des cmdlets
    et des paramètres qui existent dans la version du module installée sur CETTE machine.

.DESCRIPTION
    Lecture seule, aucune connexion à SharePoint. Le script analyse la syntaxe des scripts
    (AST PowerShell), relève chaque appel « Verbe-PnPNom » et compare ses paramètres nommés
    à ceux du module. Il attrape les erreurs de nom de paramètre que les tests simulés
    (verify-organisation-flow.ps1) ne peuvent pas voir, par exemple un paramètre renommé
    d'une version du module à l'autre.

    Limites : il ne contrôle ni les valeurs passées, ni les droits du tenant, ni les
    paramètres dynamiques de New-PnPSite (liste blanche ci-dessous).

.EXAMPLE
    pwsh -File deploy/verify-pnp-parameters.ps1
    Sortie 0 si tout est reconnu, 1 sinon, 2 si le module n'est pas installé.
#>
$ErrorActionPreference = 'Stop'

if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
    Write-Host "Module PnP.PowerShell absent : Install-Module PnP.PowerShell -Scope CurrentUser" -ForegroundColor Yellow
    exit 2
}
Import-Module PnP.PowerShell
$module = Get-Module PnP.PowerShell
Write-Host "Contrôle des appels PnP contre PnP.PowerShell $($module.Version)" -ForegroundColor White

$common = [System.Management.Automation.PSCmdlet]::CommonParameters + [System.Management.Automation.PSCmdlet]::OptionalCommonParameters
# Paramètres dynamiques : ils n'existent qu'une fois -Type donné, Get-Command ne les voit pas.
$dynamic = @{ 'New-PnPSite' = 'Title', 'Alias', 'IsPublic', 'Lcid', 'Description', 'Owner', 'Classification', 'SensitivityLabel', 'ShareByEmailEnabled', 'Url', 'SiteDesign', 'SiteDesignId', 'WebTemplate', 'Owners', 'Language', 'Wait', 'TimeZone', 'HubSiteId' }

$files = Get-ChildItem -Path $PSScriptRoot -Filter *.ps1 | Where-Object { $_.Name -ne 'verify-organisation-flow.ps1' -and $_.Name -ne 'verify-seed-assets.ps1' -and $_.Name -ne 'verify-pnp-parameters.ps1' }
$problems = New-Object System.Collections.Generic.List[string]
$checked = 0
foreach ($f in $files) {
    $tokens = $null; $errs = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errs)
    foreach ($c in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true)) {
        $name = $c.GetCommandName()
        if (-not $name -or $name -notmatch '^[A-Za-z]+-PnP[A-Za-z0-9]+$') { continue }
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if (-not $cmd) { $problems.Add("$($f.Name):$($c.Extent.StartLineNumber)  cmdlet inconnue : $name"); continue }
        $checked++
        $valid = @($cmd.Parameters.Keys) + @($cmd.Parameters.Values | ForEach-Object { $_.Aliases } | ForEach-Object { $_ })
        foreach ($el in $c.CommandElements) {
            if ($el -isnot [System.Management.Automation.Language.CommandParameterAst]) { continue }
            $p = $el.ParameterName
            if ($p -in $common -or ($valid | Where-Object { $_ -ieq $p })) { continue }
            if (@($valid | Where-Object { $_ -like "$p*" } | Select-Object -Unique).Count -eq 1) { continue }   # abréviation non ambiguë
            if ($dynamic.ContainsKey($name) -and $dynamic[$name] -contains $p) { continue }
            $problems.Add("$($f.Name):$($c.Extent.StartLineNumber)  $name : paramètre inconnu -$p")
        }
    }
}

Write-Host "$checked appel(s) PnP contrôlé(s) dans $($files.Count) script(s)."
if ($problems.Count -eq 0) {
    Write-Host "Tous les appels sont reconnus par le module installé." -ForegroundColor Green
    exit 0
}
$problems | Sort-Object -Unique | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
Write-Host "$($problems.Count) problème(s)." -ForegroundColor Red
exit 1
