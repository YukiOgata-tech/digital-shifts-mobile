-- Dミセ ネイティブスタッフアプリ用ランタイム
-- 勤怠イベントを1トランザクションで記録し、Pushトークンを本人だけが管理できるようにする。

create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id),
  unique (expo_push_token)
);

alter table public.mobile_push_tokens enable row level security;

create policy "mobile_push_tokens_self_select"
on public.mobile_push_tokens
for select
using (user_id = (select auth.uid()) and public.is_tenant_member(tenant_id));

create policy "mobile_push_tokens_self_insert"
on public.mobile_push_tokens
for insert
with check (user_id = (select auth.uid()) and public.is_tenant_member(tenant_id));

create policy "mobile_push_tokens_self_update"
on public.mobile_push_tokens
for update
using (user_id = (select auth.uid()) and public.is_tenant_member(tenant_id))
with check (user_id = (select auth.uid()) and public.is_tenant_member(tenant_id));

create policy "mobile_push_tokens_self_delete"
on public.mobile_push_tokens
for delete
using (user_id = (select auth.uid()) and public.is_tenant_member(tenant_id));

create index if not exists mobile_push_tokens_delivery_idx
on public.mobile_push_tokens (tenant_id, user_id)
where enabled;

create trigger mobile_push_tokens_set_updated_at
before update on public.mobile_push_tokens
for each row execute function public.set_updated_at();

