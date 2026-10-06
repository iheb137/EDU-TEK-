package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.LoginRequest;
import tn.tekup.edutek.dto.LoginResponse;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final UtilisateurRepository utilisateurRepository;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getMotDePasse())
        );

        Utilisateur utilisateur = utilisateurRepository.findByEmail(request.getEmail()).orElseThrow();

        String token = jwtUtil.generateToken(utilisateur.getEmail());

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setEmail(utilisateur.getEmail());
        response.setNom(utilisateur.getNom());
        response.setPrenom(utilisateur.getPrenom());

        return ResponseEntity.ok(response);
    }
}
