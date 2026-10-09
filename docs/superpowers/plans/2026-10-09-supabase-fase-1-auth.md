# Supabase Fase 0–1 (Persiapan + Fondasi Auth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Login asli ke Supabase self-hosted (Google + OTP email + consent `/welcome`) di balik `src/data/api.js`, dengan mock tetap jalan untuk test dan demo.

**Architecture:** `src/data/api.js` memilih adapter sekali lewat `VITE_DATA_SOURCE`. Adapter Supabase (`src/data/supabase/`) baru berisi grup `auth`; grup lain menolak dengan pesan jelas sampai Fase 2–3. Database: `profiles`, `consents`, `user_roles` dengan RLS + GRANT eksplisit, trigger pembuat profil, RPC `accept_consents`. Mock mengikuti kontrak auth baru supaya unit test dan e2e tetap jadi pengaman.

**Tech Stack:** React 19 + Vite 8, `@supabase/supabase-js@2.117.3`, Supabase CLI `supabase@2.120.0`, Postgres (RLS, plpgsql), pgTAP, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-supabase-backend-design.md`

## Global Constraints
- `@supabase/supabase-js` dikunci `2.117.3`, `supabase` CLI dikunci `2.120.0` (`--save-exact`), lockfile ikut.
- Secret key (`sb_secret_…`) tidak pernah bernama `VITE_*` dan tidak pernah diimpor kode `src/`.
- Setiap tabel `public`: `enable row level security`, `revoke all … from anon, authenticated`, lalu GRANT minimal. Setiap fungsi `public`: `revoke all … from public, anon`, `grant execute … to authenticated`.
- `CONSENT_VERSION = '2026-09-01'`; consent = `terms` + `privacy`.
- OTP 6 digit; kirim ulang 60 detik; kode demo mock tetap `148260` (`000000` salah, `999999` kedaluwarsa).
- Teks UI Bahasa Indonesia dengan sapaan "kamu"; target sentuh ≥ 44px (`min-h-11` / tombol `Button`); fokus keyboard tetap terlihat.
- UI hanya memanggil `api` dari `src/data/api.js`; `mockDb.js` tetap satu-satunya akses localStorage milik app (token supabase-js adalah pengecualian tercatat).
- Status session: `guest` → `pending` → `onboarding` → `authenticated`.

## Review Focus
1. **Login Google dibatalkan** → kembali ke `/register?error=…`; user mengharapkan pesan jelas, bukan halaman kosong. Test: Task 6 e2e `register shows the Google error`.
2. **User onboarding memanggil API data** → harus ditolak (`AUTH_REQUIRED` di mock). Test: Task 4 `nothing before consent`.
3. **Refresh di `/verify` pada mode Supabase** → email pending hilang, kembali ke `/register` tanpa error. Test: Task 5 `getSession is guest without a pending email`.
4. **Kode OTP salah/kedaluwarsa di Supabase** (`otp_expired`) → pesan Indonesia, field dikosongkan. Test: Task 3 + Task 5 mapping `OTP_INVALID`.
5. **User mencoba mengubah email atau memberi diri role lewat REST** → ditolak database. Test: Task 2 pgTAP.

---

### Task 1: Scaffold repo, env, dependency, dan konfigurasi Supabase lokal

**Files:**
- Create: `.gitignore`, `.env.example`, `supabase/config.toml` (via CLI)
- Modify: `.env.local` (nama variabel saja, nilai dipertahankan), `package.json`

**Interfaces:**
- Produces: env `VITE_DATA_SOURCE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; folder `supabase/`.

- [ ] **Step 1: git init + `.gitignore`**

```gitignore
node_modules/
dist/
test-results/
playwright-report/
.env
.env.*
!.env.example
supabase/.temp/
supabase/.branches/
```

Run: `git init` → Expected: `Initialized empty Git repository`. (Commit menunggu izin user.)

- [ ] **Step 2: Perbaiki nama variabel `.env.local` tanpa membaca/mencetak nilai**

```bash
node -e "const fs=require('fs');const f='.env.local';fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/^NEXT_PUBLIC_SUPABASE_URL=/m,'VITE_SUPABASE_URL=').replace(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m,'VITE_SUPABASE_PUBLISHABLE_KEY=').replace(/^NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=/m,'SUPABASE_SECRET_KEY='))"
```

Expected: nama variabel `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (tanpa prefix `VITE_`, jadi tidak pernah masuk bundle).

- [ ] **Step 3: `.env.example`**

```dotenv
# mock (default: demo + tests) | supabase (real backend)
VITE_DATA_SOURCE=mock
VITE_SUPABASE_URL=https://ruang-kpr.firdiaudi.my.id
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
# Never prefix the secret key with VITE_: only server-side scripts and Edge Functions may read it.
SUPABASE_SECRET_KEY=
```

- [ ] **Step 4: Dependency**

Run: `npm install @supabase/supabase-js@2.117.3 --save-exact` lalu `npm install -D supabase@2.120.0 --save-exact`
Expected: `package.json` berisi `"@supabase/supabase-js": "2.117.3"` dan `"supabase": "2.120.0"`.

- [ ] **Step 5: `npx supabase init`, lalu sesuaikan `supabase/config.toml`**

Ubah nilai berikut (kunci lain biarkan bawaan CLI):

```toml
project_id = "ruangkpr"

[auth]
site_url = "http://localhost:5173"
additional_redirect_urls = ["http://localhost:5173/**"]
jwt_expiry = 3600
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
enable_confirmations = true
otp_length = 6
otp_expiry = 600

[auth.email.template.magic_link]
subject = "Kode masuk RuangKPR"
content_path = "./supabase/templates/otp.html"

[auth.email.template.confirmation]
subject = "Kode masuk RuangKPR"
content_path = "./supabase/templates/otp.html"

[auth.sms]
enable_signup = false

