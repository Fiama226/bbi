<#
.SYNOPSIS
    Démonstration de la gestion des droits : plan (groupes, documents, droit de chaque groupe),
    matrice « qui voit quoi », génération de documents Word et PDF de démonstration.

.DESCRIPTION
    Ce fichier n'est pas exécuté seul : New-BbiRightsDemo.ps1, verify-organisation.ps1 et
    verify-organisation-flow.ps1 le chargent avec « . .\BbiRightsDemo.ps1 ».
    Aucune fonction d'ici n'appelle SharePoint : tout se teste hors ligne.

    Niveaux de droit utilisés (clés) :
      ViewOnly    consulter dans le navigateur, sans télécharger ni modifier
      Read        lire et télécharger
      Contribute  lire, télécharger, ajouter et modifier
      Edit        modifier
      FullControl contrôle total (réservé aux propriétaires du site)
#>

. (Join-Path $PSScriptRoot 'BbiOrganization.ps1')

$script:BbiRightLabels = [ordered]@{
    ViewOnly    = 'Voir seulement'
    Read        = 'Lire et télécharger'
    Contribute  = 'Contribuer'
    Edit        = 'Modifier'
    FullControl = 'Contrôle total'
    None        = 'Aucun accès'
}
$script:BbiRightExplanations = @{
    ViewOnly    = 'ouvre le document dans le navigateur, sans bouton de téléchargement, sans impression ni modification'
    Read        = 'ouvre le document, peut le télécharger, ne peut pas le modifier'
    Contribute  = 'ouvre, télécharge et modifie le document'
    Edit        = 'ouvre, télécharge et modifie le document, gère ses versions'
    FullControl = 'gère aussi les droits du document'
    None        = 'ne voit même pas le document dans la bibliothèque'
}

function Get-BbiRightLabel { param([string]$Right) if ($script:BbiRightLabels.Contains($Right)) { $script:BbiRightLabels[$Right] } else { $Right } }

