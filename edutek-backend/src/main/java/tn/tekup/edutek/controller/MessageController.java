package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.MessageDto;
import tn.tekup.edutek.dto.MessageRequest;
import tn.tekup.edutek.entity.Message;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.MessageRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageRepository messageRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final NotificationService notificationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public MessageDto envoyer(@Valid @RequestBody MessageRequest req, Authentication auth) {
        Utilisateur exp = moi(auth);
        if (exp.getId().equals(req.destinataireId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas vous envoyer un message");
        }
        Utilisateur dest = utilisateurRepository.findById(req.destinataireId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Destinataire introuvable : " + req.destinataireId()));
        if (!Boolean.TRUE.equals(dest.getActif())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ce compte est desactive");
        }
        Message m = new Message();
        m.setExpediteur(exp);
        m.setDestinataire(dest);
        m.setObjet(req.objet().trim());
        m.setContenu(req.contenu().trim());
        Message saved = messageRepository.save(m);

        notificationService.notifier(dest,
                "Nouveau message de " + exp.getPrenom() + " " + exp.getNom(), saved.getObjet());
        return MessageDto.from(saved);
    }

    @GetMapping("/recus")
    @Transactional(readOnly = true)
    public List<MessageDto> recus(Authentication auth) {
        return messageRepository.findByDestinataireEmailOrderByDateEnvoiDesc(auth.getName()).stream()
                .map(MessageDto::from).toList();
    }

    @GetMapping("/envoyes")
    @Transactional(readOnly = true)
    public List<MessageDto> envoyes(Authentication auth) {
        return messageRepository.findByExpediteurEmailOrderByDateEnvoiDesc(auth.getName()).stream()
                .map(MessageDto::from).toList();
    }

    @GetMapping("/non-lus/count")
    @Transactional(readOnly = true)
    public Map<String, Long> compteur(Authentication auth) {
        return Map.of("nonLus", messageRepository.countByDestinataireEmailAndLuFalse(auth.getName()));
    }

    @GetMapping("/{id}")
    @Transactional
    public MessageDto detail(@PathVariable Long id, Authentication auth) {
        Message m = messageRepository.findById(id).orElseThrow(() -> introuvable(id));
        String email = auth.getName();
        boolean estDestinataire = m.getDestinataire().getEmail().equals(email);
        boolean estExpediteur = m.getExpediteur().getEmail().equals(email);
        if (!estDestinataire && !estExpediteur) {
            throw introuvable(id);
        }
        if (estDestinataire && !Boolean.TRUE.equals(m.getLu())) {
            m.setLu(true);
        }
        return MessageDto.from(m);
    }

    private Utilisateur moi(Authentication auth) {
        return utilisateurRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Compte introuvable"));
    }

    private ResponseStatusException introuvable(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Message introuvable : " + id);
    }
}