# Lokal: isi env lalu ubah enabled = true (redirect URI Google: http://127.0.0.1:54321/auth/v1/callback).
[auth.external.google]
enabled = false
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
```

---

### Task 2: Migration fondasi auth + pgTAP + template OTP + runbook Fase 0

**Files:**
- Create: `supabase/migrations/<timestamp>_auth_foundation.sql` (via `npx supabase migration new auth_foundation`)
- Create: `supabase/tests/001_auth_foundation.test.sql`
- Create: `supabase/templates/otp.html`
- Create: `supabase/README.md` (runbook Fase 0 + cara menjalankan migration/test)

**Interfaces:**
- Produces: tabel `public.profiles`, `public.consents`, `public.user_roles`; RPC `public.accept_consents(p_name text, p_terms boolean, p_privacy boolean, p_version text) returns void`; helper `private.fail(code, message, field_errors jsonb)`, `private.has_role(role text)`, `private.bump_version()`.

- [ ] **Step 1: Tulis test pgTAP (gagal karena tabel belum ada)** — `supabase/tests/001_auth_foundation.test.sql`

```sql
-- Run: npx supabase test db (local) or paste into the Studio SQL Editor: everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', '{"full_name":"User A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"name":"Admin C"}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000c', 'super_admin');

select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'User A', 'signing up creates a profile with the Google name');
select is((select email from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 'b@test.local', 'the profile copies the login email');

set local role anon;
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok($$select public.accept_consents('Anon', true, true, '2026-09-01')$$, '42501', null, 'anon cannot call accept_consents');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select throws_ok($$update public.profiles set email = 'x@test.local'$$, '42501', null, 'the login email is not writable');
update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-00000000000b';
select throws_ok($$select public.accept_consents('Al', true, false, '2026-09-01')$$, 'P0001', 'Periksa kembali data kamu.', 'a short name and a missing privacy consent are rejected');
select lives_ok($$select public.accept_consents('  User Alpha ', true, true, '2026-09-01')$$, 'a valid consent succeeds');
select is((select count(*)::int from public.consents), 2, 'terms and privacy are recorded once');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000a', 'super_admin')$$, '42501', null, 'a user cannot grant themselves a role');
select throws_ok($$delete from public.consents$$, '42501', null, 'consents cannot be deleted');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where email like '%@test.local'), 3, 'a super admin reads every profile');
reset role;

select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), '', 'user A cannot rename user B');
select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'User Alpha', 'accept_consents stores the trimmed name');

select * from finish();
rollback;
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run (lokal, butuh Docker): `npx supabase test db` — atau tempel ke SQL Editor Studio VPS.
Expected: FAIL `relation "public.user_roles" does not exist`.

- [ ] **Step 3: Migration** — `npx supabase migration new auth_foundation`, isi file:

```sql
-- Auth foundation (spec 2026-10-09 §2–§3): profiles, consents, user_roles and shared helpers.
-- Every table: RLS on, inherited default grants revoked, then only the privileges the app needs.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Raises a domain error that src/data/supabase/errors.js maps to ApiError.
create or replace function private.fail(p_code text, p_message text, p_field_errors jsonb default '[]'::jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_message,
    detail = jsonb_build_object('code', p_code, 'fieldErrors', p_field_errors)::text;
end $$;

-- Optimistic concurrency (expectedVersion) for every table that carries `version`.
create or replace function private.bump_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

-- ---------- tables ----------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'content_writer')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  nik text check (nik is null or nik ~ '^[0-9]{16}$'),
  personal jsonb not null default '{}'::jsonb,
  finance jsonb not null default '{}'::jsonb,
  dashboard_layout jsonb,
  tours_seen text[] not null default '{}',
  takeover_kept jsonb,
  simulation jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('terms', 'privacy')),
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint consents_once unique (user_id, type, version)
);

create trigger profiles_bump_version before update on public.profiles
  for each row execute function private.bump_version();

-- Reads the caller's own user_roles row (allowed by its RLS policy), so no SECURITY DEFINER is needed.
create or replace function private.has_role(p_role text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = p_role)
$$;

-- Every new auth user gets a profile; the Google name is only a starting value, never used for authorization.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- privileges ----------

alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;

revoke all on public.user_roles, public.profiles, public.consents from anon, authenticated;
grant all on public.user_roles, public.profiles, public.consents to service_role;
grant select on public.user_roles to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, nik, personal, finance, dashboard_layout, tours_seen, takeover_kept, simulation)
  on public.profiles to authenticated;
grant select, insert on public.consents to authenticated;

create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy consents_insert_own on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------- RPC ----------

-- Writes only what the user may write anyway (own name, own consents): SECURITY INVOKER keeps RLS in force.
create or replace function public.accept_consents(p_name text, p_terms boolean, p_privacy boolean, p_version text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_errors jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    perform private.fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then
    v_errors := v_errors || jsonb_build_object('field', 'name', 'message', 'Nama minimal 3 huruf.');
  end if;
  if not coalesce(p_terms, false) then
    v_errors := v_errors || jsonb_build_object('field', 'acceptTerms', 'message', 'Centang persetujuan Syarat & Ketentuan untuk lanjut.');
  end if;
  if not coalesce(p_privacy, false) then
    v_errors := v_errors || jsonb_build_object('field', 'acceptPrivacy', 'message', 'Centang persetujuan Kebijakan Privasi untuk lanjut.');
  end if;
  if coalesce(p_version, '') = '' then
    v_errors := v_errors || jsonb_build_object('field', 'version', 'message', 'Versi persetujuan tidak dikenal.');
  end if;
  if jsonb_array_length(v_errors) > 0 then
    perform private.fail('VALIDATION_FAILED', 'Periksa kembali data kamu.', v_errors);
  end if;

  update public.profiles set full_name = btrim(p_name) where id = v_uid;
  insert into public.consents (user_id, type, version)
  values (v_uid, 'terms', p_version), (v_uid, 'privacy', p_version)
  on conflict on constraint consents_once do nothing;
end $$;

revoke all on function public.accept_consents(text, boolean, boolean, text) from public, anon;
grant execute on function public.accept_consents(text, boolean, boolean, text) to authenticated;

revoke all on all functions in schema private from public, anon;
grant execute on function private.fail(text, text, jsonb), private.has_role(text) to authenticated, service_role;
```

- [ ] **Step 4: Template OTP** — `supabase/templates/otp.html`

