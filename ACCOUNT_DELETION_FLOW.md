# Account deletion and password recovery

## Account deletion

### Entry point

Signed-in users can open `/#/account/delete` from the account dashboard. The page is also reachable directly; unauthenticated visitors are shown a sign-in link that preserves the destination.

### Confirmation controls

1. Re-authentication with the current password.
2. Typing `DELETE MY ACCOUNT` exactly.
3. Explicit submission of the permanent-delete action.

The browser does not decide what data is removed. It calls `delete_own_account()`, a `SECURITY DEFINER` RPC that requires `auth.uid()`.

### Database effect

- The `auth.users` row is deleted.
- The `profiles` row and profile-cascaded personal data are removed.
- Personal contact details on historical orders are anonymized before deletion:
  - `customer_id` becomes `NULL`.
  - `buyer_name` becomes `Deleted account`.
  - `buyer_email` becomes `deleted+<order-id>@example.invalid`.
  - `buyer_phone` becomes `NULL`.
- `orders`, `order_items`, `payments`, `tickets` and webhook records are **retained** for financial and audit integrity.
- Legacy demo booking records associated with the account are removed with the profile cascade; no broad unfiltered `DELETE` is used.

The order-immutability trigger has one narrow exception for this exact anonymization pattern and only when `app.account_deletion` matches the authenticated user.

### Result page

After success the browser is redirected to:

```text
/#/account/deletion-status?state=complete
```

The status page explains that sign-in was removed and financial records were anonymized. The `deleted` auth callback flow also redirects here. A non-complete state renders the retry/support variant.

No deletion confirmation email is sent. The account is removed immediately after the RPC succeeds.

## Password recovery

1. `/#/forgot-password` submits the account email through Supabase Auth.
2. Supabase sends a recovery email using the configured redirect URL.
3. `/auth/callback` receives the recovery session and redirects to `/#/reset-password`.
4. `/#/reset-password` checks for an active session, then allows one new password (minimum 8 characters).
5. `updatePasswordForRecovery()` calls `auth.updateUser({ password })`.
6. Without a valid session the page offers a link to request a fresh recovery email.

The reset link is a security token: error pages and SEO metadata mark recovery routes `noindex,nofollow,noarchive`.

## Operational notes

- Verify the Supabase Auth redirect allow-list includes `SITE_URL` and `SITE_URL/auth/callback`.
- Verify RLS and RPC grants after deploying migration `0035`; clients must not be able to update order contact or amount fields directly.
- The database test suite covers anonymous deletion denial and the anonymization result: `npm run db:test`.
