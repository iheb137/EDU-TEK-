package tn.tekup.edutek.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "admin_communications")
@Getter
@Setter
@NoArgsConstructor
public class AdminCommunication extends Administrateur {
}