```html
<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,sans-serif;color:#0b1b33">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#003da5">RuangKPR</p>
      <h1 style="margin:0 0 16px;font-size:22px">Kode masuk kamu</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:22px">Masukkan kode ini di halaman verifikasi RuangKPR:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:8px">{{ .Token }}</p>
      <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#4a5568">Kode berlaku 10 menit. Jangan bagikan kode ini ke siapa pun, termasuk tim RuangKPR.</p>
      <p style="margin:0;font-size:13px;line-height:20px;color:#4a5568">Tidak merasa meminta kode? Abaikan email ini.</p>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Runbook** — `supabase/README.md` berisi: (1) mematikan signup phone (`ENABLE_PHONE_SIGNUP=false`, `ENABLE_PHONE_AUTOCONFIRM=false`) — saat ini aktif + autoconfirm di VPS; (2) env GoTrue (`SITE_URL`, `ADDITIONAL_REDIRECT_URLS`, `JWT_EXPIRY=3600`, `ENABLE_ANONYMOUS_USERS=false`, `MAILER_OTP_EXP=600`, `MAILER_OTP_LENGTH=6`); (3) OAuth Client Google + env `GOTRUE_EXTERNAL_GOOGLE_*`; (4) Resend (verifikasi domain, SMTP port 465); (5) templates-server Caddy + `GOTRUE_MAILER_TEMPLATES_MAGIC_LINK`/`_CONFIRMATION`; (6) menjalankan migration (SQL Editor atau `db push` via SSH tunnel) dan test pgTAP; (7) super_admin pertama; (8) backup sebelum pilot. Isi lengkap lihat file.

- [ ] **Step 6: Jalankan test, pastikan lulus**

Run: `npx supabase test db` (lokal) atau tempel file test ke SQL Editor setelah migration dijalankan.
Expected: `ok 1 … ok 14`, `# Looks like you passed all 14 tests`.

---

### Task 3: Error mapping, client, dan switch data source

**Files:**
- Create: `src/data/supabase/errors.js`, `src/data/supabase/errors.test.js`, `src/data/supabase/client.js`, `src/data/supabase/index.js`
- Modify: `src/data/api.js`

**Interfaces:**
- Produces: `toApiError(error, status?) → ApiError`; `must(request) → Promise<data>` (melempar `ApiError`); `supabase() → SupabaseClient`; `createSupabaseApi() → api`; `isMock: boolean` dari `src/data/api.js`.

- [ ] **Step 1: Test gagal** — `src/data/supabase/errors.test.js`

```js
import { describe, expect, it } from 'vitest'
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { must, toApiError } from './errors'

describe('toApiError', () => {
  it('turns a domain exception from SQL into the same ApiError the mock throws', () => {
    const e = toApiError({ code: 'P0001', message: 'Periksa kembali data kamu.', details: JSON.stringify({ code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'name', message: 'Nama minimal 3 huruf.' }] }) }, 400)
    expect(e).toMatchObject({ name: 'ApiError', code: 'VALIDATION_FAILED', status: 400, message: 'Periksa kembali data kamu.', fieldErrors: [{ field: 'name', message: 'Nama minimal 3 huruf.' }] })
  })

  it('maps permission and session failures', () => {
    expect(toApiError({ code: '42501', message: 'permission denied for table profiles' }, 403)).toMatchObject({ code: 'FORBIDDEN', status: 403 })
    expect(toApiError({ code: 'PGRST303', message: 'JWT expired' }, 401)).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 })
    expect(toApiError({ code: 'P0001', message: 'Sesi berakhir. Silakan masuk lagi.', details: '{"code":"AUTH_REQUIRED"}' })).toMatchObject({ code: 'AUTH_REQUIRED', status: 401 })
  })

  it('maps auth errors to Indonesian messages', () => {
    expect(toApiError(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'))).toMatchObject({ code: 'OTP_INVALID', message: 'Kode salah atau kedaluwarsa. Coba lagi atau kirim ulang kode.' })
    expect(toApiError(new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'))).toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('treats network failures as retryable', () => {
    expect(toApiError(new AuthRetryableFetchError('Failed to fetch', 0))).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
    expect(toApiError({ code: '', message: 'TypeError: Failed to fetch' }, 0)).toMatchObject({ code: 'SERVICE_UNAVAILABLE', retryable: true })
  })

  it('must returns data or throws the mapped error', async () => {
    await expect(must(Promise.resolve({ data: [1], error: null, status: 200 }))).resolves.toEqual([1])
    await expect(must(Promise.resolve({ data: null, error: { code: '42501', message: 'denied' }, status: 403 }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/data/supabase/errors.test.js` → Expected: FAIL `Failed to resolve import "./errors"`.

- [ ] **Step 3: Implementasi** — `src/data/supabase/errors.js`

```js
// Supabase/Postgres errors → the ApiError shape the UI already handles (spec 2026-10-09 §1).
import { isAuthError } from '@supabase/supabase-js'
import { ApiError } from '../apiError'

const make = (code, message, status, extra = {}) => new ApiError({ code, message, ...extra }, { status })
const offline = () => make('SERVICE_UNAVAILABLE', 'Koneksi bermasalah. Periksa koneksi lalu coba lagi.', 503, { retryable: true })
const SESSION_ENDED = ['AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.', 401]
const GOOGLE_OFF = ['SERVICE_UNAVAILABLE', 'Masuk dengan Google belum tersedia.', 503]

const AUTH = {
  otp_expired: ['OTP_INVALID', 'Kode salah atau kedaluwarsa. Coba lagi atau kirim ulang kode.', 401],
  over_email_send_rate_limit: ['RATE_LIMITED', 'Terlalu sering meminta kode. Tunggu sebentar lalu coba lagi.', 429],
  over_request_rate_limit: ['RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.', 429],
  email_address_invalid: ['VALIDATION_FAILED', 'Masukkan email yang valid.', 400],
  validation_failed: ['VALIDATION_FAILED', 'Periksa kembali data kamu.', 400],
  otp_disabled: ['SERVICE_UNAVAILABLE', 'Masuk dengan email sedang tidak tersedia.', 503],
  signup_disabled: ['SERVICE_UNAVAILABLE', 'Pendaftaran akun baru sedang ditutup.', 503],
  provider_disabled: GOOGLE_OFF,
  oauth_provider_not_supported: GOOGLE_OFF,
  session_expired: SESSION_ENDED,
  session_not_found: SESSION_ENDED,
  refresh_token_not_found: SESSION_ENDED,
  refresh_token_already_used: SESSION_ENDED,
}

// HTTP status per domain code raised by private.fail (same numbers the mock uses).
const STATUS = { AUTH_REQUIRED: 401, FORBIDDEN: 403, RESOURCE_NOT_FOUND: 404, VERSION_CONFLICT: 409, BANK_PRODUCT_EXPIRED: 410, DOCUMENTS_INCOMPLETE: 422, CONSENT_REQUIRED: 422 }

// Unique constraints that stand for a domain rule; later phases add theirs (spec §2).
const UNIQUE = {}

function fromAuth(error) {
  const known = AUTH[error.code]
  if (known) return make(known[0], known[1], known[2], { retryable: known[0] === 'RATE_LIMITED' })
  if (!error.status || error.status >= 500) return offline()
  return make('UNKNOWN', 'Permintaan gagal. Coba lagi.', error.status)
}

function fromPostgres(error, status) {
  if (error.code === 'P0001') {
    let detail = {}
    try {
      detail = JSON.parse(error.details || '{}')
    } catch {
      // a raise without our JSON detail: keep the message, call it a validation failure
    }
    const code = detail.code ?? 'VALIDATION_FAILED'
    return make(code, error.message, STATUS[code] ?? 400, { fieldErrors: detail.fieldErrors ?? [], details: detail.details ?? null })
  }
  if (error.code === '23505') {
    const known = UNIQUE[/"([^"]+)"/.exec(error.message ?? '')?.[1]]
    if (known) return make(...known)
  }
  if (error.code === '42501') return make('FORBIDDEN', 'Halaman ini di luar akses akun kamu.', 403)
  if (error.code === 'PGRST301' || error.code === 'PGRST303') return make(...SESSION_ENDED)
  if (error.code === 'PGRST116') return make('RESOURCE_NOT_FOUND', 'Data tidak ditemukan.', 404)
  if (!status || status >= 500 || /fetch|network/i.test(error.message ?? '')) return offline()
  return make('UNKNOWN', 'Permintaan gagal. Coba lagi.', status)
}

export function toApiError(error, status) {
  if (!error || error.name === 'ApiError') return error
  if (isAuthError(error)) return fromAuth(error)
  if (error instanceof TypeError) return offline()
  return fromPostgres(error, status)
}

// Awaits a supabase-js query: its data, or the mapped ApiError.
export async function must(request) {
  const { data, error, status } = await request
  if (error) throw toApiError(error, status)
  return data
}
```

