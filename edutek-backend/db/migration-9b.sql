-- Correctif lot 9 : cle de matricule calculee par la base (aucun callback Hibernate).
ALTER TABLE etudiants    ADD COLUMN IF NOT EXISTS matricule_cle varchar(255);
ALTER TABLE enseignants  ADD COLUMN IF NOT EXISTS matricule_cle varchar(255);

CREATE OR REPLACE FUNCTION fn_matricule_cle() RETURNS trigger AS $f$
BEGIN
  SELECT u.tenant_id || ':' || NEW.matricule INTO NEW.matricule_cle FROM utilisateurs u WHERE u.id = NEW.id;
  RETURN NEW;
END
$f$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_etudiants_matricule_cle ON etudiants;
CREATE TRIGGER trg_etudiants_matricule_cle BEFORE INSERT OR UPDATE OF matricule ON etudiants
  FOR EACH ROW EXECUTE FUNCTION fn_matricule_cle();
DROP TRIGGER IF EXISTS trg_enseignants_matricule_cle ON enseignants;
CREATE TRIGGER trg_enseignants_matricule_cle BEFORE INSERT OR UPDATE OF matricule ON enseignants
  FOR EACH ROW EXECUTE FUNCTION fn_matricule_cle();

UPDATE etudiants e   SET matricule_cle = u.tenant_id || ':' || e.matricule FROM utilisateurs u WHERE u.id = e.id AND e.matricule_cle IS NULL;
UPDATE enseignants e SET matricule_cle = u.tenant_id || ':' || e.matricule FROM utilisateurs u WHERE u.id = e.id AND e.matricule_cle IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_etudiants_matricule_cle   ON etudiants(matricule_cle);
CREATE UNIQUE INDEX IF NOT EXISTS ux_enseignants_matricule_cle ON enseignants(matricule_cle);