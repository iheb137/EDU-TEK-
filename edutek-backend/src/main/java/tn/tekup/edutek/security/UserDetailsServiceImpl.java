package tn.tekup.edutek.security;

import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UtilisateurRepository utilisateurRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Utilisateur utilisateur = utilisateurRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable : " + email));

        List<SimpleGrantedAuthority> authorities = utilisateur.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getNom().toUpperCase()))
                .toList();

        return new User(utilisateur.getEmail(), utilisateur.getMotDePasse(), Boolean.TRUE.equals(utilisateur.getActif()), true, true, true, authorities);
    }
}