function VerifierLot11 {
    $ProgressPreference = 'SilentlyContinue'
    Set-Location "C:\Users\saafi\edu-tek\edutek-backend"
    $u = "http://localhost:8080/api"
    $global:nbOk = 0; $global:nbKo = 0
    $s = Get-Random -Minimum 10000 -Maximum 99999

    function Appel($method, $path, $json, $tok, $entetes) {
        $sortie = [System.IO.Path]::GetTempFileName()
        $a = @("-s", "-o", $sortie, "-w", "%{http_code}", "-X", $method, "$u$path")
        if ($tok) { $a += @("-H", "Authorization: Bearer $tok") }
        foreach ($h in @($entetes)) { if ($h) { $a += @("-H", $h) } }
        $entree = $null
        if ($json) {
            $entree = [System.IO.Path]::GetTempFileName()
            [System.IO.File]::WriteAllText($entree, $json, (New-Object System.Text.UTF8Encoding($false)))
            $a += @("-H", "Content-Type: application/json", "--data-binary", "@$entree")
        }
        $code = & curl.exe @a
        $corps = [System.IO.File]::ReadAllText($sortie)
        Remove-Item $sortie
        if ($entree) { Remove-Item $entree }
        [pscustomobject]@{ Code = [int]"$code"; Corps = $corps }
    }
    function Json($o) { $o | ConvertTo-Json -Compress }
    function Verifier($libelle, $attendu, $rep, $contient, $interdit) {
        $ok = ($rep.Code -eq $attendu)
        if ($ok -and $contient) { $ok = $rep.Corps.Contains($contient) }
        if ($ok -and $interdit) { $ok = -not $rep.Corps.Contains($interdit) }
        if ($ok) { $global:nbOk++; Write-Host ("PASS  {0}" -f $libelle) -ForegroundColor Green }
        else {
            $global:nbKo++
            $extrait = if ($rep.Corps.Length -gt 220) { $rep.Corps.Substring(0, 220) } else { $rep.Corps }
            Write-Host ("FAIL  {0} (attendu {1}, obtenu {2}) {3}" -f $libelle, $attendu, $rep.Code, $extrait) -ForegroundColor Red
        }
    }
    function Condition($libelle, $vrai) {
        if ($vrai) { $global:nbOk++; Write-Host ("PASS  {0}" -f $libelle) -ForegroundColor Green }
        else { $global:nbKo++; Write-Host ("FAIL  {0}" -f $libelle) -ForegroundColor Red }
    }
    function Jeton($email, $mdp) {
        $r = Appel POST "/auth/login" (Json @{email=$email;motDePasse=$mdp}) $null $null
        if ($r.Code -eq 200) { ($r.Corps | ConvertFrom-Json).token }
    }
    function Jeton2($email, $mdp, $entete) {
        $r = Appel POST "/auth/login" (Json @{email=$email;motDePasse=$mdp}) $null @($entete)
        if ($r.Code -eq 200) { ($r.Corps | ConvertFrom-Json).token }
    }
    function Compte($motif, $tok) {
        $r = Appel GET "/notifications" $null $tok $null
        ([regex]::Matches($r.Corps, [regex]::Escape($motif))).Count
    }
    function Occurrences($texte, $motif) { ([regex]::Matches($texte, [regex]::Escape($motif))).Count }
    function Obj($rep) { $rep.Corps | ConvertFrom-Json }
    function Liste($rep) { $r = $rep.Corps | ConvertFrom-Json; foreach ($x in $r) { $x } }





    function IdDe($rep) { try { [long]($rep.Corps | ConvertFrom-Json).id } catch { 0 } }
    function Connecter($email, $mdp) {
        $r = Appel POST "/auth/login" (Json @{email=$email;motDePasse=$mdp}) $null $null
        if ($r.Code -eq 403 -and $r.Corps.Contains("MOT_DE_PASSE_A_CHANGER")) {
            $nv = $mdp + "-Nv1"
            $null = Appel POST "/auth/changer-mot-de-passe" (Json @{email=$email;ancienMotDePasse=$mdp;nouveauMotDePasse=$nv}) $null $null
            $r = Appel POST "/auth/login" (Json @{email=$email;motDePasse=$nv}) $null $null
        }
        if ($r.Code -eq 200) { ($r.Corps | ConvertFrom-Json).token }
    }
    function Jour($n) { (Get-Date).AddDays($n).ToString("yyyy-MM-dd") }
    function Brut($url) {
        $sortie = [System.IO.Path]::GetTempFileName()
        $code = & curl.exe -s -o $sortie -w "%{http_code}" --max-time 5 $url
        $corps = [System.IO.File]::ReadAllText($sortie)
        Remove-Item $sortie
        [pscustomobject]@{ Code = [int]"$code"; Corps = $corps }
    }

    # ---- le service Python tourne
    $h = Brut "http://localhost:8000/health"
    Verifier "Service IA joignable (http://localhost:8000/health)" 200 $h '"statut"'
    if ($h.Code -ne 200) {
        Write-Host "Demarrez le service : cd ..\edutek-ia ; .\.venv\Scripts\Activate.ps1 ; uvicorn app.main:app --port 8000" -ForegroundColor Yellow
        return
    }
    $tA = Jeton "admin@tekup.tn" "admin123"
    if (-not $tA) { Write-Host "Connexion admin impossible : arret." -ForegroundColor Red; return }

    # ---- reentrainement et mise en production depuis le backend
    Write-Host "Reentrainement en cours (quelques dizaines de secondes)..." -ForegroundColor DarkGray
    $r = Appel POST "/ia/modeles/reentrainer" $null $tA $null
    Verifier "Reentrainement via le backend" 200 $r '"DEEP_LEARNING"'
    $modele = $null
    try { $modele = $r.Corps | ConvertFrom-Json } catch { }
    if (-not $modele) { Write-Host "Reponse inattendue : verifiez app.ia.mode=http et redemarrez le backend." -ForegroundColor Yellow; return }
    Condition "Le modele entraine est un reseau de neurones (gru-risque...) au statut ENTRAINE" (($modele.nom -like "gru-risque*") -and $modele.statut -eq "ENTRAINE")
    Verifier "Mise en production du modele" 200 (Appel PUT "/ia/modeles/$($modele.id)/statut" (Json @{statut="EN_PRODUCTION"}) $tA $null) '"EN_PRODUCTION"'
    $h = Brut "http://localhost:8000/health"
    Condition "Le service IA a bien active ce modele" ($h.Corps.Contains($modele.version) -and $h.Corps.Contains($modele.nom))
    Verifier "Modele inconnu refuse (404)" 404 (Appel PUT "/ia/modeles/999999/statut" (Json @{statut="EN_PRODUCTION"}) $tA $null)

    # ---- donnees : une classe de 3 etudiants (fort, faible, sans note)
    $f   = IdDe (Appel POST "/formations" (Json @{code="IA$s";nom="Formation IA $s";niveau="L3"}) $tA $null)
    $sem = IdDe (Appel POST "/semestres" (Json @{nom="S1 IA $s";dateDebut=(Jour -30);dateFin=(Jour 120);formationId=$f}) $tA $null)
    $m1  = IdDe (Appel POST "/matieres" (Json @{code="MA$s";nom="Maths IA $s";coefficient=2;credits=4;semestreId=$sem}) $tA $null)
    $c1  = IdDe (Appel POST "/classes" (Json @{code="CL$s";nom="Classe IA $s";anneeUniversitaire="2026-2027";formationId=$f}) $tA $null)
    $mailT = "tia.$s@tekup.tn"
    $t1 = IdDe (Appel POST "/enseignants" (Json @{nom="Ia";prenom="Prof";email=$mailT;motDePasse="enseignant$s";matricule="TIA$s";specialite="Maths"}) $tA $null)
    $et = @{}
    foreach ($i in 1..3) {
        $et[$i] = IdDe (Appel POST "/etudiants" (Json @{nom="Ia$i";prenom="Etu";email="eia$i.$s@tekup.tn";motDePasse="etudiant$s";matricule="MIA$i-$s";niveau="L3";classeId=$c1}) $tA $null)
    }
    $en = IdDe (Appel POST "/enseignements" (Json @{groupe="G1";volumeHoraire=30;enseignantId=$t1;matiereId=$m1;classeId=$c1;semestreId=$sem}) $tA $null)
    $ok = ($f -gt 0 -and $sem -gt 0 -and $m1 -gt 0 -and $c1 -gt 0 -and $t1 -gt 0 -and $en -gt 0 -and (1..3 | Where-Object { $et[$_] -gt 0 }).Count -eq 3)
    Condition "Donnees de test creees" $ok
    if (-not $ok) { return }
    $tT = Connecter $mailT "enseignant$s"
    $ev1 = IdDe (Appel POST "/evaluations" (Json @{type="CC";date=(Jour -5);coefficient=1;enseignementId=$en}) $tT $null)
    $ev2 = IdDe (Appel POST "/evaluations" (Json @{type="DS";date=(Jour -3);coefficient=1;enseignementId=$en}) $tT $null)
    Condition "Evaluations creees" ($tT -and $ev1 -gt 0 -and $ev2 -gt 0)
    if (-not ($tT -and $ev1 -gt 0 -and $ev2 -gt 0)) { return }
    $notes = @(@($ev1,$et[1],17), @($ev2,$et[1],18), @($ev1,$et[2],3), @($ev2,$et[2],4))
    $nOk = 0
    foreach ($n in $notes) {
        $x = Appel POST "/notes" (Json @{valeur=$n[2];evaluationId=$n[0];etudiantId=$n[1]}) $tA $null
        if ($x.Code -eq 201) { $nOk++ }
    }
    Condition "Notes saisies (etudiant fort : 17 et 18, etudiant faible : 3 et 4)" ($nOk -eq 4)

    # ---- analyse par le vrai modele
    $r = Appel POST "/ia/analyses?semestreId=$sem" $null $tA $null
    Verifier "Analyse du semestre par le service IA" 200 $r '"predictions"'
    $res = $null
    try { $res = $r.Corps | ConvertFrom-Json } catch { }
    if (-not $res) { return }
    Condition "Trois etudiants analyses, sans avertissement" ($res.analyses -eq 3 -and @($res.avertissements).Count -eq 0)
    $p = @{}
    foreach ($x in $res.predictions) { $p[[long]$x.etudiantId] = $x }
    Condition "Les predictions viennent du reseau de neurones et non du faux service" (@($res.predictions | Where-Object { $_.modeleNom -like "gru-risque*" }).Count -eq 3)
    Condition "Probabilites comprises entre 0 et 1" (@($res.predictions | Where-Object { $_.probabilite -ge 0 -and $_.probabilite -le 1 }).Count -eq 3)
    Condition "L'etudiant faible est nettement plus a risque que l'etudiant fort" ($p[[long]$et[2]].probabilite -gt $p[[long]$et[1]].probabilite + 0.3)
    Condition "Le niveau de risque suit la probabilite (faible : FAIBLE, faible note : MOYEN ou ELEVE)" ($p[[long]$et[1]].niveau -eq "FAIBLE" -and $p[[long]$et[2]].niveau -in @("MOYEN","ELEVE"))
    Condition "Une alerte est creee pour l'etudiant a risque" ($res.alertesCreees -ge 1)
    $fn = @($p[[long]$et[2]].facteurs | ForEach-Object { $_.nom })
    Condition "Facteurs explicatifs fournis, la moyenne en tete pour l'etudiant faible" ($fn.Count -ge 1 -and $fn[0] -eq "MOYENNE_SEMESTRE")
    $fnVide = @($p[[long]$et[3]].facteurs | ForEach-Object { $_.nom })
    Condition "Etudiant sans note : analyse possible, aucun facteur invente pour la moyenne" ($p[[long]$et[3]] -and ($fnVide -notcontains "MOYENNE_SEMESTRE"))

    # ---- consultation
    $r = Appel GET "/ia/predictions?semestreId=$sem" $null $tA $null
    Verifier "Consultation des predictions enregistrees" 200 $r 'gru-risque'
    $r = Appel GET "/ia/modeles" $null $tA $null
    Verifier "Le modele figure dans la liste des modeles, en production" 200 $r '"EN_PRODUCTION"'

    Write-Host ""
    Write-Host ("Bilan : {0} PASS, {1} FAIL" -f $global:nbOk, $global:nbKo) -ForegroundColor Cyan
}
VerifierLot11
