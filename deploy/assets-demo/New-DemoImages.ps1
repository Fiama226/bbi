#Requires -Version 7.0
<#
.SYNOPSIS
    Génère les images et documents de démonstration du portail (outil de développement, à lancer sur un poste Windows).

.DESCRIPTION
    Les fichiers produits sont versionnés dans deploy/assets-demo/ : le déploiement sur un tenant
    n'a donc PAS besoin de System.Drawing, il téléverse simplement ces fichiers
    (voir deploy/BbiSeedAssets.ps1). Relancer ce script ne change rien d'utile : les images
    sont déterministes, hormis la compression JPEG.

    Tout est original : dégradés bleu nuit / rouge de la marque, motifs géométriques, logo réel
    (logo.png à la racine du dépôt) posé sur une plaque blanche. Aucune image d'un tiers.
    Le nom de l'entreprise s'écrit toujours en entier : « Business Builders International ».

    Produit :
      news/       8 images d'actualité 1200x675 (JPG)
      gallery/    12 photos 1200x800 (JPG), une par ligne de galleryData.ts
      trainers/   8 portraits 400x400 (PNG, initiales sur disque de couleur)
      references/ 3 logos clients fictifs 400x200 (PNG)
      banners/    3 bandeaux 1600x600 (JPG) pour le diaporama du héros
      employee/   1 portrait 400x400 (PNG) de l'employé du mois
      documents/  3 supports pédagogiques + 3 documents administratifs (PDF/Word)

.EXAMPLE
    pwsh -File deploy/assets-demo/New-DemoImages.ps1
#>
param([string]$LogoPath = (Join-Path $PSScriptRoot '..\..\logo.png'))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

. (Join-Path $PSScriptRoot '..\BbiRightsDemo.ps1')

$company = 'Business Builders International'
$navy = [System.Drawing.ColorTranslator]::FromHtml('#0E265C')
$navyDark = [System.Drawing.ColorTranslator]::FromHtml('#081840')
$navyLight = [System.Drawing.ColorTranslator]::FromHtml('#27498F')
$red = [System.Drawing.ColorTranslator]::FromHtml('#D7141A')
$white = [System.Drawing.Color]::White
$logo = [System.Drawing.Image]::FromFile((Resolve-Path $LogoPath).Path)

function Get-Alpha { param([System.Drawing.Color]$C, [int]$A) [System.Drawing.Color]::FromArgb($A, $C.R, $C.G, $C.B) }

function New-Canvas {
    param([int]$W, [int]$H, [System.Drawing.Color]$From, [System.Drawing.Color]$To, [float]$Angle = 35)
    $bmp = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
    $rect = New-Object System.Drawing.Rectangle(0, 0, $W, $H)
    $br = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $From, $To, $Angle)
    $g.FillRectangle($br, $rect); $br.Dispose()
    return @{ Bmp = $bmp; G = $g; W = $W; H = $H }
}

# Motifs géométriques simples, 0..3
function Add-Motif {
    param($Cv, [int]$Style, [System.Drawing.Color]$Accent)
    $g = $Cv.G; $W = $Cv.W; $H = $Cv.H
    $soft = New-Object System.Drawing.SolidBrush((Get-Alpha $white 22))
    $acc = New-Object System.Drawing.SolidBrush((Get-Alpha $Accent 200))
    switch ($Style % 4) {
        0 { # cercles
            $g.FillEllipse($soft, [int]($W * 0.62), [int](-$H * 0.25), [int]($H * 1.1), [int]($H * 1.1))
            $g.FillEllipse($acc, [int]($W * 0.80), [int]($H * 0.58), [int]($H * 0.42), [int]($H * 0.42))
            $g.FillEllipse($soft, [int]($W * 0.52), [int]($H * 0.62), [int]($H * 0.30), [int]($H * 0.30))
        }
        1 { # bandes diagonales
            foreach ($i in 0..3) {
                $x = [int]($W * (0.55 + 0.1 * $i))
                $pts = @((New-Object System.Drawing.Point($x, 0)), (New-Object System.Drawing.Point(($x + [int]($W * 0.06)), 0)),
                    (New-Object System.Drawing.Point(($x - [int]($W * 0.25) + [int]($W * 0.06)), $H)), (New-Object System.Drawing.Point(($x - [int]($W * 0.25)), $H)))
                $g.FillPolygon($(if ($i -eq 2) { $acc } else { $soft }), $pts)
            }
        }
        2 { # barres ascendantes (croissance)
            $bw = [int]($W * 0.055)
            foreach ($i in 0..5) {
                $bh = [int]($H * (0.22 + 0.11 * $i)); $x = [int]($W * 0.58 + $i * $bw * 1.45)
                $g.FillRectangle($(if ($i -eq 5) { $acc } else { $soft }), $x, $H - $bh - [int]($H * 0.08), $bw, $bh)
            }
        }
        3 { # arcs concentriques
            $pen = New-Object System.Drawing.Pen((Get-Alpha $white 40), 14)
            foreach ($i in 1..5) { $s = [int]($H * 0.28 * $i); $g.DrawEllipse($pen, [int]($W * 0.86 - $s / 2), [int]($H * 0.55 - $s / 2), $s, $s) }
            $pen.Dispose()
            $g.FillEllipse($acc, [int]($W * 0.86 - $H * 0.07), [int]($H * 0.55 - $H * 0.07), [int]($H * 0.14), [int]($H * 0.14))
        }
    }
    $soft.Dispose(); $acc.Dispose()
}

