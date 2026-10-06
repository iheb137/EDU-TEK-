package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ChangementMotDePasseRequest;
import tn.tekup.edutek.dto.LoginRequest;
import tn.tekup.edutek.dto.LoginResponse;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.security.JwtUtil;
import tn.tekup.edutek.service.AuditService;
import jakarta.annotation.PostConstruct;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.CredentialsExpiredException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UtilisateurRepository utilisateurRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    private String hashFactice;

    @PostConstruct
    void initialiser() {
        hashFactice = passwordEncoder.encode("mot-de-passe-factice-contre-timing");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        String email = request.getEmail() == null ? "" : request.getEmail().trim();
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(email, request.getMotDePasse()));
        } catch (AuthenticationException e) {
            audit.logPour(email, "LOGIN_ECHEC", "Utilisateur", null,
                    e instanceof CredentialsExpiredException ? "mot de passe temporaire" : "identifiants invalides");
            throw e;
        }

        Utilisateur utilisateur = utilisateurRepository.findByEmail(email).orElseThrow();
        audit.logPour(utilisateur.getEmail(), "LOGIN", "Utilisateur", utilisateur.getId(), null);

        LoginResponse response = new LoginResponse();
        response.setToken(jwtUtil.generateToken(utilisateur.getEmail()));
        response.setEmail(utilisateur.getEmail());
        response.setNom(utilisateur.getNom());
        response.setPrenom(utilisateur.getPrenom());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/changer-mot-de-passe")
    @Transactional
    public ResponseEntity<Map<String, String>> changerMotDePasse(@Valid @RequestBody ChangementMotDePasseRequest req) {
        String email = req.email().trim();
        Utilisateur u = utilisateurRepository.findByEmail(email).orElse(null);

        // Le hachage est toujours verifie, meme si le compte n'existe pas : meme duree de reponse.
        boolean ancienOk = passwordEncoder.matches(req.ancienMotDePasse(), u != null ? u.getMotDePasse() : hashFactice);
        if (u == null || !ancienOk || !Boolean.TRUE.equals(u.getActif())) {
            audit.logPour(email, "MDP_CHANGEMENT_ECHEC", "Utilisateur", u != null ? u.getId() : null, null);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Identifiants invalides");
        }
        if (req.nouveauMotDePasse().equals(req.ancienMotDePasse())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le nouveau mot de passe doit etre different de l'ancien");
        }
        u.setMotDePasse(passwordEncoder.encode(req.nouveauMotDePasse()));
        u.setMdpTemporaire(false);
        audit.logPour(u.getEmail(), "MDP_CHANGE", "Utilisateur", u.getId(), null);
        return ResponseEntity.ok(Map.of("message", "Mot de passe modifie. Reconnectez-vous."));
    }
}