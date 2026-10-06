package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "super_admins")
@Getter
@Setter
@NoArgsConstructor
public class SuperAdmin extends Administrateur {
}
