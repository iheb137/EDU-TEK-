package tn.tekup.edutek.service;

import tn.tekup.edutek.entity.Notification;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    @Transactional
    public Notification notifier(Utilisateur destinataire, String titre, String contenu) {
        Notification n = new Notification();
        n.setDestinataire(destinataire);
        n.setTitre(coupe(titre, 255));
        n.setContenu(coupe(contenu, 1000));
        return notificationRepository.save(n);
    }

    private static String coupe(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }
}