create or replace function public.record_mobile_attendance_event(
  p_store_id uuid,
  p_event_type public.attendance_event_type,
  p_gps_status text default 'unavailable',
  p_gps_lat numeric default null,
  p_gps_lng numeric default null,
  p_gps_accuracy_meters numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_store_timezone text;
  v_store_lat numeric;
  v_store_lng numeric;
  v_radius numeric;
  v_now timestamptz := clock_timestamp();
  v_cutoff timestamptz := clock_timestamp() - interval '24 hours';
  v_record public.attendance_records%rowtype;
  v_latest_break public.attendance_events%rowtype;
  v_distance numeric;
  v_evidence public.attendance_evidence_status := 'not_checked';
  v_evidence_reason text;
  v_needs_review boolean := false;
  v_break_minutes integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_store_id::text, 0)
  );

  if p_event_type not in ('clock_in', 'clock_out', 'break_start', 'break_end') then
    raise exception 'unsupported attendance event';
  end if;

  select s.tenant_id, coalesce(s.timezone, 'Asia/Tokyo'), s.attendance_lat,
         s.attendance_lng, coalesce(s.attendance_gps_radius_meters, 150)
    into v_tenant_id, v_store_timezone, v_store_lat, v_store_lng, v_radius
  from public.stores s
  where s.id = p_store_id
    and s.is_active
    and (
      public.is_store_member(s.id)
      or public.is_store_manager_or_owner(s.id)
    );

  if v_tenant_id is null then
    raise exception 'active store membership required' using errcode = '42501';
  end if;

  if p_event_type in ('clock_in', 'clock_out') then
    if p_gps_status = 'ok'
       and p_gps_lat is not null and p_gps_lng is not null
       and v_store_lat is not null and v_store_lng is not null then
      v_distance := 6371000 * 2 * asin(
        sqrt(
          power(sin(radians((p_gps_lat - v_store_lat) / 2)), 2)
          + cos(radians(v_store_lat)) * cos(radians(p_gps_lat))
          * power(sin(radians((p_gps_lng - v_store_lng) / 2)), 2)
        )
      );
      if v_distance <= v_radius then
        v_evidence := 'gps_ok';
      else
        v_evidence := 'gps_out_of_range';
        v_evidence_reason := '店舗の打刻範囲外です';
      end if;
    elsif v_store_lat is null or v_store_lng is null then
      v_evidence := 'gps_unavailable';
      v_evidence_reason := '店舗位置が未設定です';
    elsif p_gps_status = 'denied' then
      v_evidence := 'gps_denied';
      v_evidence_reason := '位置情報の利用が許可されていません';
    elsif p_gps_status = 'not_supported' then
      v_evidence := 'gps_not_supported';
      v_evidence_reason := 'この端末では位置情報を利用できません';
    else
      v_evidence := 'gps_unavailable';
      v_evidence_reason := '位置情報を取得できませんでした';
    end if;
    v_needs_review := v_evidence <> 'gps_ok';
  end if;

  if p_event_type = 'clock_in' then
    update public.attendance_records
    set review_status = 'needs_review',
        review_required_reason = concat_ws(' / ', review_required_reason, '退勤打刻忘れの可能性（自動検出）')
    where tenant_id = v_tenant_id
      and store_id = p_store_id
      and user_id = v_user_id
      and status = 'open'
      and clock_in_at < v_cutoff
      and review_status <> 'needs_review';

    if exists (
      select 1 from public.attendance_records
      where tenant_id = v_tenant_id
        and store_id = p_store_id
        and user_id = v_user_id
        and status = 'open'
        and clock_in_at >= v_cutoff
    ) then
      raise exception 'already clocked in';
    end if;

    if v_needs_review and nullif(trim(p_reason), '') is null then
      raise exception 'reason required when GPS evidence is unavailable';
    end if;

    insert into public.attendance_records (
      tenant_id, store_id, user_id, work_date, clock_in_at, status,
      review_status, review_required_reason
    ) values (
      v_tenant_id, p_store_id, v_user_id,
      (v_now at time zone v_store_timezone)::date, v_now, 'open',
      case when v_needs_review then 'needs_review'::public.attendance_review_status
           else 'normal'::public.attendance_review_status end,
      case when v_needs_review then concat_ws(' / ', v_evidence_reason, nullif(trim(p_reason), ''))
           else null end
    )
    returning * into v_record;

  else
    select *
      into v_record
    from public.attendance_records
    where tenant_id = v_tenant_id
      and store_id = p_store_id
      and user_id = v_user_id
      and status = 'open'
      and clock_in_at >= v_cutoff
    order by clock_in_at desc
    limit 1
    for update;

    if v_record.id is null then
      raise exception 'active attendance record not found';
    end if;

    if p_event_type = 'clock_out' then
      if v_needs_review
         and v_record.review_status <> 'needs_review'
         and nullif(trim(p_reason), '') is null then
        raise exception 'reason required when GPS evidence is unavailable';
      end if;

      select *
        into v_latest_break
      from public.attendance_events
      where attendance_record_id = v_record.id
        and event_type in ('break_start', 'break_end')
      order by event_at desc
      limit 1;

      v_break_minutes := coalesce(v_record.break_minutes, 0);
      if v_latest_break.event_type = 'break_start' then
        v_break_minutes := v_break_minutes
          + greatest(0, round(extract(epoch from (v_now - v_latest_break.event_at)) / 60)::integer);
        insert into public.attendance_events (
          tenant_id, store_id, attendance_record_id, user_id, event_type, event_at,
          method, entry_source, evidence_status, reason, user_agent
        ) values (
          v_tenant_id, p_store_id, v_record.id, v_user_id, 'break_end', v_now,
          'manual', 'manual_nav', 'not_checked', '退勤時に休憩終了を補完', 'digital-shifts-mobile'
        );
      end if;

      update public.attendance_records
      set clock_out_at = v_now,
          break_minutes = v_break_minutes,
          status = 'completed',
          review_status = case
            when v_needs_review or v_record.review_status = 'needs_review'
              then 'needs_review'::public.attendance_review_status
            else 'normal'::public.attendance_review_status
          end,
          review_required_reason = nullif(
            concat_ws(' / ', v_record.review_required_reason,
              case when v_needs_review then v_evidence_reason end,
              case when v_needs_review then nullif(trim(p_reason), '') end),
            ''
          )
      where id = v_record.id
      returning * into v_record;

    elsif p_event_type = 'break_start' then
      select *
        into v_latest_break
      from public.attendance_events
      where attendance_record_id = v_record.id
        and event_type in ('break_start', 'break_end')
      order by event_at desc
      limit 1;
      if v_latest_break.event_type = 'break_start' then
        raise exception 'break already started';
      end if;
      v_evidence := 'not_checked';

    elsif p_event_type = 'break_end' then
      select *
        into v_latest_break
      from public.attendance_events
      where attendance_record_id = v_record.id
        and event_type in ('break_start', 'break_end')
      order by event_at desc
      limit 1
      for update;
      if v_latest_break.event_type is distinct from 'break_start' then
        raise exception 'active break not found';
      end if;
      update public.attendance_records
      set break_minutes = coalesce(break_minutes, 0)
        + greatest(0, round(extract(epoch from (v_now - v_latest_break.event_at)) / 60)::integer)
      where id = v_record.id
      returning * into v_record;
      v_evidence := 'not_checked';
    end if;
  end if;

  insert into public.attendance_events (
    tenant_id, store_id, attendance_record_id, user_id, event_type, event_at,
    method, entry_source, gps_lat, gps_lng, gps_accuracy_meters,
    distance_from_store_meters, evidence_status, reason, user_agent
  ) values (
    v_tenant_id, p_store_id, v_record.id, v_user_id, p_event_type, v_now,
    case when p_event_type in ('clock_in', 'clock_out') then 'web_gps'::public.attendance_method
         else 'manual'::public.attendance_method end,
    'manual_nav', p_gps_lat, p_gps_lng, p_gps_accuracy_meters,
    v_distance, v_evidence, nullif(trim(p_reason), ''), 'digital-shifts-mobile'
  );

  return jsonb_build_object(
    'record_id', v_record.id,
    'event_type', p_event_type,
    'event_at', v_now,
    'record_status', v_record.status,
    'review_status', v_record.review_status,
    'evidence_status', v_evidence,
    'distance_from_store_meters', v_distance
  );
