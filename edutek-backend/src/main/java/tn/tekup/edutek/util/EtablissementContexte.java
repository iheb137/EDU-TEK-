package tn.tekup.edutek.util;

import java.util.function.Supplier;

/** Etablissement de la requete en cours (par thread). Renseigne par EtablissementFilter. */
public final class EtablissementContexte {

    public static final String AUCUN = "_aucun";
    public static final String PLATEFORME = "plateforme";

    private static final ThreadLocal<String> COURANT = new ThreadLocal<>();

    private EtablissementContexte() {}

    public static String courant() {
        return COURANT.get();
    }

    public static void definir(String code) {
        COURANT.set(code);
    }

    public static void effacer() {
        COURANT.remove();
    }

    public static <T> T executer(String code, Supplier<T> action) {
        String avant = COURANT.get();
        COURANT.set(code);
        try {
            return action.get();
        } finally {
            if (avant == null) {
                COURANT.remove();
            } else {
                COURANT.set(avant);
            }
        }
    }

    public static void executerSansRetour(String code, Runnable action) {
        executer(code, () -> {
            action.run();
            return null;
        });
    }
}