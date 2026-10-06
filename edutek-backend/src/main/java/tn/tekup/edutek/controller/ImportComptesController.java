package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ImportResultDto;
import tn.tekup.edutek.service.ImportComptesService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;

@RestController
@RequestMapping("/api/utilisateurs/import")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class ImportComptesController {

    private final ImportComptesService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto> importer(@RequestParam("fichier") MultipartFile fichier,
                                                    @RequestParam(defaultValue = "false") boolean simulation,
                                                    @RequestParam(defaultValue = "false") boolean ignorerErreurs)
            throws IOException {
        if (fichier.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide");
        }
        ImportResultDto resultat = service.importer(fichier.getBytes(), simulation, ignorerErreurs);
        HttpStatus statut = (!simulation && !ignorerErreurs && !resultat.erreurs().isEmpty())
                ? HttpStatus.BAD_REQUEST : HttpStatus.OK;
        return ResponseEntity.status(statut)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(resultat);
    }
}