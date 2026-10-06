package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "admin_pedagogiques")
@Getter
@Setter
@NoArgsConstructor
public class AdminPedagogique extends Administrateur {
}