# ------------------------------------------------------------------
# Plan de la démonstration
# ------------------------------------------------------------------
function Get-BbiRightsDemoPlan {
    param([Parameter(Mandatory)]$Config, [Parameter(Mandatory)]$Plan)

    $accounts = Get-BbiOptional (Get-BbiOptional $Config 'demonstration' $null) 'comptes' $null
    $people = { param($key) @(Get-BbiOptional $accounts $key @()) }

    # L'ordre ici est l'ordre des colonnes de la matrice.
    $groups = @(
        [pscustomobject]@{ Key = 'concepteurs'; Name = $Plan.GroupeEditeurs; Label = 'Concepteur'; Description = 'Éditeurs de contenu du portail'; Members = @(); Created = $false }
        [pscustomobject]@{ Key = 'clients';     Name = 'BBI-Demo-Clients';     Label = 'Client externe'; Description = 'Démonstration des droits : clients externes invités'; Members = (& $people 'clients'); Created = $true }
        [pscustomobject]@{ Key = 'apprenants';  Name = 'BBI-Demo-Apprenants';  Label = 'Apprenant';      Description = 'Démonstration des droits : apprenants en formation'; Members = (& $people 'apprenants'); Created = $true }
        [pscustomobject]@{ Key = 'employes';    Name = 'BBI-Demo-Employes';    Label = 'Employé';        Description = 'Démonstration des droits : ensemble du personnel'; Members = (& $people 'employes'); Created = $true }
        [pscustomobject]@{ Key = 'rh';          Name = 'BBI-Demo-RH';          Label = 'RH';             Description = 'Démonstration des droits : ressources humaines'; Members = (& $people 'rh'); Created = $true }
        [pscustomobject]@{ Key = 'direction';   Name = 'BBI-Demo-Direction';   Label = 'Direction';      Description = 'Démonstration des droits : direction'; Members = (& $people 'direction'); Created = $true }
    )

    $pub = 'Supports publiés'
    $adm = 'Documents administratifs'
    $docs = @(
        [pscustomobject]@{ Num = 1;  Library = $pub; Kind = 'docx'; FileName = 'Cas-01-Consultation-seule-sans-telechargement.docx'
            Title = 'Cas 1 - Consultation seule, sans téléchargement'
            Scenario = 'Le client voit le document, mais ne peut ni le télécharger, ni le modifier, ni l''imprimer.'
            Metadata = @{ TypeSupport = 'Manuel participant'; StatutSupport = 'Publié' }
            Grants = @(@{ Group = 'clients'; Right = 'ViewOnly' }, @{ Group = 'apprenants'; Right = 'ViewOnly' }, @{ Group = 'concepteurs'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 2;  Library = $pub; Kind = 'pdf'; FileName = 'Cas-02-Lecture-et-telechargement.pdf'
            Title = 'Cas 2 - Lecture et téléchargement'
            Scenario = 'L''apprenant lit le support et peut le télécharger pour le garder, sans pouvoir le modifier.'
            Metadata = @{ TypeSupport = 'Exercices'; StatutSupport = 'Publié' }
            Grants = @(@{ Group = 'apprenants'; Right = 'Read' }, @{ Group = 'clients'; Right = 'Read' }, @{ Group = 'concepteurs'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 3;  Library = $pub; Kind = 'docx'; FileName = 'Cas-03-Reserve-aux-concepteurs.docx'
            Title = 'Cas 3 - Réservé aux concepteurs'
            Scenario = 'Seuls les concepteurs de contenu voient et modifient le document. Clients et apprenants ne le voient pas.'
            Metadata = @{ TypeSupport = 'Slides animateur'; StatutSupport = 'À valider' }
            Grants = @(@{ Group = 'concepteurs'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 4;  Library = $pub; Kind = 'docx'; FileName = 'Cas-04-Support-reserve-a-un-client.docx'
            Title = 'Cas 4 - Support réservé à un client'
            Scenario = 'Un support confidentiel n''est visible que par le groupe du client concerné, en consultation seule. Les autres ne le voient pas.'
            Metadata = @{ TypeSupport = 'Modèle'; StatutSupport = 'Publié' }
            Grants = @(@{ Group = 'clients'; Right = 'ViewOnly' }, @{ Group = 'concepteurs'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 5;  Library = $pub; Kind = 'docx'; FileName = 'Cas-05-Brouillon-non-publie.docx'
            Title = 'Cas 5 - Brouillon non publié'
            Scenario = 'Un brouillon reste invisible pour les apprenants et les clients tant qu''il n''est pas publié.'
            Metadata = @{ TypeSupport = 'Évaluation'; StatutSupport = 'Brouillon' }
            Grants = @(@{ Group = 'concepteurs'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 6;  Library = $adm; Kind = 'pdf'; FileName = 'Cas-06-Reglement-interieur-tous-les-employes.pdf'
            Title = 'Cas 6 - Règlement intérieur, pour tous les employés'
            Scenario = 'Tout le personnel lit et télécharge le règlement. Seules les RH et la direction le modifient.'
            Metadata = @{ Categorie = 'RH'; Public = 'Tous'; Reference = 'DEMO-06' }
            Grants = @(@{ Group = 'employes'; Right = 'Read' }, @{ Group = 'rh'; Right = 'Edit' }, @{ Group = 'direction'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 7;  Library = $adm; Kind = 'docx'; FileName = 'Cas-07-Grille-salariale-RH-et-Direction.docx'
            Title = 'Cas 7 - Grille salariale, RH et direction'
            Scenario = 'Document confidentiel : les RH le modifient, la direction le lit. Les employés ne le voient pas.'
            Metadata = @{ Categorie = 'RH'; Public = 'Direction'; Reference = 'DEMO-07' }
            Grants = @(@{ Group = 'rh'; Right = 'Edit' }, @{ Group = 'direction'; Right = 'Read' }) }
        [pscustomobject]@{ Num = 8;  Library = $adm; Kind = 'docx'; FileName = 'Cas-08-Procedure-qualite-consultation-seule.docx'
            Title = 'Cas 8 - Procédure qualité, consultation seule'
            Scenario = 'Les employés consultent la procédure en vigueur sans pouvoir la télécharger : ils ne gardent pas de copie périmée.'
            Metadata = @{ Categorie = 'Qualité'; Public = 'Tous'; Reference = 'DEMO-08' }
            Grants = @(@{ Group = 'employes'; Right = 'ViewOnly' }, @{ Group = 'concepteurs'; Right = 'Edit' }, @{ Group = 'direction'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 9;  Library = $adm; Kind = 'docx'; FileName = 'Cas-09-Note-de-direction-confidentielle.docx'
            Title = 'Cas 9 - Note de direction confidentielle'
            Scenario = 'Seule la direction voit et modifie la note. Personne d''autre ne la voit, ni les RH, ni les employés.'
            Metadata = @{ Categorie = 'Juridique'; Public = 'Direction'; Reference = 'DEMO-09' }
            Grants = @(@{ Group = 'direction'; Right = 'Edit' }) }
        [pscustomobject]@{ Num = 10; Library = $adm; Kind = 'docx'; FileName = 'Cas-10-Document-collaboratif-tous-les-employes.docx'
            Title = 'Cas 10 - Document collaboratif, modifiable par tous les employés'
            Scenario = 'Tous les employés peuvent modifier le document (compte rendu partagé, liste de contacts). La direction garde la main.'
            Metadata = @{ Categorie = 'Modèles'; Public = 'Tous'; Reference = 'DEMO-10' }
            Grants = @(@{ Group = 'employes'; Right = 'Contribute' }, @{ Group = 'direction'; Right = 'Edit' }) }
    )

    return [pscustomobject]@{ Groups = $groups; Documents = $docs; Libraries = @($pub, $adm) }
}

# Droit d'un groupe sur un document ('None' si le groupe n'est pas dans les attributions)
function Get-BbiDocRight {
    param([Parameter(Mandatory)]$Doc, [Parameter(Mandatory)][string]$GroupKey)
    $g = @($Doc.Grants | Where-Object { $_.Group -eq $GroupKey } | Select-Object -First 1)
    if ($g.Count -gt 0 -and $g[0]) { return "$($g[0].Right)" }
    return 'None'
}

# Une ligne par document, une colonne par groupe : le tableau à montrer pendant la démonstration
function Get-BbiRightsMatrix {
    param([Parameter(Mandatory)]$RightsPlan)
    foreach ($d in $RightsPlan.Documents) {
        $row = [ordered]@{ Cas = $d.Num; Bibliotheque = $d.Library; Document = $d.Title }
        foreach ($g in $RightsPlan.Groups) { $row[$g.Label] = Get-BbiRightLabel (Get-BbiDocRight -Doc $d -GroupKey $g.Key) }
        [pscustomobject]$row
    }
}

function Write-BbiRightsMatrix {
    param([Parameter(Mandatory)]$RightsPlan)
    Write-Host ""
    Write-Host "Démonstration des droits : qui voit quoi" -ForegroundColor White
    Get-BbiRightsMatrix -RightsPlan $RightsPlan | Format-Table -AutoSize -Wrap | Out-String -Width 250 | Write-Host
    Write-Host "Les propriétaires du site gardent le contrôle total sur chaque document." -ForegroundColor Gray
}

# Contenu des documents de démonstration : ce que chaque compte doit constater
function Get-BbiDemoDocLines {
    param([Parameter(Mandatory)]$Doc, [Parameter(Mandatory)]$RightsPlan)
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("Cas d'usage $($Doc.Num) sur 10 : gestion des droits")
    $lines.Add('')
    $lines.Add($Doc.Scenario)
    $lines.Add('')
    $lines.Add('Ce que chaque compte doit constater :')
    foreach ($g in $RightsPlan.Groups) {
        $right = Get-BbiDocRight -Doc $Doc -GroupKey $g.Key
        $lines.Add("- $($g.Label) : $(Get-BbiRightLabel $right), $($script:BbiRightExplanations[$right])")
    }
    $lines.Add('')
    $lines.Add('Les propriétaires du site gardent le contrôle total.')
    $lines.Add('Document généré pour la démonstration. Il ne contient aucune donnée réelle.')
    return $lines.ToArray()
}

# ------------------------------------------------------------------
# Génération de fichiers de démonstration
# ------------------------------------------------------------------
function ConvertTo-BbiXmlText { param([string]$Text) [System.Security.SecurityElement]::Escape($Text) }

function New-BbiDemoDocx {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Title, [string[]]$Lines = @())
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $body = New-Object System.Text.StringBuilder
    [void]$body.Append('<w:p><w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t xml:space="preserve">' + (ConvertTo-BbiXmlText $Title) + '</w:t></w:r></w:p>')
    foreach ($l in $Lines) {
        [void]$body.Append('<w:p><w:r><w:t xml:space="preserve">' + (ConvertTo-BbiXmlText $l) + '</w:t></w:r></w:p>')
    }
    $head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    $document = $head + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + $body.ToString() +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>'
    $contentTypes = $head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    $rels = $head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($Path, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($part in @(@('[Content_Types].xml', $contentTypes), @('_rels/.rels', $rels), @('word/document.xml', $document))) {
            $entry = $zip.CreateEntry($part[0])
            $writer = New-Object System.IO.StreamWriter($entry.Open(), (New-Object System.Text.UTF8Encoding($false)))
            try { $writer.Write($part[1]) } finally { $writer.Dispose() }
        }
    } finally { $zip.Dispose() }
}

function ConvertTo-BbiPdfText {
    param([string]$Text)
    $t = [regex]::Replace($Text, '[^\u0000-ÿ]', '?')   # le PDF de démonstration est en Latin-1
    $t = $t.Replace('\', '\\').Replace('(', '\(').Replace(')', '\)')
    return $t
}

# Coupe un texte en lignes de $Width caractères au plus, sur les espaces
function Split-BbiText {
    param([string]$Text, [int]$Width = 88)
    if (-not $Text) { return @('') }
    $out = New-Object System.Collections.Generic.List[string]
    $current = ''
    foreach ($word in ($Text -split ' ')) {
        if (($current.Length + $word.Length + 1) -gt $Width -and $current) { $out.Add($current); $current = $word }
        elseif ($current) { $current = "$current $word" }
        else { $current = $word }
    }
    $out.Add($current)
    return $out.ToArray()
}

function New-BbiDemoPdf {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Title, [string[]]$Lines = @())
    $latin = [System.Text.Encoding]::GetEncoding(28591)
    $wrapped = New-Object System.Collections.Generic.List[string]
    foreach ($l in $Lines) { foreach ($piece in (Split-BbiText -Text $l)) { $wrapped.Add($piece) } }
    if ($wrapped.Count -gt 42) { throw "Le document PDF de démonstration dépasse une page ($($wrapped.Count) lignes)." }

    $stream = New-Object System.Text.StringBuilder
    [void]$stream.Append("BT /F1 18 Tf 56 790 Td ($(ConvertTo-BbiPdfText $Title)) Tj ET`n")
    [void]$stream.Append("BT /F1 11 Tf 56 755 Td 16 TL`n")
    foreach ($l in $wrapped) { [void]$stream.Append("($(ConvertTo-BbiPdfText $l)) Tj T*`n") }
    [void]$stream.Append("ET`n")
    $streamText = $stream.ToString()

    $objects = @(
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        # Parenthèses indispensables : en PowerShell la virgule se lie plus fort que « + ».
        ("<< /Length $($streamText.Length) >>`nstream`n$streamText" + 'endstream'),
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    )
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append("%PDF-1.4`n")
    $offsets = @()
    for ($i = 0; $i -lt $objects.Count; $i++) {
        $offsets += $sb.Length
        [void]$sb.Append("$($i + 1) 0 obj`n$($objects[$i])`nendobj`n")
    }
    $xref = $sb.Length
    [void]$sb.Append("xref`n0 $($objects.Count + 1)`n0000000000 65535 f `n")
    foreach ($o in $offsets) { [void]$sb.Append(('{0:D10} 00000 n ' -f $o) + "`n") }
    [void]$sb.Append("trailer`n<< /Size $($objects.Count + 1) /Root 1 0 R >>`nstartxref`n$xref`n%%EOF`n")
    [System.IO.File]::WriteAllBytes($Path, $latin.GetBytes($sb.ToString()))
}

function New-BbiDemoFile {
    param([Parameter(Mandatory)]$Doc, [Parameter(Mandatory)]$RightsPlan, [Parameter(Mandatory)][string]$Directory)
    $path = Join-Path $Directory $Doc.FileName
    $lines = Get-BbiDemoDocLines -Doc $Doc -RightsPlan $RightsPlan
    if ($Doc.Kind -eq 'pdf') { New-BbiDemoPdf -Path $path -Title $Doc.Title -Lines $lines }
    else { New-BbiDemoDocx -Path $path -Title $Doc.Title -Lines $lines }
    return $path
}

# Contrôle de structure d'un PDF généré (en-tête, tableau xref, positions des objets)
function Test-BbiPdfStructure {
    param([Parameter(Mandatory)][string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $text = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
    if (-not $text.StartsWith('%PDF-1.4')) { return 'en-tête %PDF absent' }
    if (-not $text.TrimEnd().EndsWith('%%EOF')) { return 'fin %%EOF absente' }
    $m = [regex]::Match($text, 'startxref\s+(\d+)\s+%%EOF')
    if (-not $m.Success) { return 'startxref absent' }
    $xrefPos = [int]$m.Groups[1].Value
    if (-not $text.Substring($xrefPos).StartsWith('xref')) { return 'startxref ne pointe pas sur xref' }
    $entries = [regex]::Matches($text.Substring($xrefPos), '(?m)^(\d{10}) 00000 n $')
    if ($entries.Count -ne 5) { return "table xref : 5 objets attendus, $($entries.Count) trouvés" }
    $n = 0
    foreach ($e in $entries) {
        $n++
        $pos = [int]$e.Groups[1].Value
        if (-not $text.Substring($pos).StartsWith("$n 0 obj")) { return "l'objet $n n'est pas à la position $pos" }
    }
    $len = [regex]::Match($text, '/Length (\d+) >>\s*stream\n')
    if (-not $len.Success) { $len = [regex]::Match($text, '/Length (\d+)>>\s*stream\n') }
    if ($len.Success) {
        $start = $len.Index + $len.Length
        $declared = [int]$len.Groups[1].Value
        if (-not $text.Substring($start + $declared).StartsWith('endstream')) { return 'longueur du flux incorrecte' }
    } else { return 'flux de contenu introuvable' }
    return 'OK'
}

# Contrôle d'un fichier Word généré : archive valide, XML bien formé, texte attendu
function Test-BbiDocxStructure {
    param([Parameter(Mandatory)][string]$Path, [string]$ExpectedText = '')
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
    try {
        $names = @($zip.Entries | ForEach-Object FullName)
        foreach ($required in '[Content_Types].xml', '_rels/.rels', 'word/document.xml') {
            if ($names -notcontains $required) { return "partie absente : $required" }
        }
        foreach ($part in $names) {
            $reader = New-Object System.IO.StreamReader(($zip.GetEntry($part)).Open(), [System.Text.Encoding]::UTF8)
            try { $xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
            try { [void][xml]$xml } catch { return "XML mal formé dans $part" }
            if ($part -eq 'word/document.xml' -and $ExpectedText -and $xml.IndexOf($ExpectedText, [StringComparison]::Ordinal) -lt 0) { return "texte attendu absent : $ExpectedText" }
        }
    } finally { $zip.Dispose() }
    return 'OK'
}
