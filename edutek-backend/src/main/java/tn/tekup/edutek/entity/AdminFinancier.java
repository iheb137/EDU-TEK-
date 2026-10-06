package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "admin_financiers")
@Getter
@Setter
@NoArgsConstructor
public class AdminFinancier extends Administrateur {
}