- [ ] **Step 4: Run** `npx vitest run src/data/supabase/errors.test.js` → Expected: PASS (5 tests).

- [ ] **Step 5: Client** — `src/data/supabase/client.js`

```js
import { createClient } from '@supabase/supabase-js'

let client = null

// Created on first use so mock mode never needs the env. PKCE: the Google redirect returns a one-time code,
// never tokens in the URL. supabase-js keeps its session under its own localStorage key (spec §1).
export function supabase() {
  client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}
```

- [ ] **Step 6: Adapter + switch** — `src/data/supabase/index.js` dan `src/data/api.js`

```js
// src/data/supabase/index.js
import { ApiError } from '../apiError'
import { authApi } from './auth'

// ponytail: groups move here phase by phase (spec §8); until then any call says so instead of failing oddly.
const notReady = new Proxy(function notReady() {}, {
  get: (_, prop) => (prop === 'then' ? undefined : notReady),
  apply: () => Promise.reject(new ApiError({ code: 'SERVICE_UNAVAILABLE', message: 'Fitur ini belum tersedia di mode Supabase.' }, { status: 503 })),
})

export function createSupabaseApi() {
  return { auth: authApi, dashboard: notReady, profile: notReady, applications: notReady, bankProducts: notReady, mortgages: notReady, simulations: notReady, explore: notReady, activities: notReady, admin: notReady }
}
```

```js
// src/data/api.js
import { createMockApi } from './mockApi'
import { createSupabaseApi } from './supabase'

// Single switch point for the data adapter (doc 05 §17, spec 2026-10-09 §1). Components never import an adapter
// directly. The env value is replaced at build time, so the unused adapter is dropped from the bundle.
export const isMock = import.meta.env.VITE_DATA_SOURCE !== 'supabase'
export const api = isMock ? createMockApi({ latencyMs: import.meta.env.MODE === 'test' ? 0 : 300 }) : createSupabaseApi()
```

(`authApi` dibuat di Task 5; sebelum Task 5 selesai, buat `src/data/supabase/auth.js` berisi `export const authApi = {}` agar build tidak putus.)

---

### Task 4: Kontrak auth baru di mock + kontak seed menjadi email

**Files:**
- Modify: `src/domains/session/validation.js`, `src/lib/format.js`, `src/data/mockApi.js` (grup `auth`, helper kontak), `src/data/seed.js` (kontak, consent, `SCHEMA_VERSION`), `src/data/mockApi.test.js`

**Interfaces:**
- Produces (dipakai Task 5 dan 6):
  - `CONSENT_VERSION = '2026-09-01'`, `CONSENT_TYPES = ['terms', 'privacy']`, `validateEmail({ email }) → errors`, `validateWelcome({ name, acceptTerms, acceptPrivacy }) → errors` dari `@/domains/session/validation`.
  - `maskEmail(email) → 'na***@example.com'` dari `@/lib/format`.
  - `api.auth`: `getSession()`, `signInWithGoogle()`, `sendEmailOtp({ email }) → { maskedDestination, resendAvailableAt }`, `verifyEmailOtp({ token }) → { user }`, `resendOtp() → { resendAvailableAt }`, `acceptConsents({ name, acceptTerms, acceptPrivacy }) → { user }`, `logout()`, `deleteAccount()`.

- [ ] **Step 1: Test gagal** — ganti helper `signIn` dan `describe('auth')` di `src/data/mockApi.test.js`:

```js
const signIn = async (name, email) => {
  await api.auth.logout()
  await api.auth.sendEmailOtp({ email })
  await api.auth.verifyEmailOtp({ token: '148260' })
  if ((await api.auth.getSession()).status === 'onboarding') await api.auth.acceptConsents({ name, acceptTerms: true, acceptPrivacy: true })
}

describe('auth', () => {
  it('email OTP fixtures (000000 invalid, 999999 expired, 148260 ok), then consent; nothing before consent', async () => {
    mockControls.reset('guest')
    await expectCode(api.auth.sendEmailOtp({ email: 'x' }), 'VALIDATION_FAILED')
    const r = await api.auth.sendEmailOtp({ email: ' Nadia@Example.com ' })
    expect(r.maskedDestination).toBe('na***@example.com')
    await expectCode(api.auth.verifyEmailOtp({ token: '000000' }), 'OTP_INVALID')
    await expectCode(api.auth.verifyEmailOtp({ token: '999999' }), 'OTP_EXPIRED')
    await api.auth.verifyEmailOtp({ token: '148260' })
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding', role: null })
    await expectCode(api.dashboard.getSnapshot(), 'AUTH_REQUIRED')
    await expectCode(api.auth.acceptConsents({ name: 'Na', acceptTerms: true, acceptPrivacy: false }), 'VALIDATION_FAILED')
    await api.auth.acceptConsents({ name: 'Nadia Putri', acceptTerms: true, acceptPrivacy: true })
    const snap = await api.dashboard.getSnapshot()
    expect(snap.user).toMatchObject({ name: 'Nadia Putri', contact: 'nadia@example.com', contactType: 'email' })
    expect(snap.profile.consents.map((c) => [c.type, c.version])).toEqual([['terms', '2026-09-01'], ['privacy', '2026-09-01']])
    expect(snap.applications).toHaveLength(0)
  })

  it('Google opens the demo Google account; signing in again skips consent', async () => {
    mockControls.reset('guest')
    await api.auth.signInWithGoogle()
    expect(await api.auth.getSession()).toMatchObject({ status: 'onboarding', user: { contact: 'firdi.audi@email.com', name: 'Firdi Audi' } })
    await api.auth.acceptConsents({ name: 'Firdi Audi', acceptTerms: true, acceptPrivacy: true })
    await api.auth.logout()
    await api.auth.signInWithGoogle()
    expect(await api.auth.getSession()).toMatchObject({ status: 'authenticated', role: 'user' })
  })
  // (tes deleteAccount yang sudah ada tetap, dengan register/verifyOtp diganti signIn('Firdi Audi', 'firdi.audi@email.com'))
})
```

