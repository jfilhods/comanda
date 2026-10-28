<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Tenant isolation lives in database RLS via `is_global_admin` / `has_restaurant_role` helpers; every restaurant-scoped table carries `restaurant_id`. Why: the UI can't be trusted to filter tenants.
- Orders, sessions and status changes are written only through security-definer RPCs (`create_order`, `set_order_status`, `request_bill`, `close_session`); clients have SELECT-only grants on those tables. Why: prices and status transitions must be validated server-side.
- `src/lib/status.ts` `nextStep` mirrors the SQL transition rule for UI buttons; change both together.
- Staff accounts are created by the `createStaff` server function (admin API after a manager role check). Why: managers must not need passwords leaked or self-signup.
- Global admin role is granted by the signup trigger for the configured admin email and stored in `user_roles`, never from client data.
