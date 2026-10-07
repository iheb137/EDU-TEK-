package tn.tekup.edutek.util;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.LongSupplier;

/**
 * Limiteur d'echecs d'authentification en memoire (une seule instance du serveur).
 * Deux compteurs par portee : un par couple (adresse IP, email), un par adresse IP seule.
 * Le compteur du couple est remis a zero apres un succes ; celui de l'IP ne l'est jamais.
 */
public final class LimiteurTentatives {

    private static final int TAILLE_MAX_TABLE = 10_000;
    private static final int LONGUEUR_MAX_EMAIL = 100;

    private final int maxParCouple;
    private final int maxParIp;
    private final long fenetreMs;
    private final LongSupplier horloge;
    private final ConcurrentHashMap<String, Deque<Long>> echecs = new ConcurrentHashMap<>();

    public LimiteurTentatives(int maxParCouple, int maxParIp, Duration fenetre, LongSupplier horloge) {
        this.maxParCouple = maxParCouple;
        this.maxParIp = maxParIp;
        this.fenetreMs = fenetre.toMillis();
        this.horloge = horloge;
    }

    public boolean estBloque(String portee, String ip, String email) {
        return compter(cleCouple(portee, ip, email)) >= maxParCouple || compter(cleIp(portee, ip)) >= maxParIp;
    }

    public void enregistrerEchec(String portee, String ip, String email) {
        ajouter(cleCouple(portee, ip, email));
        ajouter(cleIp(portee, ip));
        nettoyerSiNecessaire();
    }

    public void reinitialiser(String portee, String ip, String email) {
        echecs.remove(cleCouple(portee, ip, email));
    }

    private static String cleCouple(String portee, String ip, String email) {
        String e = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (e.length() > LONGUEUR_MAX_EMAIL) {
            e = e.substring(0, LONGUEUR_MAX_EMAIL);
        }
        return portee + "|" + ip + "|" + e;
    }

    private static String cleIp(String portee, String ip) {
        return portee + "|" + ip;
    }

    private int compter(String cle) {
        Deque<Long> d = echecs.get(cle);
        if (d == null) {
            return 0;
        }
        synchronized (d) {
            purger(d);
            return d.size();
        }
    }

    private void ajouter(String cle) {
        Deque<Long> d = echecs.computeIfAbsent(cle, k -> new ArrayDeque<>());
        synchronized (d) {
            purger(d);
            d.addLast(horloge.getAsLong());
        }
    }

    private void purger(Deque<Long> d) {
        long limite = horloge.getAsLong() - fenetreMs;
        while (!d.isEmpty() && d.peekFirst() <= limite) {
            d.pollFirst();
        }
    }

    private void nettoyerSiNecessaire() {
        if (echecs.size() > TAILLE_MAX_TABLE) {
            echecs.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    purger(e.getValue());
                    return e.getValue().isEmpty();
                }
            });
        }
    }
}