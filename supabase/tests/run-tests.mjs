import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const USER = {
  admin: id(1),
  userA: id(2),
  userB: id(3),
  staff: id(4),
  customerA: id(5),
  customerB: id(6),
  legacy: id(90),
  missingProfile: id(91),
};
const EVENT = { publicA: id(201), draftA: id(202), publicB: id(203), draftB: id(204) };
const TICKET_TYPE = id(301);
const ORDER = { a: id(401), b: id(402) };
const ORDER_ITEM = { a: id(411), b: id(412) };
const PAYMENT = id(501);
const TICKET = { a: id(601), b: id(602) };
const STORAGE_OBJECT = { event: id(801), ticketFile: id(802), avatar: id(803) };

const db = new PGlite();
let passed = 0;
let failed = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

async function q(sql, params = []) {
  return db.query(sql, params);
}

async function setClaims(claims) {
  await q("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
}

async function resetSession() {
  await db.exec("RESET ROLE");
  await setClaims({});
}

async function asRole(role, claims, fn) {
  await resetSession();
  await setClaims(claims);
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await resetSession();
  }
}

const asAnon = (fn) => asRole("anon", {}, fn);
const asAuth = (userId, email, fn) =>
  asRole("authenticated", { sub: userId, role: "authenticated", email }, fn);
const asService = (fn) => asRole("service_role", { role: "service_role" }, fn);

async function expectError(name, sql, params = []) {
  try {
    await q(sql, params);
    ok(name, false, "expected an error but the statement succeeded");
  } catch (error) {
    ok(name, true, String(error.message).slice(0, 120));
  }
}

async function count(sql, params = []) {
  const result = await q(sql, params);
  return Number(result.rows[0].count);
}

async function ids(sql, params = []) {
  const result = await q(sql, params);
  return result.rows.map((row) => row.id);
}

