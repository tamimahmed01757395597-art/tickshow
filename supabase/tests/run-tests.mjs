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
  orgA: id(2),
  orgB: id(3),
  staff: id(4),
  customerA: id(5),
  customerB: id(6),
};
const ORG = { A: id(101), B: id(102) };
const EVENT = { publicA: id(201), draftA: id(202), publicB: id(203), draftB: id(204) };
const TICKET_TYPE = id(301);
const ORDER = { a: id(401), b: id(402) };
const ORDER_ITEM = { a: id(411), b: id(412) };
const PAYMENT = id(501);
const TICKET = { a: id(601), b: id(602) };
const PAYOUT = id(701);
const COMMISSION = id(702);
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
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
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
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.exec(sql);
    console.log(`  APPLIED ${file}`);
  }
}

async function seedTestContext() {
  await asService(async () => {
    const users = [
      [USER.admin, "admin@tickshow.test"],
      [USER.orgA, "organizer-a@tickshow.test"],
      [USER.orgB, "organizer-b@tickshow.test"],
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
      [USER.orgA, "organizer"],
      [USER.orgB, "organizer"],
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

    for (const [orgId, owner, slug, name] of [
      [ORG.A, USER.orgA, "org-alpha", "Organizer Alpha"],
      [ORG.B, USER.orgB, "org-beta", "Organizer Beta"],
    ]) {
      await q(
        `INSERT INTO public.organizers (id, owner_id, slug, name, status, approval_status, approved_at)
         VALUES ($1, $2, $3, $4, 'active', 'approved', now())`,
        [orgId, owner, slug, name],
      );
    }

    await q(
      `INSERT INTO public.organizer_staff (organizer_id, user_id, role, status)
       VALUES ($1, $2, 'checkin', 'active')`,
      [ORG.A, USER.staff],
    );

    const categoryResult = await q(
      "SELECT id FROM public.event_categories WHERE slug = 'concerts-music'",
    );
    const categoryId = categoryResult.rows[0].id;

    await q(
      `INSERT INTO public.events (id, organizer_id, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status, approved_at, published_at)
       VALUES ($1, $2, $3, $4, 'Public Alpha', 'public-alpha', now() + interval '1 day', now() + interval '2 days', 'published', 'approved', now(), now())`,
      [EVENT.publicA, ORG.A, categoryId, USER.orgA],
    );
    await q(
      `INSERT INTO public.events (id, organizer_id, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status)
       VALUES ($1, $2, $3, $4, 'Draft Alpha', 'draft-alpha', now() + interval '3 day', now() + interval '4 days', 'draft', 'pending')`,
      [EVENT.draftA, ORG.A, categoryId, USER.orgA],
    );
    await q(
      `INSERT INTO public.events (id, organizer_id, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status, approved_at, published_at)
       VALUES ($1, $2, $3, $4, 'Public Beta', 'public-beta', now() + interval '5 day', now() + interval '6 days', 'published', 'approved', now(), now())`,
      [EVENT.publicB, ORG.B, categoryId, USER.orgB],
    );
    await q(
      `INSERT INTO public.events (id, organizer_id, category_id, created_by, title, slug, starts_at, ends_at, status, approval_status)
       VALUES ($1, $2, $3, $4, 'Draft Beta', 'draft-beta', now() + interval '7 day', now() + interval '8 days', 'draft', 'pending')`,
      [EVENT.draftB, ORG.B, categoryId, USER.orgB],
    );

    await q(
      `INSERT INTO public.event_staff (event_id, user_id, permission, status, assigned_by)
       VALUES ($1, $2, 'checkin', 'active', $3)`,
      [EVENT.publicA, USER.staff, USER.orgA],
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

    await q(
      `INSERT INTO public.organizer_payouts (id, organizer_id, amount, currency)
       VALUES ($1, $2, 1000, 'BDT')`,
      [PAYOUT, ORG.A],
    );
    await q(
      `INSERT INTO public.organizer_commissions (id, organizer_id, event_id, order_id, payout_id, commission_rate, gross_amount, commission_amount, net_amount, currency)
       VALUES ($1, $2, $3, $4, $5, 0.1000, 2400, 240, 2160, 'BDT')`,
      [COMMISSION, ORG.A, EVENT.publicA, ORDER.a, PAYOUT],
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
  const tableCount = await count(
    `SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  ok("all Phase 1/2 tables created", tableCount === 27, `found ${tableCount}`);

  const rlsCount = await count(
    `SELECT count(*) FROM pg_tables
     WHERE schemaname = 'public' AND rowsecurity = true`,
  );
  ok("RLS enabled on all application tables", rlsCount === 27, `found ${rlsCount}`);

  await expectError(
    "negative ticket price rejected",
    `INSERT INTO public.ticket_types (event_id, name, price_amount, quantity_total, sales_start_at, sales_end_at)
     VALUES ($1, 'Negative', -1, 5, now(), now() + interval '1 day')`,
    [EVENT.publicA],
  );
  await expectError(
    "event end before start rejected",
    `INSERT INTO public.events (organizer_id, category_id, title, slug, starts_at, ends_at)
     SELECT $1, id, 'Bad window', 'bad-window', now(), now() - interval '1 day'
     FROM public.event_categories WHERE slug = 'sports'`,
    [ORG.A],
  );
  await expectError(
    "duplicate event slug rejected",
    `INSERT INTO public.events (organizer_id, category_id, title, slug, starts_at, ends_at)
     SELECT $1, id, 'Duplicate slug', 'public-alpha', now(), now() + interval '1 day'
     FROM public.event_categories WHERE slug = 'sports'`,
    [ORG.A],
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

  await asAuth(USER.orgA, "organizer-a@tickshow.test", async () => {
    const visible = await ids("SELECT id FROM public.events");
    ok(
      "organizer A sees own private events but not organizer B drafts",
      visible.includes(EVENT.publicA) &&
        visible.includes(EVENT.draftA) &&
        !visible.includes(EVENT.draftB),
      JSON.stringify(visible),
    );
    const orders = await ids("SELECT id FROM public.orders");
    ok("organizer A sees only own-event orders", orders.length === 1 && orders[0] === ORDER.a, JSON.stringify(orders));
    const commissions = await count("SELECT count(*) FROM public.organizer_commissions");
    ok("organizer A sees own commissions", commissions === 1);
    await expectError(
      "organizer cannot self-approve event",
      "UPDATE public.events SET approval_status = 'approved' WHERE id = $1",
      [EVENT.draftA],
    );
    await expectError(
      "organizer cannot publish unapproved event",
      "UPDATE public.events SET status = 'published' WHERE id = $1",
      [EVENT.draftA],
    );
  });

  await asAuth(USER.orgB, "organizer-b@tickshow.test", async () => {
    const events = await ids("SELECT id FROM public.events");
    ok(
      "organizer B cannot see organizer A private events",
      events.includes(EVENT.draftB) && !events.includes(EVENT.draftA),
      JSON.stringify(events),
    );
    const commissions = await count("SELECT count(*) FROM public.organizer_commissions");
    ok("organizer B cannot see organizer A commissions", commissions === 0);
    await expectError(
      "organizer B cannot write organizer A event image",
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
      "customer cannot create an organizer without the organizer role",
      `INSERT INTO public.organizers (owner_id, slug, name) VALUES ($1, 'customer-org', 'Customer Org')`,
      [USER.customerA],
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
      "customer cannot self-assign organizer via secure function",
      "SELECT public.assign_user_role($1, 'organizer')",
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
    await expectError(
      "admin cannot self-assign organizer role",
      "SELECT public.assign_user_role($1, 'organizer')",
      [USER.admin],
    );
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
    await q("UPDATE public.organizer_payouts SET status = 'paid' WHERE id = $1", [PAYOUT]);
  });
  await asService(async () => {
    const order = await q("SELECT status FROM public.orders WHERE id = $1", [ORDER.a]);
    const payout = await q("SELECT status FROM public.organizer_payouts WHERE id = $1", [PAYOUT]);
    ok("customer cannot change an order status", order.rows[0]?.status === "paid", order.rows[0]?.status);
    ok("customer cannot change a payout status", payout.rows[0]?.status === "pending", payout.rows[0]?.status);
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

    await expectError(
      "admin cannot alter payout amounts",
      "UPDATE public.organizer_payouts SET amount = 1 WHERE id = $1",
      [PAYOUT],
    );
    await q("UPDATE public.organizer_payouts SET status = 'paid', paid_at = now() WHERE id = $1", [PAYOUT]);
    const payoutStatus = await q("SELECT status FROM public.organizer_payouts WHERE id = $1", [PAYOUT]);
    ok("admin can update payout status", payoutStatus.rows[0]?.status === "paid");

    const auditCount = await count(
      "SELECT count(*) FROM public.audit_logs WHERE actor_id = $1",
      [USER.admin],
    );
    ok("admin mutations write audit entries", auditCount >= 2, `found ${auditCount}`);

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

  await asAnon(async () => {
    const visible = await count("SELECT count(*) FROM public.storefront_events WHERE is_visible");
    ok("anon sees the seeded storefront showcase", visible === 14, `found ${visible}`);
    await expectError(
      "anon cannot edit showcase events",
      "UPDATE public.storefront_events SET title = 'Hacked' WHERE slug = 'rooftop-frequencies'",
    );
  });

  await asAuth(USER.customerA, "customer-a@tickshow.test", async () => {
    const before = await q(
      "SELECT price_amount FROM public.storefront_events WHERE slug = 'rooftop-frequencies'",
    );
    await q(
      "UPDATE public.storefront_events SET price_amount = 1 WHERE slug = 'rooftop-frequencies'",
    );
    const after = await q(
      "SELECT price_amount FROM public.storefront_events WHERE slug = 'rooftop-frequencies'",
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
       WHERE slug = 'rooftop-frequencies'`,
    );
    const moved = await q(
      `SELECT event_group, is_carousel, carousel_order
       FROM public.storefront_events WHERE slug = 'rooftop-frequencies'`,
    );
    ok(
      "admin can move an event to ongoing and the carousel",
      moved.rows[0]?.event_group === "ongoing" &&
        moved.rows[0]?.is_carousel === true &&
        moved.rows[0]?.carousel_order === 1,
      JSON.stringify(moved.rows[0]),
    );
    await q(
      "UPDATE public.storefront_events SET is_visible = false WHERE slug = 'sunday-plates'",
    );
  });

  await asAnon(async () => {
    const hidden = await count(
      "SELECT count(*) FROM public.storefront_events WHERE slug = 'sunday-plates'",
    );
    ok("hidden showcase event is not public", hidden === 0, `found ${hidden}`);
  });
}

async function run() {
  console.log("TickShow Phase 1/2 database validation (PGlite in-memory PostgreSQL)");
  await applyShims();
  await applyMigrations();
  await seedTestContext();
  await testSchema();
  await testRls();
  await testAdminInvitations();
  await testAdminManagement();
  await testStorefrontShowcase();

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