Ganti juga semua kontak telepon di file test: `'0812 3456 7890'` → `'firdi.audi@email.com'`, `'081200000101'` (sebagai argumen `signIn`) → `'rina.hartati@example.com'`, `'081200000104'` → `'agus.pratama@example.com'`, `'081200000105'` → `'sari.wulandari@example.com'`, `'081200000107'` → `'yoga.saputra@example.com'`, dan ekspektasi kontak Budi `'081200000102'` → `'budi.santoso@example.com'`. Assertion CSV yang memastikan `'081200000101'` tidak bocor tetap (nomor HP masih ada di profil).

- [ ] **Step 2: Run** `npx vitest run src/data/mockApi.test.js` → Expected: FAIL `api.auth.sendEmailOtp is not a function`.

- [ ] **Step 3: Validasi dan format**

```js
// src/domains/session/validation.js (isPhone/isEmail tetap: applications/validation.js memakainya)
// Version of the S&K + Kebijakan Privasi text the user agrees to; raising it asks everyone again (spec §3.1).
export const CONSENT_VERSION = '2026-09-01'
export const CONSENT_TYPES = ['terms', 'privacy']

export const validateEmail = (v) => (isEmail(v.email) ? {} : { email: 'Masukkan email yang valid.' })

export function validateWelcome(v) {
  const e = {}
  if (String(v.name ?? '').trim().length < 3) e.name = 'Nama minimal 3 huruf.'
  if (!v.acceptTerms) e.acceptTerms = 'Centang persetujuan Syarat & Ketentuan untuk lanjut.'
  if (!v.acceptPrivacy) e.acceptPrivacy = 'Centang persetujuan Kebijakan Privasi untuk lanjut.'
  return e
}
```

(`validateRegister` dihapus.) Di `src/lib/format.js`, di bawah `maskNik`:

```js
export const maskEmail = (email) => {
  const [name, domain] = String(email).split('@')
  return `${name.slice(0, 2)}***@${domain}`
}
```

- [ ] **Step 4: Seed** — di `src/data/seed.js`:
  - `SCHEMA_VERSION = 4` (komentar: `v4: sign-in by email only; seeded accounts carry consents`).
  - `USER.contact = 'firdi.audi@email.com'`, `contactType: 'email'`; export `export const GOOGLE_DEMO = { email: USER.contact, name: USER.name }`.
  - `const SEED_CONSENTS = CONSENT_TYPES.map((type) => ({ type, version: CONSENT_VERSION, acceptedAt: '2026-09-01T02:00:00.000Z' }))` (import dari `@/domains/session/validation`); tambahkan `consents: SEED_CONSENTS` ke `PROFILE_FULL`, ke `profile` di `personOf`, dan ke `staffAccount` (`{ ...newAccount({ ...staff }), profile: { consents: SEED_CONSENTS } }`).
  - `SAMPLES`: kontak telepon menjadi email dengan nomor tetap di `phone` — rina `rina.hartati@example.com` / `081200000101`, budi `budi.santoso@example.com` / `081200000102`, agus `agus.pratama@example.com` / `081200000104`, sari `sari.wulandari@example.com` / `081200000105`, yoga `yoga.saputra@example.com` / `081200000107`. `personOf`: `email: p.contact, phone: p.phone ?? null`. `sampleAccount`: `contactType: 'email'`.

- [ ] **Step 5: Grup `auth` di `src/data/mockApi.js`** — hapus `register`, `verifyOtp`, `isPhone`, `maskContact`; tambah helper dan method:

```js
// Signed-in account for a verified email: the account's own name wins over the provider's.
const consented = (db) => CONSENT_TYPES.every((t) => db.profile?.consents?.some((c) => c.type === t && c.version === CONSENT_VERSION))
function signInAs(db, contact, name = '') {
  switchAccount(db, contact)
  db.user = { role: 'user', createdAt: nowIso(db), name, ...db.user, id: db.user?.id ?? nextId(db, 'usr'), contact, contactType: 'email' }
  db.profile = { ...db.profile, fullName: db.profile?.fullName || db.user.name, email: db.profile?.email || contact }
  db.session = { status: consented(db) ? 'authenticated' : 'onboarding', verification: null }
}
```

```js
      signInWithGoogle: call('auth.signInWithGoogle', (db) => {
        signInAs(db, GOOGLE_DEMO.email, GOOGLE_DEMO.name)
        return { user: db.user }
      }, { auth: false }),
      sendEmailOtp: call('auth.sendEmailOtp', (db, { email } = {}) => {
        const value = String(email ?? '').trim().toLowerCase()
        if (!isEmail(value)) fail('VALIDATION_FAILED', 'Masukkan email yang valid.', 400, { fieldErrors: [{ field: 'email', message: 'Masukkan email yang valid.' }] })
        db.session = { status: 'pending', verification: { id: nextId(db, 'ver'), contact: value, maskedDestination: maskEmail(value), resendAvailableAt: Date.now() + OTP_COOLDOWN_MS, attemptsRemaining: 5 } }
        return { maskedDestination: db.session.verification.maskedDestination, resendAvailableAt: db.session.verification.resendAvailableAt }
      }, { auth: false }),
      verifyEmailOtp: call('auth.verifyEmailOtp', (db, { token } = {}) => {
        const v = db.session.verification
        if (db.session.status !== 'pending' || !v) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
        if (!/^\d{6}$/.test(String(token))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
        if (token === OTP_EXPIRED || v.attemptsRemaining <= 0) fail('OTP_EXPIRED', 'Kode kedaluwarsa. Kirim ulang kode baru.', 401)
        if (token !== OTP_OK) {
          v.attemptsRemaining -= 1
          saveDb(db)
          fail('OTP_INVALID', token === OTP_WRONG ? 'Kode salah. Coba lagi.' : 'Kode salah atau kedaluwarsa. Coba lagi.', 401)
        }
        signInAs(db, v.contact)
        return { user: db.user }
      }, { auth: false }),
      acceptConsents: call('auth.acceptConsents', (db, values = {}) => {
        if (db.session.status !== 'onboarding') fail('INVALID_STATE_TRANSITION', 'Persetujuan sudah tercatat.', 400)
        failOnFields(validateWelcome(values), 'Periksa kembali data kamu.')
        const at = nowIso(db)
        const name = values.name.trim()
        db.user = { ...db.user, name }
        db.profile = { ...db.profile, fullName: name, consents: CONSENT_TYPES.map((type) => ({ type, version: CONSENT_VERSION, acceptedAt: at })) }
        db.session = { status: 'authenticated', verification: null }
        return { user: db.user }
      }, { auth: false }),
```

