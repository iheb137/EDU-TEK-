package tn.tekup.edutek.config;

import tn.tekup.edutek.util.LimiteurTentatives;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class LimiteurConfig {

    @Bean
    public LimiteurTentatives limiteurTentatives(
            @Value("${app.security.login.max-par-ip-email:5}") int maxParCouple,
            @Value("${app.security.login.max-par-ip:30}") int maxParIp,
            @Value("${app.security.login.fenetre-minutes:15}") int fenetreMinutes) {
        return new LimiteurTentatives(maxParCouple, maxParIp, Duration.ofMinutes(fenetreMinutes), System::currentTimeMillis);
    }
}