function Add-LogoPlate {
    param($Cv, [int]$LogoWidth = 220, [string]$Corner = 'BR')
    $g = $Cv.G
    $lh = [int]($LogoWidth * $logo.Height / $logo.Width)
    $pw = $LogoWidth + 34; $ph = $lh + 26
    $x = if ($Corner -like '*R') { $Cv.W - $pw - 36 } else { 36 }
    $y = if ($Corner -like 'B*') { $Cv.H - $ph - 32 } else { 32 }
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = 22
    $path.AddArc($x, $y, $d, $d, 180, 90); $path.AddArc($x + $pw - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $pw - $d, $y + $ph - $d, $d, $d, 0, 90); $path.AddArc($x, $y + $ph - $d, $d, $d, 90, 90); $path.CloseFigure()
    $b = New-Object System.Drawing.SolidBrush((Get-Alpha $white 238))
    $g.FillPath($b, $path); $b.Dispose(); $path.Dispose()
    $g.DrawImage($logo, $x + 17, $y + 13, $LogoWidth, $lh)
}

function Add-Text {
    param($Cv, [string]$Text, [float]$Size, [int]$X, [int]$Y, [int]$Width, [int]$Height, [string]$Style = 'Bold', [System.Drawing.Color]$Color = [System.Drawing.Color]::White, [string]$Anchor = 'Near')
    $fs = if ($Style -eq 'Bold') { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = New-Object System.Drawing.Font('Segoe UI', $Size, $fs, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.LineAlignment = $Anchor; $sf.Trimming = 'EllipsisWord'
    $br = New-Object System.Drawing.SolidBrush($Color)
    $Cv.G.DrawString($Text, $font, $br, (New-Object System.Drawing.RectangleF($X, $Y, $Width, $Height)), $sf)
    $br.Dispose(); $font.Dispose(); $sf.Dispose()
}

function Save-Jpeg {
    param($Cv, [string]$Path, [long]$Quality = 78)
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)
    New-Item -ItemType Directory -Force -Path (Split-Path $Path) | Out-Null
    $Cv.Bmp.Save($Path, $codec, $ep)
    $Cv.G.Dispose(); $Cv.Bmp.Dispose()
}
function Save-Png {
    param($Cv, [string]$Path)
    New-Item -ItemType Directory -Force -Path (Split-Path $Path) | Out-Null
    $Cv.Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $Cv.G.Dispose(); $Cv.Bmp.Dispose()
}

$root = $PSScriptRoot

# ---------------------------------------------------------------- (a) actualités 1200x675
$news = @(
    @('news-01-formateurs-certifies.jpg', '13 nouveaux formateurs certifiés', 'Certification'),
    @('news-02-catalogue-evolue.jpg', 'Le catalogue des formations évolue', 'Formations'),
    @('news-03-ateliers-de-rentree.jpg', 'Retour sur les ateliers de rentrée', 'Vie de l''entreprise'),
    @('news-04-audit-qualiopi.jpg', 'Audit Qualiopi : objectif atteint', 'Certification'),
    @('news-05-pole-coaching.jpg', 'Un nouveau pôle coaching pour les dirigeants', 'Coaching'),
    @('news-06-antenne-dakar.jpg', 'Ouverture de l''antenne de Dakar', 'Réseau'),
    @('news-07-webinaire-changement.jpg', 'Webinaire : conduire le changement', 'Événement'),
    @('news-08-prix-pedagogie.jpg', 'Prix de la pédagogie : notre équipe distinguée', 'Distinction')
)
for ($i = 0; $i -lt $news.Count; $i++) {
    $from, $to = if ($i % 2 -eq 0) { $navy, $navyDark } else { $navyLight, $navy }
    $cv = New-Canvas 1200 675 $from $to (25 + 8 * $i)
    Add-Motif $cv $i $red
    $bar = New-Object System.Drawing.SolidBrush($red); $cv.G.FillRectangle($bar, 70, 150, 90, 8); $bar.Dispose()
    Add-Text $cv ($news[$i][2]).ToUpper() 26 70 100 600 40 'Bold' (Get-Alpha $white 200)
    Add-Text $cv $news[$i][1] 62 70 175 720 300 'Bold'
    Add-LogoPlate $cv 230 'BL'
    Save-Jpeg $cv (Join-Path $root "news\$($news[$i][0])")
}

# ---------------------------------------------------------------- (b) galerie 1200x800 (même ordre que galleryData.ts)
# Album, lieu : valeurs de la colonne Choice « Album » créée par provision-bbi-intranet.ps1.
$gallery = @(
    @('galerie-01-atelier-prise-de-parole.jpg', 'Sessions de formation', 'Paris', 'Atelier prise de parole en public'),
    @('galerie-02-seminaire-formateurs-dakar.jpg', 'Événements', 'Dakar', 'Séminaire annuel des formateurs'),
    @('galerie-03-remise-attestations.jpg', 'Certifications', 'Paris', 'Remise des attestations'),
    @('galerie-04-tournage-module-elearning.jpg', 'Coulisses', 'Studio', 'Tournage du module e-learning'),
    @('galerie-05-coaching-entrepreneurs-promo-12.jpg', 'Sessions de formation', 'Lyon', 'Coaching d''entrepreneurs, promotion 12'),
    @('galerie-06-atelier-ideation-catalogue.jpg', 'Événements', 'Abidjan', 'Atelier d''idéation : refonte du catalogue'),
    @('galerie-07-audit-blanc-qualiopi.jpg', 'Certifications', 'Paris', 'Qualiopi : audit blanc réussi'),
    @('galerie-08-coulisses-traiter-objections.jpg', 'Coulisses', 'Studio', 'Coulisses du module sur les objections'),
    @('galerie-09-table-ronde-talents.jpg', 'Événements', 'Paris', 'Table ronde : recruter et fidéliser'),
    @('galerie-10-management-cohorte-7.jpg', 'Sessions de formation', 'Paris', 'Management d''équipe, cohorte 7'),
    @('galerie-11-immersion-terrain-formateurs.jpg', 'Certifications', 'Lyon', 'Formation des formateurs : immersion terrain'),
    @('galerie-12-afterwork-reseau-abidjan.jpg', 'Événements', 'Abidjan', 'Afterwork réseau, antenne d''Abidjan')
)
$albumColors = @{
    'Sessions de formation' = @($navyLight, $navyDark); 'Événements' = @($red, $navyDark)
    'Certifications' = @($navy, [System.Drawing.ColorTranslator]::FromHtml('#3A1230')); 'Coulisses' = @([System.Drawing.ColorTranslator]::FromHtml('#3C4A6B'), $navyDark)
}
for ($i = 0; $i -lt $gallery.Count; $i++) {
    $pair = $albumColors[$gallery[$i][1]]
    $cv = New-Canvas 1200 800 $pair[0] $pair[1] (40 + 11 * $i)
    Add-Motif $cv ($i + 1) $(if ($gallery[$i][1] -eq 'Événements') { $white } else { $red })
    Add-Text $cv ($gallery[$i][1]).ToUpper() 24 60 60 700 36 'Bold' (Get-Alpha $white 190)
    Add-Text $cv $gallery[$i][3] 54 60 110 640 330 'Bold'
    Add-Text $cv $gallery[$i][2] 30 60 640 400 44 'Regular' (Get-Alpha $white 220)
    Add-LogoPlate $cv 200 'BR'
    Save-Jpeg $cv (Join-Path $root "gallery\$($gallery[$i][0])")
}

# ---------------------------------------------------------------- (c) formateurs 400x400 (noms = seed de provision-bbi-intranet.ps1)
$trainers = @(
    @('formateur-amelie-martin.png', 'AM', '#0E265C'), @('formateur-stephane-laurent.png', 'SL', '#27498F'),
    @('formateur-khadija-diallo.png', 'KD', '#D7141A'), @('formateur-thomas-bernard.png', 'TB', '#3C4A6B'),
    @('formateur-marie-claire-ngoma.png', 'MN', '#A30F14'), @('formateur-youssef-el-amrani.png', 'YA', '#081840'),
    @('formateur-claire-fontaine.png', 'CF', '#27498F'), @('formateur-jean-marc-okafor.png', 'JO', '#0E265C')
)
function New-AvatarCentered {
    param([string]$Initials, [string]$Hex, [string]$Path)
    $cv = New-Canvas 400 400 ([System.Drawing.ColorTranslator]::FromHtml('#E8ECF4')) ([System.Drawing.ColorTranslator]::FromHtml('#F5F7FB')) 45
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($Hex))
    $cv.G.FillEllipse($b, 40, 40, 320, 320); $b.Dispose()
    $ring = New-Object System.Drawing.Pen((Get-Alpha $white 90), 6); $cv.G.DrawEllipse($ring, 58, 58, 284, 284); $ring.Dispose()
    $font = New-Object System.Drawing.Font('Segoe UI', 120, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $cv.G.DrawString($Initials, $font, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(40, 46, 320, 320)), $sf)
    $font.Dispose(); $sf.Dispose()
    Save-Png $cv $Path
}
foreach ($t in $trainers) { New-AvatarCentered $t[1] $t[2] (Join-Path $root "trainers\$($t[0])") }