Pesan `resendOtp` saat belum pending: `'Minta kode dulu.'`. Import tambahan: `CONSENT_TYPES, CONSENT_VERSION, validateWelcome, isEmail` dari `@/domains/session/validation`, `maskEmail` dari `@/lib/format`, `GOOGLE_DEMO` dari `./seed`.

- [ ] **Step 6: Run** `npx vitest run` → Expected: PASS semua file test.

---

### Task 5: Adapter auth Supabase

**Files:**
- Create: `src/data/supabase/auth.js`, `src/data/supabase/auth.test.js`

**Interfaces:**
- Consumes: `supabase()` (Task 3), `must`, `toApiError` (Task 3), `CONSENT_VERSION`, `CONSENT_TYPES`, `validateEmail`, `validateWelcome` (Task 4), `maskEmail` (Task 4).
- Produces: `authApi` dengan method dan bentuk return yang sama dengan mock (Task 4) + `onChange(callback) → unsubscribe`.

- [ ] **Step 1: Test gagal** — `src/data/supabase/auth.test.js`

```js
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthApiError } from '@supabase/supabase-js'

const state = { session: null, tables: {}, calls: [] }
const result = (data) => ({ data, error: null, status: 200 })
const query = (table) => {
  const rows = () => state.tables[table] ?? []
  const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve(result(rows()[0] ?? null)), then: (ok, ko) => Promise.resolve(result(rows())).then(ok, ko) }
  return q
}
const fake = {
  auth: {
    getSession: async () => ({ data: { session: state.session }, error: null }),
    signInWithOtp: async (args) => (state.calls.push(['otp', args]), { error: null }),
    verifyOtp: async (args) => (state.calls.push(['verify', args]), args.token === '148260' ? { error: null } : { error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired') }),
    signOut: async () => ({ error: null }),
  },
  from: query,
  rpc: async (name, args) => (state.calls.push(['rpc', name, args]), { data: null, error: null, status: 204 }),
}
vi.mock('./client', () => ({ supabase: () => fake }))
const { authApi } = await import('./auth')

const signedIn = { user: { id: 'u1', email: 'nadia@example.com', created_at: '2026-10-09T00:00:00Z' } }

beforeEach(async () => {
  Object.assign(state, { session: null, tables: {}, calls: [] })
  await authApi.logout()
})

describe('supabase authApi', () => {
  it('getSession is guest without a session or a pending email', async () => {
    expect(await authApi.getSession()).toEqual({ status: 'guest', role: null, user: null, verification: null })
  })

  it('sendEmailOtp validates, normalises, and leaves the session pending', async () => {
    await expect(authApi.sendEmailOtp({ email: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    const r = await authApi.sendEmailOtp({ email: ' Nadia@Example.com ' })
    expect(r.maskedDestination).toBe('na***@example.com')
    expect(state.calls[0]).toEqual(['otp', { email: 'nadia@example.com', options: { shouldCreateUser: true } }])
    expect(await authApi.getSession()).toMatchObject({ status: 'pending', verification: { maskedDestination: 'na***@example.com' } })
  })

  it('verifyEmailOtp maps a wrong code and keeps the email pending', async () => {
    await authApi.sendEmailOtp({ email: 'nadia@example.com' })
    await expect(authApi.verifyEmailOtp({ token: '000000' })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect((await authApi.getSession()).status).toBe('pending')
  })

  it('a signed-in user without consent is onboarding; with consent authenticated with their role', async () => {
    state.session = signedIn
    state.tables.profiles = [{ full_name: 'Nadia Putri', email: 'nadia@example.com', created_at: '2026-10-09T00:00:00Z' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'onboarding', role: null, user: { id: 'u1', name: 'Nadia Putri', contact: 'nadia@example.com', contactType: 'email' } })
    state.tables.consents = [{ type: 'terms' }, { type: 'privacy' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'authenticated', role: 'user' })
    state.tables.user_roles = [{ role: 'super_admin' }]
    expect(await authApi.getSession()).toMatchObject({ status: 'authenticated', role: 'super_admin' })
  })

  it('acceptConsents validates before calling the RPC with the active version', async () => {
    await expect(authApi.acceptConsents({ name: 'Na', acceptTerms: true, acceptPrivacy: true })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' })
    expect(state.calls).toHaveLength(0)
    await authApi.acceptConsents({ name: ' Nadia Putri ', acceptTerms: true, acceptPrivacy: true })
    expect(state.calls[0]).toEqual(['rpc', 'accept_consents', { p_name: 'Nadia Putri', p_terms: true, p_privacy: true, p_version: '2026-09-01' }])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/data/supabase/auth.test.js` → Expected: FAIL (`authApi.getSession is not a function`).

- [ ] **Step 3: Implementasi** — `src/data/supabase/auth.js`

