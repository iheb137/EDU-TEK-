package tn.tekup.edutek.security;

import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AccesHelper {

    public boolean estAdminPedagogie(Authentication auth) {
        return auth.getAuthorities().stream().anyMatch(a ->
                a.getAuthority().equals("ROLE_SUPERADMIN") || a.getAuthority().equals("ROLE_ADMIN_PEDAGOGIQUE"));
    }

    public boolean estProprietaire(Authentication auth, Enseignement e) {
        return estAdminPedagogie(auth) || e.getEnseignant().getEmail().equals(auth.getName());
    }

    public void verifierProprietaire(Authentication auth, Enseignement e) {
        if (!estProprietaire(auth, e)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cet enseignement ne vous est pas affecte");
        }
    }

    public void verifierEtudiantDansClasse(Etudiant etu, Enseignement ens) {
        if (etu.getClasse() == null || !etu.getClasse().getId().equals(ens.getClasse().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "L'etudiant n'appartient pas a la classe de cet enseignement");
        }
    }
}