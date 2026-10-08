package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record IdsRequest(@NotNull @Size(min = 1, max = 200) List<Long> ids) {}