```js
// Auth through Supabase: Google OAuth + email OTP, then the consent step (spec 2026-10-09 §3).
import { CONSENT_TYPES, CONSENT_VERSION, validateEmail, validateWelcome } from '@/domains/session/validation'
import { maskEmail } from '@/lib/format'
import { ApiError } from '../apiError'
import { supabase } from './client'
import { must, toApiError } from './errors'

const COOLDOWN_MS = 60_000
const GUEST = { status: 'guest', role: null, user: null, verification: null }
// ponytail: the email waiting for its code lives in this tab only; a refresh on /verify starts over at /register.
let pending = null

const fail = (code, message, status, extra = {}) => {
  throw new ApiError({ code, message, ...extra }, { status })
}
const failOnFields = (errors, message) => {
  const fieldErrors = Object.entries(errors).map(([field, msg]) => ({ field, message: msg }))
  if (fieldErrors.length) fail('VALIDATION_FAILED', message, 400, { fieldErrors })
}

async function sendCode(email) {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw toApiError(error)
  pending = { email, maskedDestination: maskEmail(email), resendAvailableAt: Date.now() + COOLDOWN_MS }
  return { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt }
}

export const authApi = {
  async getSession() {
    const { data, error } = await supabase().auth.getSession()
    if (error) throw toApiError(error)
    const s = data.session
    if (!s) return pending ? { ...GUEST, status: 'pending', verification: { maskedDestination: pending.maskedDestination, resendAvailableAt: pending.resendAvailableAt } } : GUEST
    const id = s.user.id
    const [profile, role, consents] = await Promise.all([
      must(supabase().from('profiles').select('full_name, email, created_at').eq('id', id).maybeSingle()),
      must(supabase().from('user_roles').select('role').eq('user_id', id).maybeSingle()),
      must(supabase().from('consents').select('type').eq('user_id', id).eq('version', CONSENT_VERSION)),
    ])
    const user = { id, name: profile?.full_name ?? '', contact: s.user.email, contactType: 'email', role: role?.role ?? 'user', createdAt: profile?.created_at ?? s.user.created_at }
    const consented = CONSENT_TYPES.every((t) => consents.some((c) => c.type === t))
    return { status: consented ? 'authenticated' : 'onboarding', role: consented ? user.role : null, user, verification: null }
  },

  async signInWithGoogle() {
    const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/register` } })
    if (error) throw toApiError(error)
    return new Promise(() => {}) // the browser is on its way to Google
  },

  async sendEmailOtp({ email } = {}) {
    const value = String(email ?? '').trim().toLowerCase()
    failOnFields(validateEmail({ email: value }), 'Masukkan email yang valid.')
    return sendCode(value)
  },

  async verifyEmailOtp({ token } = {}) {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    if (!/^\d{6}$/.test(String(token))) fail('VALIDATION_FAILED', 'Kode harus 6 angka.', 400)
    const { error } = await supabase().auth.verifyOtp({ email: pending.email, token: String(token), type: 'email' })
    if (error) throw toApiError(error)
    pending = null
    return { user: (await authApi.getSession()).user }
  },

  async resendOtp() {
    if (!pending) fail('INVALID_STATE_TRANSITION', 'Minta kode dulu.', 400)
    const wait = Math.ceil((pending.resendAvailableAt - Date.now()) / 1000)
    if (wait > 0) fail('RATE_LIMITED', `Tunggu ${wait} detik untuk kirim ulang.`, 429, { retryable: true, details: { retryAfterSeconds: wait } })
    const { resendAvailableAt } = await sendCode(pending.email)
    return { resendAvailableAt }
  },

  async acceptConsents({ name, acceptTerms, acceptPrivacy } = {}) {
    failOnFields(validateWelcome({ name, acceptTerms, acceptPrivacy }), 'Periksa kembali data kamu.')
    await must(supabase().rpc('accept_consents', { p_name: name.trim(), p_terms: true, p_privacy: true, p_version: CONSENT_VERSION }))
    return { user: (await authApi.getSession()).user }
  },

  async logout() {
    pending = null
    const { error } = await supabase().auth.signOut({ scope: 'local' })
    if (error) throw toApiError(error)
    return { loggedOut: true }
  },

  // Phase 3 (Edge Function delete-account, spec §2).
  async deleteAccount() {
    fail('SERVICE_UNAVAILABLE', 'Hapus akun belum tersedia. Hubungi cs@ruangkpr.id.', 503)
  },

  // Another tab signing out (or an expired refresh token) must reach the UI. Never call supabase inside the
  // listener itself: supabase-js holds a lock there.
  onChange(callback) {
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setTimeout(callback, 0)
    })
    return () => data.subscription.unsubscribe()
  },
}
```

Catatan: test `acceptConsents` di Step 1 mengharapkan `getSession` setelah RPC; fake `getSession` mengembalikan guest sehingga `user` = `null` — itu cukup untuk test ini.

- [ ] **Step 4: Run** `npx vitest run src/data/supabase` → Expected: PASS (errors + auth).

---

### Task 6: UI auth (Google + email, verifikasi, `/welcome`) dan routing per status

**Files:**
- Modify: `src/domains/session/AuthPages.jsx`, `src/domains/session/SessionProvider.jsx`, `src/app/App.jsx`, `src/domains/applications/ApplicationTracker.jsx` (blok demo hanya mode mock)
- Modify: `tests/e2e/helpers.js`, `tests/e2e/admin-access.spec.js`, `tests/e2e/admin-applications.spec.js`, `tests/e2e/admin-articles.spec.js`, `tests/e2e/admin-configuration.spec.js`, `tests/e2e/primary-flow.spec.js`
- Create: `tests/e2e/auth.spec.js`

**Interfaces:**
- Consumes: `api.auth.*` (Task 4/5), `isMock` (Task 3), `validateEmail`, `validateWelcome` (Task 4).
- Produces: route `/welcome`; `SessionGate({ allow })`; `HOME_OF` = `{ guest: '/register', pending: '/verify', onboarding: '/welcome', authenticated: '/' }`.

- [ ] **Step 1: e2e gagal** — `tests/e2e/helpers.js` `signIn`:

```js
// From the sign-in page: email → OTP 148260 → consent on first sign-in. One browser keeps every account.
export async function signIn(page, name, email) {
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Kirim kode' }).click()
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await page.waitForURL((url) => !/\/(register|verify)$/.test(url.pathname))
  if (new URL(page.url()).pathname === '/welcome') {
    await page.getByLabel('Nama Lengkap').fill(name)
    await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
    await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
    await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
    await expect(page).not.toHaveURL(/\/welcome$/)
  }
}
```

`tests/e2e/auth.spec.js`:

```js
import { expect, test } from '@playwright/test'
import { useScenario } from './helpers'

test('Google (mock) signs in, asks consent once, and Keluar returns to sign-in', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await page.getByRole('button', { name: 'Lanjut dengan Google' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByLabel('Nama Lengkap')).toHaveValue('Firdi Audi')
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click({ force: true })
  await expect(page.getByText('Centang persetujuan Syarat & Ketentuan untuk lanjut.')).toBeVisible()
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
  await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
  await expect(page).toHaveURL('http://localhost:5173/')
})