# ---------------------------------------------------------------- (f) employé du mois 400x400
New-AvatarCentered 'LM' '#D7141A' (Join-Path $root 'employee\employe-du-mois-lea-marchand.png')

# ---------------------------------------------------------------- (d) logos clients fictifs 400x200
function New-ClientLogo {
    param([string]$Name, [string]$Hex, [int]$Shape, [string]$Path)
    $col = [System.Drawing.ColorTranslator]::FromHtml($Hex)
    $cv = New-Canvas 400 200 $white ([System.Drawing.ColorTranslator]::FromHtml('#F5F7FB')) 90
    $g = $cv.G; $b = New-Object System.Drawing.SolidBrush($col); $p = New-Object System.Drawing.Pen($col, 9)
    switch ($Shape) {
        0 { foreach ($k in 0..2) { $g.DrawArc($p, 38, 52 + 20 * $k, 90, 50, 200, 140) } }                     # vagues
        1 { $g.DrawEllipse($p, 40, 56, 84, 84); $g.FillEllipse($b, 96, 52, 30, 30) }                          # orbite
        2 { $g.FillEllipse($b, 56, 72, 52, 52); foreach ($k in 0..7) { $a = $k * [Math]::PI / 4; $g.DrawLine($p, [int](82 + 38 * [Math]::Cos($a)), [int](98 + 38 * [Math]::Sin($a)), [int](82 + 56 * [Math]::Cos($a)), [int](98 + 56 * [Math]::Sin($a))) } }
    }
    $font = New-Object System.Drawing.Font('Segoe UI', 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat; $sf.LineAlignment = 'Center'
    $g.DrawString($Name, $font, $b, (New-Object System.Drawing.RectangleF(140, 46, 250, 108)), $sf)
    $font.Dispose(); $sf.Dispose(); $b.Dispose(); $p.Dispose()
    Save-Png $cv $Path
}
New-ClientLogo 'Groupe Atlantide' '#0F7C8A' 0 (Join-Path $root 'references\client-groupe-atlantide.png')
New-ClientLogo 'Orbis Industries' '#C2410C' 1 (Join-Path $root 'references\client-orbis-industries.png')
New-ClientLogo 'Sahel Energies' '#B7791F' 2 (Join-Path $root 'references\client-sahel-energies.png')

# ---------------------------------------------------------------- (e) bandeaux du héros 1600x600
$banners = @(@('bandeau-offres.jpg', 0), @('bandeau-methode.jpg', 2), @('bandeau-reseau.jpg', 3))
foreach ($bn in $banners) {
    $cv = New-Canvas 1600 600 $navy $navyDark 20
    Add-Motif $cv $bn[1] $red
    Add-Motif $cv ($bn[1] + 1) $red
    Add-LogoPlate $cv 220 'TR'
    Save-Jpeg $cv (Join-Path $root "banners\$($bn[0])") 80
}
$logo.Dispose()

# ---------------------------------------------------------------- documents (français, nom complet de l'entreprise)
function New-Doc {
    param([string]$Kind, [string]$File, [string]$Title, [string[]]$Lines)
    $dir = Split-Path $File; New-Item -ItemType Directory -Force -Path $dir | Out-Null
    if ($Kind -eq 'pdf') { New-BbiDemoPdf -Path $File -Title $Title -Lines $Lines } else { New-BbiDemoDocx -Path $File -Title $Title -Lines $Lines }
}
$sup = Join-Path $root 'documents\supports'
New-Doc 'pdf' (Join-Path $sup 'support-management-equipe.pdf') "Support de cours : Management d'équipe" @(
    "$company - Pôle Formation",
    '',
    "Objectifs : fixer un cadre clair, déléguer efficacement et conduire un entretien de recadrage constructif.",
    '',
    '1. Poser le cadre : mission, attentes et indicateurs partagés avec chaque collaborateur.',
    '2. Déléguer : choisir la bonne tâche, la bonne personne et le bon niveau d''autonomie.',
    '3. Feedback : décrire un fait, nommer son effet, proposer une suite. Jamais de jugement sur la personne.',
    '4. Suivi : un point court et régulier vaut mieux qu''un grand bilan annuel.',
    '',
    'Exercice : préparez un entretien de délégation pour une tâche de votre quotidien.',
    "Document de démonstration produit par $company.")
New-Doc 'pdf' (Join-Path $sup 'support-vendre-la-valeur.pdf') 'Support de cours : Vendre la valeur, pas le prix' @(
    "$company - Pôle Formation",
    '',
    'Objectifs : comprendre le besoin réel du client et présenter une offre par ses bénéfices.',
    '',
    '1. Découverte : trois questions ouvertes avant toute proposition.',
    '2. Valeur : traduire chaque caractéristique en gain mesurable pour le client.',
    '3. Objections : écouter, reformuler, répondre par un exemple concret.',
    '4. Conclusion : proposer une prochaine étape datée.',
    '',
    "Document de démonstration produit par $company.")
New-Doc 'docx' (Join-Path $sup 'guide-participant-coaching-entrepreneurs.docx') "Guide du participant : Coaching d'entrepreneurs" @(
    "$company - Pôle Coaching",
    '',
    'Ce guide accompagne les six séances du parcours. Gardez-le à portée de main.',
    '',
    'Séance 1 : clarifier sa vision et ses priorités.',
    'Séance 2 : structurer son offre et son modèle économique.',
    'Séance 3 : organiser son temps de dirigeant.',
    'Séance 4 : développer son reseau et ses partenariats.',
    'Séance 5 : piloter ses chiffres clés.',
    'Séance 6 : plan d''action a 90 jours.',
    '',
    "Document de démonstration produit par $company.")
$adm = Join-Path $root 'documents\administratifs'
New-Doc 'pdf' (Join-Path $adm 'reglement-interieur.pdf') 'Règlement intérieur' @(
    $company,
    '',
    'Article 1 : horaires. Les horaires de travail sont ceux du contrat, avec une plage souple de 8 h à 10 h.',
    'Article 2 : confidentialite. Les données des clients et des apprenants restent strictement confidentielles.',
    'Article 3 : usage du matériel. Le matériel informatique est destine a un usage professionnel.',
    'Article 4 : santé et sécurité. Tout incident est signalé sans délai au responsable de site.',
    'Article 5 : respect. Aucune forme de harcèlement ou de discrimination n''est tolérée.',
    '',
    "Document de démonstration de $company. Remplacez-le par le texte officiel.")
New-Doc 'docx' (Join-Path $adm 'procedure-qualite-formation.docx') 'Procédure qualité : déroulement d''une formation' @(
    $company,
    '',
    'Avant : analyse du besoin, convention signée, convocation envoyée 15 jours avant la séance.',
    'Pendant : émargement par demi-journée, évaluation des acquis, remise du support.',
    'Après : questionnaire de satisfaction à chaud, suivi à 30 jours, archivage du dossier.',
    'Amélioration : revue trimestrielle des réclamations et des notes de satisfaction.',
    '',
    "Document de démonstration de $company.")
New-Doc 'pdf' (Join-Path $adm 'charte-teletravail.pdf') 'Charte du télétravail' @(
    $company,
    '',
    'Le teletravail est ouvert apres accord du responsable, jusqu''a deux jours par semaine.',
    'Le collaborateur reste joignable sur les plages convenues et participe aux temps collectifs.',
    'L''espace de travail respecte les règles de sécurité informatique de l''entreprise.',
    'Les frais sont couverts selon le barème en vigueur.',
    '',
    "Document de démonstration de $company.")

$all = Get-ChildItem $root -Recurse -File | Where-Object { $_.Extension -in '.jpg', '.png', '.pdf', '.docx' }
"{0} fichiers, {1:N0} Ko au total" -f $all.Count, (($all | Measure-Object Length -Sum).Sum / 1KB)
