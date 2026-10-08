package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.dto.ImportNotesResultDto;
import tn.tekup.edutek.service.ImportNotesService;

import java.io.IOException;

/** Import CSV des notes d'une evaluation. */
@RestController
@RequestMapping("/api/evaluations/{evaluationId}/notes/import")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class ImportNotesController {

    private final ImportNotesService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportNotesResultDto> importer(@PathVariable Long evaluationId,
                                                         @RequestParam("fichier") MultipartFile fichier,
                                                         @RequestParam(defaultValue = "false") boolean simulation,
                                                         @RequestParam(defaultValue = "false") boolean ignorerErreurs,
                                                         Authentication auth) throws IOException {
        if (fichier.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        ImportNotesResultDto resultat = service.importer(evaluationId, fichier.getBytes(), simulation, ignorerErreurs, auth);
        HttpStatus statut = (!simulation && !ignorerErreurs && !resultat.erreurs().isEmpty())
                ? HttpStatus.BAD_REQUEST : HttpStatus.OK;
        return ResponseEntity.status(statut)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(resultat);
    }
}