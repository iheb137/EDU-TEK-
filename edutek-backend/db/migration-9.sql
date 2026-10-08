-- Lot 9 : a executer UNE FOIS, application arretee, sur une base existante.
-- 1) Matricules uniques par etablissement (colonne matricule_cle = etablissement:matricule).
ALTER TABLE etudiants    ADD COLUMN IF NOT EXISTS matricule_cle varchar(255);
ALTER TABLE enseignants  ADD COLUMN IF NOT EXISTS matricule_cle varchar(255);
UPDATE etudiants e   SET matricule_cle = u.tenant_id || ':' || e.matricule FROM utilisateurs u WHERE u.id = e.id AND e.matricule_cle IS NULL;
UPDATE enseignants e SET matricule_cle = u.tenant_id || ':' || e.matricule FROM utilisateurs u WHERE u.id = e.id AND e.matricule_cle IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_etudiants_matricule_cle   ON etudiants(matricule_cle);
CREATE UNIQUE INDEX IF NOT EXISTS ux_enseignants_matricule_cle ON enseignants(matricule_cle);

-- 2) Retrait des unicites globales restantes (matricule, nom de workflow), contraintes ou index.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'u' AND array_length(con.conkey,1) = 1
      AND ((con.conrelid = 'public.etudiants'::regclass AND a.attname = 'matricule')
        OR (con.conrelid = 'public.enseignants'::regclass AND a.attname = 'matricule')
        OR (con.conrelid = 'public.workflows_n8n'::regclass AND a.attname = 'nom'))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE 'contrainte retiree : % (%)', c.conname, c.tbl;
  END LOOP;
  FOR c IN
    SELECT ic.relname AS idx
    FROM pg_index x
    JOIN pg_class ic ON ic.oid = x.indexrelid
    JOIN pg_class tc ON tc.oid = x.indrelid
    JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = x.indkey[0]
    WHERE x.indisunique AND NOT x.indisprimary AND x.indnatts = 1
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = x.indexrelid)
      AND ((tc.relname IN ('etudiants','enseignants') AND a.attname = 'matricule')
        OR (tc.relname = 'workflows_n8n' AND a.attname = 'nom'))
  LOOP
    EXECUTE format('DROP INDEX %I', c.idx);
    RAISE NOTICE 'index retire : %', c.idx;
  END LOOP;
END $$;

-- 3) Unicite par etablissement (garantie au niveau de la base).
CREATE UNIQUE INDEX IF NOT EXISTS ux_formations_tenant_code     ON formations(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_roles_tenant_nom           ON roles(tenant_id, nom);
CREATE UNIQUE INDEX IF NOT EXISTS ux_permissions_tenant_code    ON permissions(tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_workflows_tenant_nom       ON workflows_n8n(tenant_id, nom);