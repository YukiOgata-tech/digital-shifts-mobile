-- Staff clients must not be able to enable paid email notifications by bypassing
-- the WEB Server Action. Resolve the same subscription/override entitlement in DB.
create or replace function public.update_mobile_notification_preferences(
  p_tenant_id uuid,
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_shift_published_enabled boolean,
  p_shift_changed_enabled boolean,
  p_help_requested_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_can_use_email boolean := false;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = v_user_id
      and tm.status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Active tenant membership required';
  end if;

  select
    ts.status in ('active', 'trialing')
    and coalesce(
      (
        select case jsonb_typeof(tfo.value)
          when 'boolean' then (tfo.value #>> '{}')::boolean
          when 'object' then coalesce((tfo.value ->> 'enabled')::boolean, false)
          else false
        end
        from public.tenant_feature_overrides tfo
        where tfo.tenant_id = p_tenant_id
          and tfo.feature_key = 'email_notifications'
          and (tfo.expires_at is null or tfo.expires_at > now())
        limit 1
      ),
      coalesce((bp.features ->> 'email_notifications')::boolean, false)
    )
  into v_can_use_email
  from public.tenant_subscriptions ts
  join public.billing_plans bp on bp.id = ts.billing_plan_id
  where ts.tenant_id = p_tenant_id;

  if p_email_enabled and not coalesce(v_can_use_email, false) then
    raise exception using
      errcode = '42501',
      message = 'Email notifications are not enabled for this tenant';
  end if;

  insert into public.notification_preferences (
    tenant_id,
    user_id,
    in_app_enabled,
    email_enabled,
    shift_published_enabled,
    shift_changed_enabled,
    help_requested_enabled
  )
  values (
    p_tenant_id,
    v_user_id,
    p_in_app_enabled,
    case when v_can_use_email then p_email_enabled else false end,
    p_shift_published_enabled,
    p_shift_changed_enabled,
    p_help_requested_enabled
  )
  on conflict (tenant_id, user_id)
  do update set
    in_app_enabled = excluded.in_app_enabled,
    email_enabled = excluded.email_enabled,
    shift_published_enabled = excluded.shift_published_enabled,
    shift_changed_enabled = excluded.shift_changed_enabled,
    help_requested_enabled = excluded.help_requested_enabled,
    updated_at = now();
end;
$$;

revoke all on function public.update_mobile_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public, anon;

grant execute on function public.update_mobile_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

comment on function public.update_mobile_notification_preferences(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) is 'Updates the current staff notification preferences and enforces email entitlement.';
