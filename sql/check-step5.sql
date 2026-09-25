-- Read-only checks. Run in the Supabase SQL Editor; makes no changes.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'qm_cards';

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'qm_cards';

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'qm_cards'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