async function applyShims() {
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;

    CREATE SCHEMA auth;
    CREATE SCHEMA extensions;
    GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
    CREATE FUNCTION extensions.gen_random_bytes(p_bytes integer)
    RETURNS bytea
    LANGUAGE sql
    VOLATILE
    AS $$
      SELECT decode(
        substr(repeat(md5(gen_random_uuid()::text), ceil(p_bytes / 16.0)::integer), 1, p_bytes * 2),
        'hex'
      );
    $$;
    CREATE FUNCTION extensions.digest(p_data bytea, p_algorithm text)
    RETURNS bytea
    LANGUAGE sql
    IMMUTABLE
    AS $$
      SELECT decode(
        md5(encode(p_data, 'hex')) || md5(p_algorithm || encode(p_data, 'hex')),
        'hex'
      );
    $$;

    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
      SELECT coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb,
        jsonb_build_object(
          'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
          'role', nullif(current_setting('request.jwt.claim.role', true), ''),
          'email', nullif(current_setting('request.jwt.claim.email', true), '')
        )
      );
    $$;

    CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
      SELECT (auth.jwt() ->> 'sub')::uuid;
    $$;

    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (
      id text PRIMARY KEY,
      name text NOT NULL,
      public boolean NOT NULL DEFAULT false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id text NOT NULL REFERENCES storage.buckets(id),
      name text NOT NULL,
      owner uuid,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    -- Supabase enables RLS on storage.objects by default. The shim must do the
    -- same because migration 0012 intentionally does not ALTER that table.
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT SELECT, INSERT ON auth.users TO service_role;
    GRANT SELECT ON auth.users TO anon, authenticated;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT SELECT ON storage.buckets TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
  `);
}

async function applyMigrations() {
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (file === "0013_admin_auth_and_invitations.sql") {
      await q(
        `INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
         VALUES ($1, 'legacy-customer@tickshow.test', '{"full_name":"Legacy Customer"}'::jsonb,
                 '2024-01-02T03:04:05Z')`,
        [USER.legacy],
      );
    }
    let sql = await readFile(path.join(migrationsDir, file), "utf8");
    if (file === "0021_ticket_delivery_and_one_time_download.sql") {
      sql = sql.replace(
        "CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;",
        "-- pgcrypto is represented by deterministic test shims in PGlite.",
      );
    }
    if (file === "0027_remove_organizer_subsystem.sql") {
      // Simulate deleting the empty managed bucket through Supabase Storage.
      await db.exec("DELETE FROM storage.buckets WHERE id = 'organizer-logos'");
    }
    if (file === "0030_repair_showcase_catalog_links.sql") {
      await db.exec(
        "ALTER TABLE public.storefront_events DISABLE TRIGGER trg_sync_storefront_event_to_catalog",
      );
      await q(
        `INSERT INTO public.storefront_events (
          slug, title, category, date_label, date_value, organizer_name,
          starts_at, ends_at, capacity, is_visible
        ) VALUES (
          'legacy-unlinked-event', 'Legacy Unlinked Event', 'Concerts & Music',
          'Test date', CURRENT_DATE + 10, 'Legacy Organizer',
          now() + interval '10 days', now() + interval '11 days', 12, false
        )`,
      );
      await db.exec(
        "ALTER TABLE public.storefront_events ENABLE TRIGGER trg_sync_storefront_event_to_catalog",
      );
    }
    await db.exec(sql);
    console.log(`  APPLIED ${file}`);
  }
}

async function seedTestContext() {
  await asService(async () => {
    const users = [
      [USER.admin, "admin@tickshow.test"],
      [USER.userA, "user-a@tickshow.test"],
      [USER.userB, "user-b@tickshow.test"],
      [USER.staff, "staff@tickshow.test"],
      [USER.customerA, "customer-a@tickshow.test"],
      [USER.customerB, "customer-b@tickshow.test"],
    ];
    for (const [userId, email] of users) {
      await q("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [userId, email]);
      await q(
        `INSERT INTO public.profiles (id, full_name, email)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [userId, email.split("@")[0], email],
      );
    }

    const roleId = async (name) => {
      const result = await q("SELECT id FROM public.roles WHERE name = $1", [name]);
      return result.rows[0].id;
    };
    for (const [userId, roleName] of [
      [USER.admin, "admin"],
      [USER.userA, "customer"],
      [USER.userB, "customer"],
      [USER.staff, "staff"],
      [USER.customerA, "customer"],
      [USER.customerB, "customer"],
    ]) {
      await q(
        `INSERT INTO public.user_roles (user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [userId, await roleId(roleName), USER.admin],
      );
    }

    const categoryResult = await q(
      "SELECT id FROM public.event_categories WHERE slug = 'concerts-music'",
    );
    const categoryId = categoryResult.rows[0].id;

    await q(
      `INSERT INTO public.events (id, organizer_name, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status, approved_at, published_at)
       VALUES ($1, 'Organizer Alpha', $2, $3, 'Public Alpha', 'public-alpha', now() + interval '1 day', now() + interval '2 days', 'published', 'approved', now(), now())`,
      [EVENT.publicA, categoryId, USER.userA],
    );
    await q(
      `INSERT INTO public.events (id, organizer_name, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status)
       VALUES ($1, 'Organizer Alpha', $2, $3, 'Draft Alpha', 'draft-alpha', now() + interval '3 day', now() + interval '4 days', 'draft', 'pending')`,
      [EVENT.draftA, categoryId, USER.userA],
    );
    await q(
      `INSERT INTO public.events (id, organizer_name, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status, approved_at, published_at)
       VALUES ($1, 'Organizer Beta', $2, $3, 'Public Beta', 'public-beta', now() + interval '5 day', now() + interval '6 days', 'published', 'approved', now(), now())`,
      [EVENT.publicB, categoryId, USER.userB],
    );
    await q(
      `INSERT INTO public.events (id, organizer_name, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status)
       VALUES ($1, 'Organizer Beta', $2, $3, 'Draft Beta', 'draft-beta', now() + interval '7 day', now() + interval '8 days', 'draft', 'pending')`,
      [EVENT.draftB, categoryId, USER.userB],
    );

    await q(
      `INSERT INTO public.event_staff (event_id, user_id, permission, status, assigned_by)
       VALUES ($1, $2, 'checkin', 'active', $3)`,
      [EVENT.publicA, USER.staff, USER.admin],
    );

    await q(
      `INSERT INTO public.ticket_types (id, event_id, name, price_amount, currency, quantity_total, max_per_order, sales_start_at, sales_end_at)
       VALUES ($1, $2, 'General admission', 1200, 'BDT', 100, 8, now() - interval '1 day', now() + interval '10 days')`,
      [TICKET_TYPE, EVENT.publicA],
    );

    for (const [orderId, eventId, customerId, email] of [
      [ORDER.a, EVENT.publicA, USER.customerA, "customer-a@tickshow.test"],
      [ORDER.b, EVENT.publicB, USER.customerB, "customer-b@tickshow.test"],
    ]) {
      await q(
        `INSERT INTO public.orders (id, customer_id, event_id, status, currency, subtotal_amount, total_amount, buyer_name, buyer_email, paid_at)
         VALUES ($1, $2, $3, 'paid', 'BDT', 2400, 2400, 'Test Buyer', $4, now())`,
        [orderId, customerId, eventId, email],
      );
      await q(
        `INSERT INTO public.order_items (id, order_id, ticket_type_id, quantity, unit_price_amount, line_total_amount, currency)
         VALUES ($1, $2, $3, 2, 1200, 2400, 'BDT')`,
        [orderId === ORDER.a ? ORDER_ITEM.a : ORDER_ITEM.b, orderId, TICKET_TYPE],
      );
    }

    await q(
      `INSERT INTO public.payments (id, order_id, payment_intent_id, amount, currency, status, payment_method, verified_at)
       VALUES ($1, $2, 'pi_phase1_test', 2400, 'BDT', 'succeeded', 'card', now())`,
      [PAYMENT, ORDER.a],
    );

    for (const [ticketId, orderId, orderItemId, customerId, hash] of [
      [TICKET.a, ORDER.a, ORDER_ITEM.a, USER.customerA, "a".repeat(64)],
      [TICKET.b, ORDER.b, ORDER_ITEM.b, USER.customerB, "b".repeat(64)],
    ]) {
      await q(
        `INSERT INTO public.tickets (id, order_id, order_item_id, customer_id, event_id, ticket_type_id, qr_token_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ticketId, orderId, orderItemId, customerId, EVENT.publicA, TICKET_TYPE, hash],
      );
    }

    await q(
      `INSERT INTO public.reviews (event_id, customer_id, rating, comment, status)
       VALUES ($1, $2, 5, 'Pending review', 'pending')`,
      [EVENT.publicA, USER.customerA],
    );
    await q(
      `INSERT INTO public.reviews (event_id, customer_id, rating, comment, status)
       VALUES ($1, $2, 4, 'Approved review', 'approved')`,
      [EVENT.publicA, USER.customerB],
    );

    await q(
      `INSERT INTO public.notifications (user_id, type, title) VALUES ($1, 'system', 'Customer A notice')`,
      [USER.customerA],
    );
    await q(
      `INSERT INTO public.notifications (user_id, type, title) VALUES ($1, 'system', 'Customer B notice')`,
      [USER.customerB],
    );

    await q(
      `INSERT INTO public.platform_settings (key, value, is_public) VALUES ('public.notice', '"hello"'::jsonb, true)`,
    );
    await q(
      `INSERT INTO public.platform_settings (key, value, is_public) VALUES ('internal.rate', '"secret"'::jsonb, false)`,
    );

    await db.exec(`
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES ('${STORAGE_OBJECT.event}', 'event-images', '${EVENT.publicA}/cover.jpg');
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES ('${STORAGE_OBJECT.ticketFile}', 'ticket-files', '${ORDER.a}/${TICKET.a}/pass.pdf');
      INSERT INTO storage.objects (id, bucket_id, name)
      VALUES ('${STORAGE_OBJECT.avatar}', 'user-avatars', '${USER.customerA}/avatar.png');
    `);
  });
}

