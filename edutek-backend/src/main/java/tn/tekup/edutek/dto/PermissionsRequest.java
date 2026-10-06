package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record PermissionsRequest(@NotNull List<String> permissions) {}