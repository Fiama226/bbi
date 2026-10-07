<#
    Test de ConvertTo-BbiSlug (deploy/BbiSlug.ps1) : alias de site des filiales.
    Usage : pwsh -File deploy/verify-slug.ps1   → code de sortie 1 au moindre échec.
#>
. (Join-Path $PSScriptRoot 'BbiSlug.ps1')

$cases = @(
    @{ Prefix = 'intranet-'; Value = "Côte d'Ivoire";   Expected = 'intranet-cote-divoire' },
    @{ Prefix = 'intranet-'; Value = 'San Pedro';       Expected = 'intranet-san-pedro' },
    @{ Prefix = 'intranet-'; Value = '  Dakar  ';       Expected = 'intranet-dakar' },
    @{ Prefix = 'intranet-'; Value = 'Siège — Paris';   Expected = 'intranet-siege-paris' },
    @{ Prefix = 'intranet-'; Value = '';                Expected = '' },
    @{ Prefix = 'intranet-'; Value = "N'Djamena";       Expected = 'intranet-ndjamena' },
    @{ Prefix = 'intranet-'; Value = 'Bobo-Dioulasso';  Expected = 'intranet-bobo-dioulasso' },
    @{ Prefix = '';          Value = 'Abidjan';         Expected = 'abidjan' }
)

$failed = 0
foreach ($case in $cases) {
    $actual = ConvertTo-BbiSlug -Prefix $case.Prefix -Value $case.Value
    if ($actual -ceq $case.Expected) {
        Write-Host "  ✓ '$($case.Value)' (préfixe '$($case.Prefix)') → '$actual'" -ForegroundColor Green
    } else {
        Write-Host "  ✗ '$($case.Value)' (préfixe '$($case.Prefix)') → '$actual', attendu '$($case.Expected)'" -ForegroundColor Red
        $failed++
    }
}

Write-Host "Résultat : $($cases.Count - $failed) cas réussis, $failed échec(s)."
exit ([int]($failed -gt 0))