async function testSchema() {
  console.log("\n[1] Schema, constraints and triggers");
  const legacyProfile = await q(
    `SELECT email, full_name, created_at FROM public.profiles WHERE id = $1`,
    [USER.legacy],
  );
  ok(
    "migration backfills profiles for existing Auth users and preserves their signup date",
    legacyProfile.rows[0]?.email === "legacy-customer@tickshow.test" &&
      legacyProfile.rows[0]?.full_name === "Legacy Customer" &&
      new Date(legacyProfile.rows[0]?.created_at).toISOString() === "2024-01-02T03:04:05.000Z",
    JSON.stringify(legacyProfile.rows[0]),
  );
  const repairedShowcase = await q(
    `SELECT showcase.normalized_event_id, event.title, ticket_type.name
     FROM public.storefront_events showcase
     JOIN public.events event ON event.id = showcase.normalized_event_id
     JOIN public.ticket_types ticket_type ON ticket_type.event_id = event.id
     WHERE showcase.slug = 'legacy-unlinked-event'`,
  );
  ok(
    "migration links complete legacy showcase events to the admin catalog",
    repairedShowcase.rows[0]?.normalized_event_id &&
      repairedShowcase.rows[0]?.title === "Legacy Unlinked Event" &&
      repairedShowcase.rows[0]?.name === "General Admission",
    JSON.stringify(repairedShowcase.rows[0]),
  );
  await q("DELETE FROM public.events WHERE slug = 'legacy-unlinked-event'");
  await q("DELETE FROM public.storefront_events WHERE slug = 'legacy-unlinked-event'");

  const tableCount = await count(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  ok("all application tables created", tableCount === 25, `found ${tableCount}`);

  const rlsCount = await count(
    `SELECT count(*) FROM pg_tables
     WHERE schemaname = 'public' AND rowsecurity = true`,
  );
  ok("RLS enabled on all application tables", rlsCount === 25, `found ${rlsCount}`);
  const removedTables = await count(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'organizers', 'organizer_staff', 'organizer_invitations',
         'organizer_payouts', 'organizer_commissions'
       )`,
  );
  ok("organizer and payout tables are removed", removedTables === 0);
  const organizerColumns = await count(
    `SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'organizer_id'`,
  );
  ok("event records no longer depend on organizer IDs", organizerColumns === 0);

  await q("ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created");
  await q(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
     VALUES ($1, 'missing-profile@tickshow.test', '{"full_name":"Recovered Customer"}'::jsonb,
             '2025-03-04T05:06:07Z')`,
    [USER.missingProfile],
  );
  await q("ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created");
  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    const rows = await q(
      `SELECT id, full_name, email, created_at
       FROM public.admin_list_customers()
       WHERE id = $1`,
      [USER.missingProfile],
    );
    ok(
      "admin customer directory repairs and returns Auth users missing profiles",
      rows.rows[0]?.id === USER.missingProfile &&
        rows.rows[0]?.full_name === "Recovered Customer" &&
        rows.rows[0]?.email === "missing-profile@tickshow.test" &&
        new Date(rows.rows[0]?.created_at).toISOString() === "2025-03-04T05:06:07.000Z",
      JSON.stringify(rows.rows[0]),
    );
  });
  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    await expectError(
      "customers cannot call the admin customer directory",
      "SELECT * FROM public.admin_list_customers()",
    );
  });

  await expectError(
    "negative ticket price rejected",
    `INSERT INTO public.ticket_types (event_id, name, price_amount, quantity_total, sales_start_at, sales_end_at)
     VALUES ($1, 'Negative', -1, 5, now(), now() + interval '1 day')`,
    [EVENT.publicA],
  );
  await expectError(
    "event end before start rejected",
    `INSERT INTO public.events (organizer_name, category_id, title, slug, starts_at, ends_at)
     SELECT 'Test Organizer', id, 'Bad window', 'bad-window', now(), now() - interval '1 day'
     FROM public.event_categories WHERE slug = 'sports'`,
  );
  await expectError(
    "duplicate event slug rejected",
    `INSERT INTO public.events (organizer_name, category_id, title, slug, starts_at, ends_at)
     SELECT 'Test Organizer', id, 'Duplicate slug', 'public-alpha', now(), now() + interval '1 day'
     FROM public.event_categories WHERE slug = 'sports'`,
  );
  await expectError(
    "duplicate payment intent rejected",
    `INSERT INTO public.payments (order_id, payment_intent_id, amount, currency)
     VALUES ($1, 'pi_phase1_test', 100, 'BDT')`,
    [ORDER.b],
  );
  await expectError(
    "refund above payment amount rejected",
    `INSERT INTO public.refunds (payment_id, order_id, amount, currency, status, processed_at)
     VALUES ($1, $2, 3000, 'BDT', 'succeeded', now())`,
    [PAYMENT, ORDER.a],
  );

  const inventoryBefore = await q(
    "SELECT available_quantity FROM public.ticket_inventory WHERE ticket_type_id = $1",
    [TICKET_TYPE],
  );
  ok("inventory counter created with ticket type", inventoryBefore.rows[0]?.available_quantity === 100);

  await q(
    `INSERT INTO public.ticket_inventory_reservations (ticket_type_id, order_id, quantity, status, expires_at, idempotency_key, confirmed_at)
     VALUES ($1, $2, 2, 'confirmed', now() + interval '10 min', 'phase1-check-1', now())`,
    [TICKET_TYPE, ORDER.a],
  );
  const inventoryAfter = await q(
    "SELECT reserved_quantity, sold_quantity, available_quantity FROM public.ticket_inventory WHERE ticket_type_id = $1",
    [TICKET_TYPE],
  );
  ok(
    "reservation updates inventory counters atomically",
    inventoryAfter.rows[0]?.sold_quantity === 2 &&
      inventoryAfter.rows[0]?.available_quantity === 98,
    JSON.stringify(inventoryAfter.rows[0]),
  );
  await expectError(
    "reservation beyond total inventory rejected",
    `INSERT INTO public.ticket_inventory_reservations (ticket_type_id, order_id, quantity, status, expires_at, confirmed_at)
     VALUES ($1, $2, 200, 'confirmed', now() + interval '10 min', now())`,
    [TICKET_TYPE, ORDER.a],
  );

  await q(
    `INSERT INTO public.ticket_checkins (ticket_id, event_id, scanned_by, result)
     VALUES ($1, $2, $3, 'success')`,
    [TICKET.a, EVENT.publicA, USER.staff],
  );
  await expectError(
    "second successful check-in rejected",
    `INSERT INTO public.ticket_checkins (ticket_id, event_id, scanned_by, result)
     VALUES ($1, $2, $3, 'success')`,
    [TICKET.a, EVENT.publicA, USER.staff],
  );
  const ticketAfterCheckin = await q(
    "SELECT status, checkin_status FROM public.tickets WHERE id = $1",
    [TICKET.a],
  );
  ok(
    "successful check-in updates ticket state",
    ticketAfterCheckin.rows[0]?.status === "used" &&
      ticketAfterCheckin.rows[0]?.checkin_status === "checked_in",
  );

  const privileges = await q(`
    SELECT
      has_table_privilege('authenticated', 'public.profiles', 'SELECT') AS profiles_select,
      has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS profiles_update,
      has_table_privilege('authenticated', 'public.storefront_events', 'INSERT') AS showcase_insert,
      has_table_privilege('anon', 'public.storefront_events', 'SELECT') AS showcase_public_select,
      has_function_privilege('authenticated', 'public.has_role(public.app_role)', 'EXECUTE') AS has_role_execute
  `);
  const p = privileges.rows[0] ?? {};
  ok(
    "explicit client table and function privileges are granted",
    p.profiles_select === true &&
      p.profiles_update === true &&
      p.showcase_insert === true &&
      p.showcase_public_select === true &&
      p.has_role_execute === true,
    JSON.stringify(p),
  );
}

