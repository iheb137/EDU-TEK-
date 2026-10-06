package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.NotificationDto;
import tn.tekup.edutek.entity.Notification;
import tn.tekup.edutek.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository notificationRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<NotificationDto> mesNotifications(Authentication auth) {
        return notificationRepository.findByDestinataireEmailOrderByDateEnvoiDesc(auth.getName()).stream()
                .map(NotificationDto::from).toList();
    }

    @GetMapping("/non-lues/count")
    @Transactional(readOnly = true)
    public Map<String, Long> compteur(Authentication auth) {
        return Map.of("nonLues", notificationRepository.countByDestinataireEmailAndLueFalse(auth.getName()));
    }

    @PatchMapping("/{id}/lue")
    @Transactional
    public NotificationDto marquerLue(@PathVariable Long id, Authentication auth) {
        Notification n = notificationRepository.findByIdAndDestinataireEmail(id, auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification introuvable : " + id));
        n.setLue(true);
        return NotificationDto.from(n);
    }

    @PostMapping("/tout-lire")
    @Transactional
    public Map<String, Integer> toutLire(Authentication auth) {
        List<Notification> nonLues = notificationRepository.findByDestinataireEmailAndLueFalse(auth.getName());
        nonLues.forEach(n -> n.setLue(true));
        return Map.of("marquees", nonLues.size());
    }
}