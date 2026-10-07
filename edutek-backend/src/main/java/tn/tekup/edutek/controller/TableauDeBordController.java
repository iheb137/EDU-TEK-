package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.TableauDeBordDto;
import tn.tekup.edutek.service.TableauDeBordService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
public class TableauDeBordController {

    private final TableauDeBordService service;

    @GetMapping("/tableau-de-bord")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public TableauDeBordDto tableauDeBord(@RequestParam Long semestreId,
                                          @RequestParam(required = false) Long classeId) {
        return service.construire(semestreId, classeId);
    }
}