async function testRls() {
  console.log("\n[2] RLS, role separation and cross-tenant isolation");

  await asAnon(async () => {
    const visible = await ids("SELECT id FROM public.events");
    ok(
      "anon sees only published approved events",
      visible.length === 2 && visible.includes(EVENT.publicA) && visible.includes(EVENT.publicB),
      JSON.stringify(visible),
    );
    const reviews = await ids("SELECT id FROM public.reviews");
    ok("anon sees only approved reviews", reviews.length === 1, JSON.stringify(reviews));
    const settings = await ids("SELECT id FROM public.platform_settings");
    ok("anon sees only public settings", settings.length === 1, JSON.stringify(settings));
    const audit = await count("SELECT count(*) FROM public.audit_logs");
    ok("anon cannot read audit logs", audit === 0);
  });

  await asAuth(USER.userA, "user-a@tickshow.test", async () => {
    const visible = await ids("SELECT id FROM public.events");
    ok(
      "regular user cannot see private event drafts",
      visible.includes(EVENT.publicA) && !visible.includes(EVENT.draftA) && !visible.includes(EVENT.draftB),
      JSON.stringify(visible),
    );
    const orders = await ids("SELECT id FROM public.orders");
    ok("regular user cannot read other customers' orders", orders.length === 0, JSON.stringify(orders));
    await expectError(
      "regular user cannot create catalog events",
      `INSERT INTO public.events (organizer_name, category_id, title, slug, starts_at, ends_at)
       SELECT 'Unauthorized', id, 'Unauthorized event', 'unauthorized-event', now(), now() + interval '1 day'
       FROM public.event_categories WHERE slug = 'sports'`,
    );
    await q("DELETE FROM public.events WHERE id = $1", [EVENT.publicA]);
    const publicEventRemains = await count(
      "SELECT count(*) FROM public.events WHERE id = $1",
      [EVENT.publicA],
    );
    ok("regular user cannot delete catalog events", publicEventRemains === 1);
  });

  await asAuth(USER.userB, "user-b@tickshow.test", async () => {
    const events = await ids("SELECT id FROM public.events");
    ok(
      "regular users cannot see unpublished events",
      events.length === 2 && !events.includes(EVENT.draftA) && !events.includes(EVENT.draftB),
      JSON.stringify(events),
    );
    await expectError(
      "non-admin cannot write event images",
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('event-images', $1)`,
      [`${EVENT.publicA}/intruder.jpg`],
    );
  });

  await asAuth(USER.staff, "staff@tickshow.test", async () => {
    const events = await ids("SELECT id FROM public.events");
    ok(
      "staff sees no private events outside explicit assignments",
      events.includes(EVENT.publicA) && !events.includes(EVENT.draftA) && !events.includes(EVENT.draftB),
      JSON.stringify(events),
    );
    await expectError(
      "staff cannot check in ticket from unassigned event",
      `INSERT INTO public.ticket_checkins (ticket_id, event_id, scanned_by, result)
       VALUES ($1, $2, $3, 'success')`,
      [TICKET.b, EVENT.publicB, USER.staff],
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const orders = await ids("SELECT id FROM public.orders");
    ok("customer A sees only own orders", orders.length === 1 && orders[0] === ORDER.a, JSON.stringify(orders));
    const tickets = await ids("SELECT id FROM public.tickets");
    ok("customer A sees only own tickets", tickets.length === 1 && tickets[0] === TICKET.a, JSON.stringify(tickets));
    const notifications = await ids("SELECT id FROM public.notifications");
    ok("customer A sees only own notifications", notifications.length === 1, JSON.stringify(notifications));
    await expectError(
      "customer cannot insert an order directly",
      `INSERT INTO public.orders (customer_id, event_id, subtotal_amount, total_amount, buyer_name, buyer_email)
       VALUES ($1, $2, 100, 100, 'Hacker', 'hacker@tickshow.test')`,
      [USER.customerA, EVENT.publicA],
    );
    await expectError(
      "customer cannot insert a role assignment",
      `INSERT INTO public.user_roles (user_id, role_id) SELECT $1, id FROM public.roles WHERE name = 'admin'`,
      [USER.customerA],
    );
    await expectError(
      "customer cannot self-assign admin via secure function",
      "SELECT public.assign_user_role($1, 'admin')",
      [USER.customerA],
    );
    await expectError(
      "customer cannot write a check-in",
      `INSERT INTO public.ticket_checkins (ticket_id, event_id, scanned_by, result)
       VALUES ($1, $2, $3, 'success')`,
      [TICKET.a, EVENT.publicA, USER.customerA],
    );
    await expectError(
      "customer cannot approve own review on insert",
      `INSERT INTO public.reviews (event_id, customer_id, rating, comment, status)
       VALUES ($1, $2, 5, 'Self approved', 'approved')`,
      [EVENT.draftA, USER.customerA],
    );
  });

  await asAuth(USER.customerB, "customer-b@tickshow.test", async () => {
    const tickets = await ids("SELECT id FROM public.tickets");
    ok("customer B cannot see customer A tickets", !tickets.includes(TICKET.a) && tickets.includes(TICKET.b), JSON.stringify(tickets));
    const privateFiles = await count("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ticket-files'");
    ok("customer B cannot read customer A private ticket file", privateFiles === 0);
    await expectError(
      "customer B cannot upload into customer A ticket folder",
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('ticket-files', $1)`,
      [`${ORDER.a}/${TICKET.a}/fake.pdf`],
    );
    await expectError(
      "customer B cannot write another user's avatar",
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('user-avatars', $1)`,
      [`${USER.customerA}/hijack.png`],
    );
  });

  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    const events = await ids("SELECT id FROM public.events");
    ok("admin sees all events", events.length === 4, JSON.stringify(events));
    const audit = await count("SELECT count(*) FROM public.audit_logs");
    ok("admin can read audit logs", audit === 0);
    const assigned = await q("SELECT public.assign_user_role($1, 'staff') AS role_id", [USER.customerB]);
    ok("admin can assign a role to another user", Boolean(assigned.rows[0]?.role_id));
    await q("SELECT public.remove_user_role($1, 'staff')", [USER.customerB]);
  });

  await asAnon(async () => {
    const publicAssets = await count(
      "SELECT count(*) FROM storage.objects WHERE bucket_id = 'event-images'",
    );
    ok("anon can read public event image", publicAssets === 1);
    const privateAssets = await count(
      "SELECT count(*) FROM storage.objects WHERE bucket_id = 'ticket-files'",
    );
    ok("anon cannot read private ticket files", privateAssets === 0);
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const ownFile = await count("SELECT count(*) FROM storage.objects WHERE bucket_id = 'ticket-files'");
    ok("order owner can read private ticket file", ownFile === 1);
    await q(
      `INSERT INTO storage.objects (bucket_id, name) VALUES ('ticket-files', $1)`,
      [`${ORDER.a}/${TICKET.a}/notes.pdf`],
    );
    ok("order owner can upload private ticket file", true);
  });
}

async function testAdminInvitations() {
  console.log("\n[3] Invite-only admin registration");
  const invitee = id(7);
  const inviteHash = "c".repeat(64);

  await asService(async () => {
    const seededRows = await count("SELECT count(*) FROM public.storefront_events");
    ok("migration removes all bundled showcase examples", seededRows === 0, `found ${seededRows}`);
    await q(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, 'invite-admin@tickshow.test', '{"full_name":"Invited Admin"}'::jsonb)`,
      [invitee],
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    await expectError(
      "customer cannot create an admin invitation",
      "SELECT public.create_admin_invitation($1, $2)",
      ["hacker@tickshow.test", "d".repeat(64)],
    );
  });

  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    await q("SELECT public.create_admin_invitation($1, $2)", [
      "invite-admin@tickshow.test",
      inviteHash,
    ]);
    const visible = await count("SELECT count(*) FROM public.admin_invitations");
    ok("admin can create an invitation", visible === 1, `found ${visible}`);
  });

  await asAnon(async () => {
    const visible = await count("SELECT count(*) FROM public.admin_invitations");
    ok("anon cannot read admin invitations", visible === 0);
    await expectError(
      "wrong invite token is rejected",
      "SELECT public.accept_admin_invitation($1, $2)",
      [invitee, "e".repeat(64)],
    );
    const accepted = await q("SELECT public.accept_admin_invitation($1, $2) AS accepted", [
      invitee,
      inviteHash,
    ]);
    ok("valid invite grants admin role", accepted.rows[0]?.accepted === true);
    await expectError(
      "invite token cannot be reused",
      "SELECT public.accept_admin_invitation($1, $2)",
      [invitee, inviteHash],
    );
  });

  await asService(async () => {
    const roles = await ids(
      `SELECT r.name AS id FROM public.user_roles ur
       JOIN public.roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [invitee],
    );
    ok("invited user has admin role", roles.includes("admin"), JSON.stringify(roles));
    const profile = await count("SELECT count(*) FROM public.profiles WHERE id = $1", [invitee]);
    ok("auth trigger created the profile", profile === 1);
  });
}

async function testAdminManagement() {
  console.log("\n[4] Controlled administrative management");

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    await q("UPDATE public.orders SET status = 'cancelled' WHERE id = $1", [ORDER.a]);
  });
  await asService(async () => {
    const order = await q("SELECT status FROM public.orders WHERE id = $1", [ORDER.a]);
    ok("customer cannot change an order status", order.rows[0]?.status === "paid", order.rows[0]?.status);
  });

  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    await expectError(
      "admin cannot alter order amounts",
      "UPDATE public.orders SET total_amount = 1 WHERE id = $1",
      [ORDER.a],
    );
    await q("UPDATE public.orders SET status = 'refunded' WHERE id = $1", [ORDER.a]);
    const orderStatus = await q("SELECT status FROM public.orders WHERE id = $1", [ORDER.a]);
    ok("admin can update order status", orderStatus.rows[0]?.status === "refunded");

    const auditCount = await count(
      "SELECT count(*) FROM public.audit_logs WHERE actor_id = $1",
      [USER.admin],
    );
    ok("admin mutations write audit entries", auditCount >= 1, `found ${auditCount}`);

    const adminRole = await q("SELECT public.has_role('admin') AS value");
    ok("has_role reports admin for an admin session", adminRole.rows[0]?.value === true);
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const customerRole = await q("SELECT public.has_role('admin') AS value");
    ok("has_role reports false for a customer session", customerRole.rows[0]?.value === false);
  });
}

async function testStorefrontShowcase() {
  console.log("\n[5] Storefront showcase management");

  await asService(async () => {
    await q(
      `INSERT INTO public.storefront_events (
        slug, title, category, date_label, date_value, price_amount, event_group, is_visible
      ) VALUES
        ('showcase-alpha', 'Test Event Alpha', 'Concerts & Music', 'Test date', CURRENT_DATE, 500, 'upcoming', true),
        ('showcase-hidden', 'Test Event Hidden', 'Sports', 'Test date', CURRENT_DATE, 400, 'upcoming', true)`,
    );
  });

  await asAnon(async () => {
    const visible = await count("SELECT count(*) FROM public.storefront_events WHERE is_visible");
    ok("showcase test fixtures are publicly visible", visible === 2, `found ${visible}`);
    await expectError(
      "anon cannot edit showcase events",
      "UPDATE public.storefront_events SET title = 'Hacked' WHERE slug = 'showcase-alpha'",
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const before = await q(
      "SELECT price_amount FROM public.storefront_events WHERE slug = 'showcase-alpha'",
    );
    await q(
      "UPDATE public.storefront_events SET price_amount = 1 WHERE slug = 'showcase-alpha'",
    );
    const after = await q(
      "SELECT price_amount FROM public.storefront_events WHERE slug = 'showcase-alpha'",
    );
    ok(
      "customer cannot edit showcase events",
      Number(before.rows[0]?.price_amount) === Number(after.rows[0]?.price_amount),
      `${before.rows[0]?.price_amount} → ${after.rows[0]?.price_amount}`,
    );
  });

  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    await q(
      `UPDATE public.storefront_events
       SET event_group = 'ongoing', is_carousel = true, carousel_order = 1
       WHERE slug = 'showcase-alpha'`,
    );
    const moved = await q(
      `SELECT event_group, is_carousel, carousel_order
       FROM public.storefront_events WHERE slug = 'showcase-alpha'`,
    );
    ok(
      "admin can move an event to ongoing and the carousel",
      moved.rows[0]?.event_group === "ongoing" &&
        moved.rows[0]?.is_carousel === true &&
        moved.rows[0]?.carousel_order === 1,
      JSON.stringify(moved.rows[0]),
    );
    await q(
      "UPDATE public.storefront_events SET is_visible = false WHERE slug = 'showcase-hidden'",
    );

    await expectError(
      "showcase catalog event requires complete operational details",
      `INSERT INTO public.storefront_events (
        slug, title, category, date_label, date_value, organizer_name, starts_at
      ) VALUES (
        'showcase-incomplete', 'Incomplete Catalog Event', 'Concerts & Music',
        'Test date', CURRENT_DATE, 'Test Organizer', now()
      )`,
    );

    const linked = await q(
      `INSERT INTO public.storefront_events (
        slug, title, category, date_label, date_value, price_amount, event_group,
        organizer_name, starts_at, ends_at, capacity
      ) VALUES (
        'showcase-linked', 'Linked Showcase Event', 'Concerts & Music',
        'Test date', CURRENT_DATE + 10, 950, 'upcoming', 'Test Organizer',
        now() + interval '10 days', now() + interval '11 days', 60
      )
      RETURNING normalized_event_id`,
    );
    const catalogEvent = await q(
      `SELECT title, organizer_name, status, approval_status, capacity
       FROM public.events WHERE id = $1`,
      [linked.rows[0]?.normalized_event_id],
    );
    const ticketType = await q(
      `SELECT id, name, price_amount, quantity_total, max_per_order
       FROM public.ticket_types WHERE event_id = $1`,
      [linked.rows[0]?.normalized_event_id],
    );
    const inventory = await q(
      `SELECT total_quantity, available_quantity FROM public.ticket_inventory
       WHERE ticket_type_id = $1`,
      [ticketType.rows[0]?.id],
    );
    ok(
      "showcase creation adds a pending catalog event and General Admission inventory",
      catalogEvent.rows[0]?.title === "Linked Showcase Event" &&
        catalogEvent.rows[0]?.organizer_name === "Test Organizer" &&
        catalogEvent.rows[0]?.status === "draft" &&
        catalogEvent.rows[0]?.approval_status === "pending" &&
        Number(catalogEvent.rows[0]?.capacity) === 60 &&
        ticketType.rows[0]?.name === "General Admission" &&
        Number(ticketType.rows[0]?.price_amount) === 950 &&
        Number(ticketType.rows[0]?.quantity_total) === 60 &&
        Number(ticketType.rows[0]?.max_per_order) === 8 &&
        Number(inventory.rows[0]?.total_quantity) === 60 &&
        Number(inventory.rows[0]?.available_quantity) === 60,
      JSON.stringify({ event: catalogEvent.rows[0], ticketType: ticketType.rows[0], inventory: inventory.rows[0] }),
    );

    await q(
      `UPDATE public.storefront_events
       SET title = 'Updated Showcase Event', organizer_name = 'Updated Test Organizer', capacity = 45
       WHERE slug = 'showcase-linked'`,
    );
    const synced = await q(
      `SELECT e.title, e.organizer_name, e.capacity, tt.quantity_total, ti.total_quantity
       FROM public.storefront_events se
       JOIN public.events e ON e.id = se.normalized_event_id
       JOIN public.ticket_types tt ON tt.event_id = e.id
       JOIN public.ticket_inventory ti ON ti.ticket_type_id = tt.id
       WHERE se.slug = 'showcase-linked'`,
    );
    ok(
      "showcase edits keep linked catalog details and inventory synchronized",
      synced.rows[0]?.title === "Updated Showcase Event" &&
        synced.rows[0]?.organizer_name === "Updated Test Organizer" &&
        Number(synced.rows[0]?.capacity) === 45 &&
        Number(synced.rows[0]?.quantity_total) === 45 &&
        Number(synced.rows[0]?.total_quantity) === 45,
      JSON.stringify(synced.rows[0]),
    );
  });

  await asAnon(async () => {
    const hidden = await count(
      "SELECT count(*) FROM public.storefront_events WHERE slug = 'showcase-hidden'",
    );
    ok("hidden showcase event is not public", hidden === 0, `found ${hidden}`);
  });
}

async function testStorefrontBookings() {
  console.log("\n[6] Authenticated storefront booking persistence");
  let primaryBookingReference = "";
  let firstTicketId = "";
  const firstTicketToken = "a".repeat(64);
  const secondTicketToken = "b".repeat(64);

  await asService(async () => {
    await q(
      `INSERT INTO public.storefront_events (
        slug, title, category, date_label, date_value, time_label, venue, location,
        price_amount, event_group, is_visible, ticket_design_style, ticket_design_image_path
      ) VALUES
        ('booking-upcoming', 'Booking Test Event', 'Concerts & Music', 'Old sample date', DATE '2000-01-01', '8:00 PM', 'Test Hall', 'Dhaka', 1200, 'upcoming', true, 'festival', 'booking-upcoming/ticket-design.png'),
        ('booking-ongoing', 'Ongoing Test Event', 'Sports', 'Old sample date', DATE '2000-01-01', '7:00 PM', 'Test Ground', 'Dhaka', 800, 'ongoing', true, 'classic', NULL),
        ('booking-hidden', 'Hidden Test Event', 'Sports', 'Test date', CURRENT_DATE, '6:00 PM', 'Test Hall', 'Dhaka', 400, 'upcoming', false, 'classic', NULL),
        ('booking-past', 'Past Test Event', 'Sports', 'Test date', CURRENT_DATE, '6:00 PM', 'Test Hall', 'Dhaka', 400, 'past', true, 'classic', NULL)`,
    );
    await expectError(
      "unsupported event ticket design is rejected",
      `INSERT INTO public.storefront_events (
        slug, title, category, date_label, date_value, ticket_design_style
      ) VALUES (
        'invalid-ticket-design', 'Invalid Ticket Design', 'Sports',
        'Test date', CURRENT_DATE, 'unknown'
      )`,
    );
  });

  await asAnon(async () => {
    await expectError(
      "anonymous visitors cannot create bookings",
      `SELECT * FROM public.create_storefront_booking(
        'booking-upcoming', 1, 'Demo Buyer', 'buyer@example.test', '01234567890'
      )`,
    );
    await expectError(
      "anonymous clients cannot read booking details",
      "SELECT * FROM public.storefront_bookings",
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const result = await q(
      `SELECT * FROM public.create_storefront_booking(
        'booking-upcoming', 2, 'Demo Buyer', 'customer-a@tickshow.test', '01234567890'
      )`,
    );
    ok(
      "signed-in checkout stores a booking at the database event price",
      result.rows[0]?.booking_reference?.startsWith("TS-") &&
        Number(result.rows[0]?.total_amount) === 2400 &&
        !Object.hasOwn(result.rows[0] ?? {}, "ticket_token"),
      JSON.stringify(result.rows[0]),
    );
    primaryBookingReference = result.rows[0]?.booking_reference;
    const snapshot = await q(
      `SELECT event_date_label, event_time_label, event_venue, event_location,
              ticket_design_style, ticket_design_image_path
       FROM public.storefront_bookings WHERE booking_reference = $1`,
      [result.rows[0]?.booking_reference],
    );
    ok(
      "booking snapshots event details for customer tickets",
      snapshot.rows[0]?.event_date_label === "Old sample date" &&
        snapshot.rows[0]?.event_time_label === "8:00 PM" &&
        snapshot.rows[0]?.event_venue === "Test Hall" &&
        snapshot.rows[0]?.event_location === "Dhaka" &&
        snapshot.rows[0]?.ticket_design_style === "festival" &&
        snapshot.rows[0]?.ticket_design_image_path === "booking-upcoming/ticket-design.png",
      JSON.stringify(snapshot.rows[0]),
    );
    const ongoing = await q(
      `SELECT * FROM public.create_storefront_booking(
        'booking-ongoing', 1, 'Demo Buyer', 'customer-a@tickshow.test', '01234567890'
      )`,
    );
    ok(
      "ongoing events remain bookable even when their display date has passed",
      Number(ongoing.rows[0]?.total_amount) === 800,
      JSON.stringify(ongoing.rows[0]),
    );
    await expectError(
      "checkout rejects more than eight tickets",
      `SELECT * FROM public.create_storefront_booking(
        'booking-upcoming', 9, 'Demo Buyer', 'customer-a@tickshow.test', '01234567890'
      )`,
    );
    await expectError(
      "checkout rejects an invalid email",
      `SELECT * FROM public.create_storefront_booking(
        'booking-upcoming', 1, 'Demo Buyer', 'not-an-email', '01234567890'
      )`,
    );
    await expectError(
      "checkout requires the authenticated account email",
      `SELECT * FROM public.create_storefront_booking(
        'booking-upcoming', 1, 'Demo Buyer', 'someone-else@example.test', '01234567890'
      )`,
    );
    await expectError(
      "checkout rejects a hidden event",
      `SELECT * FROM public.create_storefront_booking(
        'booking-hidden', 1, 'Demo Buyer', 'customer-a@tickshow.test', '01234567890'
      )`,
    );
    await expectError(
      "checkout rejects an event marked past",
      `SELECT * FROM public.create_storefront_booking(
        'booking-past', 1, 'Demo Buyer', 'customer-a@tickshow.test', '01234567890'
      )`,
    );
    const visible = await count("SELECT count(*) FROM public.storefront_bookings");
    ok("customers can read only their own bookings", visible === 2);

    const emailClaim = await q(
      "SELECT public.claim_storefront_ticket_email($1, false) AS claimed",
      [primaryBookingReference],
    );
    const duplicateEmailClaim = await q(
      "SELECT public.claim_storefront_ticket_email($1, false) AS claimed",
      [primaryBookingReference],
    );
    ok(
      "ticket email is claimed once and concurrent duplicate sends are blocked",
      emailClaim.rows[0]?.claimed === true && duplicateEmailClaim.rows[0]?.claimed === false,
    );
    await q(
      "SELECT public.finish_storefront_ticket_email($1, true)",
      [primaryBookingReference],
    );
    const duplicateSentEmail = await q(
      "SELECT public.claim_storefront_ticket_email($1, false) AS claimed",
      [primaryBookingReference],
    );
    const explicitResend = await q(
      "SELECT public.claim_storefront_ticket_email($1, true) AS claimed",
      [primaryBookingReference],
    );
    ok(
      "sent ticket emails are not repeated unless an explicit resend is requested",
      duplicateSentEmail.rows[0]?.claimed === false && explicitResend.rows[0]?.claimed === true,
    );
    await q(
      "SELECT public.finish_storefront_ticket_email($1, false)",
      [primaryBookingReference],
    );

    const assetClaim = await q(
      "SELECT public.claim_storefront_ticket_assets($1, false) AS claimed",
      [primaryBookingReference],
    );
    const duplicateAssetClaim = await q(
      "SELECT public.claim_storefront_ticket_assets($1, false) AS claimed",
      [primaryBookingReference],
    );
    ok(
      "ticket PDF generation uses an atomic booking claim",
      assetClaim.rows[0]?.claimed === true && duplicateAssetClaim.rows[0]?.claimed === false,
    );
    await q(
      "SELECT public.finish_storefront_ticket_assets($1, true)",
      [primaryBookingReference],
    );
  });

  await asService(async () => {
    const booking = await q(
      "SELECT id FROM public.storefront_bookings WHERE booking_reference = $1",
      [primaryBookingReference],
    );
    await q(
      `INSERT INTO public.storefront_tickets (booking_id, ticket_number, token_hash)
       VALUES
         ($1, 1, encode(extensions.digest(convert_to($2, 'UTF8'), 'sha256'), 'hex')),
         ($1, 2, encode(extensions.digest(convert_to($3, 'UTF8'), 'sha256'), 'hex'))`,
      [booking.rows[0].id, firstTicketToken, secondTicketToken],
    );
    const tickets = await q(
      `SELECT id, ticket_number FROM public.storefront_tickets
       WHERE booking_id = $1 ORDER BY ticket_number`,
      [booking.rows[0].id],
    );
    firstTicketId = tickets.rows[0]?.id;
    ok(
      "a multi-ticket booking receives one private record per ticket",
      tickets.rows.length === 2 &&
        tickets.rows[0]?.ticket_number !== tickets.rows[1]?.ticket_number,
      JSON.stringify(tickets.rows),
    );
    const rawTokenColumn = await count(
      `SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('storefront_bookings', 'storefront_tickets')
         AND column_name = 'ticket_token'`,
    );
    ok("raw ticket tokens are not stored in readable columns", rawTokenColumn === 0);
  });

  await asAnon(async () => {
    await expectError(
      "anonymous users cannot read private storefront ticket records",
      "SELECT * FROM public.storefront_tickets",
    );
    const valid = await q(
      "SELECT * FROM public.verify_storefront_ticket_by_id($1, $2)",
      [firstTicketId, firstTicketToken],
    );
    const invalid = await q(
      "SELECT * FROM public.verify_storefront_ticket_by_id($1, $2)",
      [firstTicketId, "c".repeat(64)],
    );
    ok(
      "verification checks token hashes and returns an explicit invalid result",
      valid.rows[0]?.valid === true &&
        valid.rows[0]?.ticket_number === 1 &&
        invalid.rows[0]?.valid === false,
    );
    ok(
      "ticket verification response never includes stored token hashes",
      !Object.hasOwn(valid.rows[0] ?? {}, "token_hash"),
    );
  });

  await asAuth(USER.customerB, "customer-b@tickshow.test", async () => {
    const visible = await count("SELECT count(*) FROM public.storefront_bookings");
    ok("customers cannot read other buyers' booking details", visible === 0);
    await expectError(
      "customers cannot query private ticket token hashes",
      "SELECT * FROM public.storefront_tickets",
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const firstDownload = await q(
      "SELECT * FROM public.claim_storefront_ticket_download($1)",
      [primaryBookingReference],
    );
    const secondDownload = await q(
      "SELECT * FROM public.claim_storefront_ticket_download($1)",
      [primaryBookingReference],
    );
    ok(
      "ticket PDF download can be claimed only once",
      firstDownload.rows[0]?.claimed === true &&
        secondDownload.rows[0]?.claimed === false &&
        !Object.hasOwn(firstDownload.rows[0] ?? {}, "ticket_token"),
    );
  });

  await asService(async () => {
    await q(
      "UPDATE public.storefront_tickets SET checked_in_at = now() WHERE id = $1",
      [firstTicketId],
    );
  });
  await asAnon(async () => {
    const used = await q(
      "SELECT * FROM public.verify_storefront_ticket_by_id($1, $2)",
      [firstTicketId, firstTicketToken],
    );
    ok(
      "checked-in tickets cannot be accepted again",
      used.rows[0]?.valid === false && used.rows[0]?.already_checked_in === true,
    );
  });

  await asAuth(USER.admin, "admin@tickshow.test", async () => {
    const booking = await q(
      `SELECT booking_reference, buyer_email, total_amount
       FROM public.storefront_bookings`,
    );
    ok(
      "admins can review persisted storefront bookings",
      booking.rows.length === 2 &&
        booking.rows.some((row) =>
          row.buyer_email === "customer-a@tickshow.test" && Number(row.total_amount) === 2400,
        ),
      JSON.stringify(booking.rows),
    );
  });
}

async function testAccountDeletion() {
  console.log("\n[7] Customer account deletion");

  await asAnon(async () => {
    await expectError(
      "anonymous users cannot delete accounts",
      "SELECT public.delete_own_account()",
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    await q("SELECT public.delete_own_account()");
  });

  await asService(async () => {
    const authUser = await count("SELECT count(*) FROM auth.users WHERE id = $1", [USER.customerA]);
    const profile = await count("SELECT count(*) FROM public.profiles WHERE id = $1", [USER.customerA]);
    const bookings = await count(
      "SELECT count(*) FROM public.storefront_bookings WHERE customer_id = $1",
      [USER.customerA],
    );
    const retainedOrder = await q(
      "SELECT customer_id, buyer_name, buyer_email, buyer_phone FROM public.orders WHERE id = $1",
      [ORDER.a],
    );
    const orderWasAnonymized =
      retainedOrder.rows[0]?.customer_id === null &&
      retainedOrder.rows[0]?.buyer_name === "Deleted account" &&
      retainedOrder.rows[0]?.buyer_email === `deleted+${ORDER.a}@example.invalid` &&
      retainedOrder.rows[0]?.buyer_phone === null;
    ok(
      "deleting an account removes its auth user, profile, and bookings, and anonymizes order contact details",
      authUser === 0 && profile === 0 && bookings === 0 && orderWasAnonymized,
      JSON.stringify({ authUser, profile, bookings, orderWasAnonymized }),
    );
  });
}

async function run() {
  console.log("TickShow database validation (PGlite in-memory PostgreSQL)");
  await applyShims();
  await applyMigrations();
  await seedTestContext();
  await testSchema();
  await testRls();
  await testAdminInvitations();
  await testAdminManagement();
  await testStorefrontShowcase();
  await testStorefrontBookings();
  await testAccountDeletion();

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await run();
} catch (error) {
  console.error("\nFATAL:", error);
  process.exitCode = 1;
} finally {
  await db.close();
}
