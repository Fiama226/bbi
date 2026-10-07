<# Slug d'alias de site SharePoint à partir d'une ville : minuscules ASCII, tirets, sans accents. #>
function ConvertTo-BbiSlug {
    param(
        [string]$Prefix = '',
        [string]$Value
    )
    $v = ("$Value").Trim()
    if (-not $v) { return '' }
    $decomposed = $v.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($ch in $decomposed.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($ch)
        }
    }
    $ascii = $sb.ToString().ToLowerInvariant()
    $ascii = $ascii -replace "['’]", ''          # apostrophes : collées (d'ivoire → divoire)
    $ascii = $ascii -replace '[^a-z0-9]+', '-'   # tout le reste → tiret
    $ascii = $ascii.Trim('-')
    if (-not $ascii) { return '' }
    return "$Prefix$ascii"
}