end;
$$;

revoke all on function public.record_mobile_attendance_event(
  uuid, public.attendance_event_type, text, numeric, numeric, numeric, text
) from public;

grant execute on function public.record_mobile_attendance_event(
  uuid, public.attendance_event_type, text, numeric, numeric, numeric, text
) to authenticated;

create or replace function public.submit_mobile_manual_attendance(
  p_store_id uuid,
  p_work_date date,
  p_clock_in time,
  p_clock_out time,
  p_break_minutes integer,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_timezone text;
  v_clock_in_at timestamptz;
  v_clock_out_at timestamptz;
  v_record_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 200 then
    raise exception 'reason must be between 5 and 200 characters';
  end if;
  if p_break_minutes < 0 or p_break_minutes > 480 then
    raise exception 'break minutes must be between 0 and 480';
  end if;

  select s.tenant_id, coalesce(s.timezone, 'Asia/Tokyo')
    into v_tenant_id, v_timezone
  from public.stores s
  join public.store_memberships sm
    on sm.store_id = s.id
   and sm.tenant_id = s.tenant_id
   and sm.user_id = v_user_id
   and sm.status = 'active'
  where s.id = p_store_id
    and s.is_active;

  if v_tenant_id is null then
    raise exception 'active store membership required' using errcode = '42501';
  end if;
  if p_work_date > (clock_timestamp() at time zone v_timezone)::date then
    raise exception 'future attendance is not allowed';
  end if;

  v_clock_in_at := (p_work_date + p_clock_in) at time zone v_timezone;
  v_clock_out_at := (p_work_date + p_clock_out) at time zone v_timezone;
  if v_clock_out_at <= v_clock_in_at then
    v_clock_out_at := v_clock_out_at + interval '1 day';
  end if;
  if extract(epoch from (v_clock_out_at - v_clock_in_at)) / 60 <= p_break_minutes then
    raise exception 'break minutes exceed attendance duration';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_store_id::text, 0)
  );

  if exists (
    select 1
    from public.attendance_records ar
    where ar.tenant_id = v_tenant_id
      and ar.store_id = p_store_id
      and ar.user_id = v_user_id
      and ar.status <> 'voided'
      and (
        (ar.clock_out_at is not null
          and ar.clock_in_at < v_clock_out_at
          and ar.clock_out_at > v_clock_in_at)
        or
        (ar.status = 'open'
          and ar.clock_in_at < v_clock_out_at
          and ar.clock_in_at + interval '24 hours' > v_clock_in_at)
      )
  ) then
    raise exception 'attendance time overlaps an existing record';
  end if;

  insert into public.attendance_records (
    tenant_id, store_id, user_id, work_date, clock_in_at, clock_out_at,
    break_minutes, status, review_status, review_required_reason,
    manually_edited_at, manually_edited_by
  ) values (
    v_tenant_id, p_store_id, v_user_id, p_work_date, v_clock_in_at, v_clock_out_at,
    p_break_minutes, 'completed', 'needs_review', '後から入力: ' || trim(p_reason),
    clock_timestamp(), v_user_id
  )
  returning id into v_record_id;

  insert into public.attendance_events (
    tenant_id, store_id, attendance_record_id, user_id, event_type, event_at,
    method, entry_source, evidence_status, reason, user_agent
  ) values
  (
    v_tenant_id, p_store_id, v_record_id, v_user_id, 'manual_entry', v_clock_in_at,
    'manual', 'manual_nav', 'manual_reason_required',
    '後から入力（出勤）: ' || trim(p_reason), 'digital-shifts-mobile'
  ),
  (
    v_tenant_id, p_store_id, v_record_id, v_user_id, 'manual_entry', v_clock_out_at,
    'manual', 'manual_nav', 'manual_reason_required',
    '後から入力（退勤）: ' || trim(p_reason), 'digital-shifts-mobile'
  );

  insert into public.attendance_review_logs (
    tenant_id, store_id, attendance_record_id, actor_user_id, action,
    before_data, after_data, comment
  ) values (
    v_tenant_id, p_store_id, v_record_id, v_user_id, 'adjusted',
    null,
    jsonb_build_object(
      'clock_in_at', v_clock_in_at,
      'clock_out_at', v_clock_out_at,
      'break_minutes', p_break_minutes,
      'source', 'mobile_manual_entry'
    ),
    '[本人による後から入力] ' || trim(p_reason)
  );

  return v_record_id;
end;
$$;

revoke all on function public.submit_mobile_manual_attendance(
  uuid, date, time, time, integer, text
) from public;

grant execute on function public.submit_mobile_manual_attendance(
  uuid, date, time, time, integer, text
) to authenticated;
