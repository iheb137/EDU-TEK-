-- Lot 7a : a executer UNE FOIS, application arretee, sur une base existante.
-- Ajoute tenant_id (valeur 'tekup') a toutes les tables racines, retire les unicites globales.
DO $$
DECLARE t record; c record;
BEGIN
  FOR t IN
    SELECT tb.table_name FROM information_schema.tables tb
    WHERE tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
      AND tb.table_name <> 'etablissements'
      AND EXISTS (SELECT 1 FROM information_schema.columns k
                  WHERE k.table_schema='public' AND k.table_name=tb.table_name AND k.column_name='id')
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint pc
        WHERE pc.conrelid = format('public.%I', tb.table_name)::regclass AND pc.contype = 'f'
          AND pc.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = pc.conrelid AND attname = 'id')])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id varchar(255)', t.table_name);
    EXECUTE format('UPDATE public.%I SET tenant_id = ''tekup'' WHERE tenant_id IS NULL', t.table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t.table_name);
    RAISE NOTICE 'tenant_id ajoute : %', t.table_name;
  END LOOP;

  -- unicites globales a remplacer par (tenant_id, colonne)
  FOR c IN
    SELECT con.conname, con.conrelid::regclass AS tbl
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'u' AND array_length(con.conkey,1) = 1
      AND ((con.conrelid = 'public.roles'::regclass AND a.attname = 'nom')
        OR (con.conrelid = 'public.permissions'::regclass AND a.attname = 'code')
        OR (con.conrelid = 'public.formations'::regclass AND a.attname = 'code')
        OR (con.conrelid = 'public.workflows_n8n'::regclass AND a.attname = 'nom'))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
    RAISE NOTICE 'unicite globale retiree : % (%)', c.conname, c.tbl;
  END LOOP;
END $$;