test('register shows the Google error when the user cancels at Google', async ({ page }) => {
  await useScenario(page, 'guest', '/register?error=access_denied&error_description=cancelled')
  await expect(page.getByRole('alert')).toContainText('Masuk dengan Google dibatalkan atau gagal')
})

test('verify page: wrong code, then back to change the email', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await page.getByRole('button', { name: 'Kirim kode' }).click({ force: true })
  await expect(page.getByText('Masukkan email yang valid.')).toBeVisible()
  await page.getByLabel('Email').fill('nadia@example.com')
  await page.getByRole('button', { name: 'Kirim kode' }).click()
  await expect(page.getByText('na***@example.com')).toBeVisible()
  await page.getByLabel('Digit 1 dari 6').fill('000000')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Kode salah')
  await page.getByRole('button', { name: 'Ubah email' }).click()
  await expect(page).toHaveURL(/\/register$/)
})
```

Spesifikasi lain: blok login manual di `admin-access.spec.js` dan `admin-applications.spec.js` diganti `signIn(page, 'Admin RuangKPR', 'admin@ruangkpr.id')` / `signIn(page, 'Rina Hartati', 'rina.hartati@example.com')`; `admin-articles.spec.js` `'081234567890'` → `'firdi.audi@email.com'`; `admin-configuration.spec.js` `'081200000107'` → `'yoga.saputra@example.com'`; `primary-flow.spec.js` bagian awal menjadi:

```js
test('primary: email → OTP → consent → 7 steps → submit → tracker (resume at step 5)', async ({ page }) => {
  await useScenario(page, 'guest', '/register')
  await page.getByLabel('Email').fill('firdi@example.com')
  await page.getByRole('button', { name: 'Kirim kode' }).click()
  await expect(page).toHaveURL(/\/verify$/)
  await expect(page.getByText('Step')).toHaveCount(0) // signing in is not an application step
  await page.getByLabel('Digit 1 dari 6').fill('000000')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page.getByRole('alert')).toContainText('Kode salah')
  await page.getByLabel('Digit 1 dari 6').fill('148260')
  await page.getByRole('button', { name: 'Verifikasi' }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  // Looks disabled (aria-disabled) but stays clickable so users learn what is missing; no API call happens.
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click({ force: true })
  await expect(page.getByText('Nama minimal 3 huruf.')).toBeVisible()
  await page.getByLabel('Nama Lengkap').fill('Firdi Audi')
  await page.getByRole('checkbox', { name: /Syarat & Ketentuan/ }).check()
  await page.getByRole('checkbox', { name: /Kebijakan Privasi/ }).check()
  await page.getByRole('button', { name: 'Mulai pakai RuangKPR' }).click()
  await expect(page).toHaveURL('http://localhost:5173/')
```

dan di step 1 data pribadi tambahkan `await page.getByLabel('Nomor Ponsel').fill('081234567890')` (sebelumnya terisi dari registrasi nomor HP).

- [ ] **Step 2: Run** `npx playwright test tests/e2e/auth.spec.js` → Expected: FAIL (tombol "Lanjut dengan Google" tidak ada).

- [ ] **Step 3: `AuthPages.jsx`** — `RegisterPage` menjadi "Masuk atau daftar" (tombol `Lanjut dengan Google` varian `neutral` dengan ikon `FcGoogle` dari `react-icons/fc`, pemisah "atau pakai email", `TextField` `Email` type `email`, tombol `Kirim kode`, alert dari `?error=` → `Masuk dengan Google dibatalkan atau gagal. Coba lagi.`). `VerifyPage`: tombol kembali `Ubah email`, judul `Masukkan kode`, `api.auth.verifyEmailOtp({ token: code })`, setelah sukses `await refresh()` (gate yang mengarahkan), petunjuk kode demo hanya bila `isMock`. `WelcomePage` baru: badge `Akun baru`, judul `Satu langkah lagi`, teks `Masuk sebagai <email>…`, `Nama Lengkap` (prefill `session.user.name`), dua centang + dialog legal (dipindah dari register), tombol `Mulai pakai RuangKPR`, tautan `Bukan akun kamu? Keluar`. Teks privasi: mode mock "Pada mode demo ini data disimpan di browser kamu saja."; mode Supabase "Data disimpan di server RuangKPR dan hanya bisa dibuka olehmu serta tim yang memproses pengajuanmu."

- [ ] **Step 4: `App.jsx`**

```js
// Where each session status belongs; a guard sends any session it does not serve to its home.
const HOME_OF = { guest: '/register', pending: '/verify', onboarding: '/welcome', authenticated: '/' }

function RequireAuth({ admin = false }) {
  const { session } = useSession()
  if (session.status !== 'authenticated') return <Navigate to={HOME_OF[session.status]} replace />
  const home = STAFF[session.role]?.home
  if (admin && !home) return <ForbiddenPage />
  if (!admin && home) return <Navigate to={home} replace />
  return <Outlet />
}

function SessionGate({ allow }) {
  const { session } = useSession()
  return allow.includes(session.status) ? <Outlet /> : <Navigate to={HOME_OF[session.status]} replace />
}
```

Route: `/register` → `<SessionGate allow={['guest', 'pending']} />`, `/verify` → `allow={['pending']}`, `/welcome` → `allow={['onboarding']}`. `DevPanel` hanya `import.meta.env.DEV && isMock`. Di `ApplicationTracker.jsx`, blok "MODE DEMO · SIMULASI RESPONS BANK" ikut syarat `isMock`.

- [ ] **Step 5: `SessionProvider.jsx`** — tambahkan setelah `refresh`:

```js
  // Supabase mode: another tab signing out or an expired session reaches every guard.
  useEffect(() => api.auth.onChange?.(refresh), [refresh])
```

- [ ] **Step 6: Run** `npx playwright test` → Expected: semua spec PASS.

---

### Task 7: Verifikasi menyeluruh + cek VPS

- [ ] **Step 1:** `npm run lint` → Expected: 0 error.
- [ ] **Step 2:** `npm test` → Expected: semua PASS.
- [ ] **Step 3:** `npm run build` dan `VITE_DATA_SOURCE=supabase npm run build` → Expected: keduanya sukses; `grep -r "sb_secret_" dist` kosong.
- [ ] **Step 4:** `npm run e2e` → Expected: semua PASS.
- [ ] **Step 5 (setelah user menjalankan migration di VPS):** dengan publishable key sebagai `anon`: `GET /rest/v1/profiles` → 401/403 `42501`; `POST /rest/v1/rpc/accept_consents` → 401/403. Test pgTAP di SQL Editor → 14/14 ok.
- [ ] **Step 6:** Review diff; checkpoint commit menunggu izin user.
