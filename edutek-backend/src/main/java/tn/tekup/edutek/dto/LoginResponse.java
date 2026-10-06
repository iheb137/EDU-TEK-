package tn.tekup.edutek.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginResponse {
    private String token;
    private String email;
    private String nom;
    private String prenom;
}
