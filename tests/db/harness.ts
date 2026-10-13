/**
 * In-process Postgres (PGlite) harness that applies the real migrations in
 * supabase/migrations against a minimal stub of the Supabase environment:
 * roles anon/authenticated/service_role, auth.users, auth.uid(), and Supabase's
 * default grants (so the migrations' revokes are exercised realistically).
 *
 * This verifies SQL, constraints, triggers, RPCs and RLS policies. It does not
 * replace testing against a real Supabase project (PostgREST, GoTrue, PG version).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const MIGRATIONS_DIR = join(import.meta.dirname, '../../supabase/migrations')

const SUPABASE_STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export interface TestDb {
  db: PGlite
  createUser: (email: string) => Promise<string>
  asUser: (userId: string) => Promise<void>
  asAnon: () => Promise<void>
  asAdmin: () => Promise<void>
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`, { cause: error })
    }
  }

  const asAdmin = async () => {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
  }

  return {
    db,
    asAdmin,
    async createUser(email) {
      await asAdmin()
      const result = await db.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      )
      return result.rows[0].id
    },
    async asUser(userId) {
      await asAdmin()
      await db.query(`select set_config('request.jwt.claims', $1, false)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
      await db.exec('set role authenticated')
    },
    async asAnon() {
      await asAdmin()
      await db.exec('set role anon')
    },
  }
}

/** Runs a query and returns the Postgres error message, or null if it succeeded. */
export async function errorOf(db: PGlite, sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params)
    return null
  } catch (error) {
    return (error as Error).message
  }
}
