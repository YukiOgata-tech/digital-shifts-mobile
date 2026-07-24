create or replace function public.save_mobile_shift_request_draft(
  p_shift_period_id uuid,
  p_rows jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_period public.shift_periods%rowtype;
  v_timezone text;
  v_request_id uuid;
  v_row jsonb;
  v_work_date date;
  v_entry_type public.shift_request_entry_type;
  v_is_all_day boolean;
  v_start_time time;
  v_end_time time;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_time_slot_id uuid;
  v_note text;
begin
  if v_user_id is null then
    raise exception '認証が必要です。';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception '希望シフトの入力形式が正しくありません。';
  end if;

  if jsonb_array_length(p_rows) > 62 then
    raise exception '一度に保存できる希望は62日分までです。';
  end if;

  if (
    select count(*) <> count(distinct elem->>'work_date')
    from jsonb_array_elements(p_rows) as elem
  ) then
    raise exception '同じ日付の希望が重複しています。';
  end if;

  select sp.*
    into v_period
  from public.shift_periods sp
  where sp.id = p_shift_period_id
  for update;

  if not found then
    raise exception '希望シフト期間が見つかりません。';
  end if;

  select s.timezone
    into v_timezone
  from public.stores s
  where s.id = v_period.store_id;

  if v_period.status <> 'open'::public.shift_period_status
     or v_period.request_deadline_at <= clock_timestamp() then
    raise exception 'この希望シフトの受付は終了しています。';
  end if;

  if not exists (
    select 1
    from public.store_memberships sm
    where sm.tenant_id = v_period.tenant_id
      and sm.store_id = v_period.store_id
      and sm.user_id = v_user_id
      and sm.status = 'active'
  ) then
    raise exception 'この店舗の有効なスタッフではありません。';
  end if;

  insert into public.shift_requests (
    tenant_id,
    store_id,
    shift_period_id,
    user_id
  )
  values (
    v_period.tenant_id,
    v_period.store_id,
    v_period.id,
    v_user_id
  )
  on conflict (shift_period_id, user_id) do nothing;

  select sr.id
    into v_request_id
  from public.shift_requests sr
  where sr.shift_period_id = v_period.id
    and sr.user_id = v_user_id
    and sr.tenant_id = v_period.tenant_id
    and sr.store_id = v_period.store_id
  for update;

  if v_request_id is null then
    raise exception '希望シフトを作成できませんでした。';
  end if;

  if exists (
    select 1
    from public.shift_requests sr
    where sr.id = v_request_id
      and sr.submitted_at is not null
  ) then
    raise exception '提出済みの希望は、下書きに戻してから編集してください。';
  end if;

  delete from public.shift_request_entries
  where shift_request_id = v_request_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    begin
      v_work_date := (v_row->>'work_date')::date;
    exception when others then
      raise exception '希望日の形式が正しくありません。';
    end;

    if v_work_date < v_period.start_date or v_work_date > v_period.end_date then
      raise exception '期間外の日付は保存できません: %', v_work_date;
    end if;

    if exists (
      select 1
      from public.shift_period_closed_days closed
      where closed.shift_period_id = v_period.id
        and closed.work_date = v_work_date
    ) then
      raise exception '休業日には希望を入力できません: %', v_work_date;
    end if;

    if coalesce(v_row->>'entry_type', '') not in ('available', 'preferred', 'unavailable') then
      raise exception '希望区分が正しくありません: %', v_work_date;
    end if;
    v_entry_type := (v_row->>'entry_type')::public.shift_request_entry_type;
    v_is_all_day := coalesce((v_row->>'is_all_day')::boolean, false);
    v_note := nullif(btrim(coalesce(v_row->>'note', '')), '');

    if char_length(coalesce(v_note, '')) > 400 then
      raise exception 'メモは400文字以内で入力してください: %', v_work_date;
    end if;

    if v_entry_type = 'unavailable'::public.shift_request_entry_type then
      v_is_all_day := true;
    end if;

    v_start_time := null;
    v_end_time := null;
    v_start_at := null;
    v_end_at := null;
    v_time_slot_id := null;

    if not v_is_all_day then
      if nullif(v_row->>'time_slot_id', '') is not null then
        if not v_period.use_time_slots then
          raise exception 'この募集期間では勤務時間帯を選択できません。';
        end if;

        begin
          v_time_slot_id := (v_row->>'time_slot_id')::uuid;
        exception when others then
          raise exception '勤務時間帯の形式が正しくありません。';
        end;

        select slot.start_time, slot.end_time
          into v_start_time, v_end_time
        from public.store_shift_time_slots slot
        where slot.id = v_time_slot_id
          and slot.tenant_id = v_period.tenant_id
          and slot.store_id = v_period.store_id
          and slot.is_active;

        if not found then
          raise exception '選択した勤務時間帯は現在利用できません。';
        end if;
      else
        begin
          v_start_time := (v_row->>'start_time')::time;
          v_end_time := (v_row->>'end_time')::time;
        exception when others then
          raise exception '開始・終了時刻を確認してください: %', v_work_date;
        end;
      end if;

      if v_start_time is null or v_end_time is null then
        raise exception '開始・終了時刻を入力してください: %', v_work_date;
      end if;

      v_start_at :=
        (v_work_date + v_start_time)::timestamp at time zone v_timezone;
      v_end_at :=
        (
          v_work_date
          + case when v_end_time <= v_start_time then 1 else 0 end
          + v_end_time
        )::timestamp at time zone v_timezone;
    end if;

    insert into public.shift_request_entries (
      tenant_id,
      shift_request_id,
      work_date,
      is_all_day,
      start_at,
      end_at,
      entry_type,
      note,
      time_slot_id
    )
    values (
      v_period.tenant_id,
      v_request_id,
      v_work_date,
      v_is_all_day,
      v_start_at,
      v_end_at,
      v_entry_type,
      v_note,
      v_time_slot_id
    );
  end loop;

  return v_request_id;
end;
$$;

create or replace function public.set_mobile_shift_request_submitted(
  p_request_id uuid,
  p_submitted boolean
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_request public.shift_requests%rowtype;
  v_period public.shift_periods%rowtype;
  v_submitted_at timestamptz;
begin
  if v_user_id is null then
    raise exception '認証が必要です。';
  end if;

  select sr.*
    into v_request
  from public.shift_requests sr
  where sr.id = p_request_id
    and sr.user_id = v_user_id
  for update;

  if not found then
    raise exception '希望シフトが見つかりません。';
  end if;

  select sp.*
    into v_period
  from public.shift_periods sp
  where sp.id = v_request.shift_period_id;

  if not found
     or v_period.store_id <> v_request.store_id
     or v_period.tenant_id <> v_request.tenant_id then
    raise exception '希望シフト期間との関連が正しくありません。';
  end if;

  if v_period.status <> 'open'::public.shift_period_status
     or v_period.request_deadline_at <= clock_timestamp() then
    raise exception 'この希望シフトの受付は終了しています。';
  end if;

  if not exists (
    select 1
    from public.store_memberships sm
    where sm.tenant_id = v_request.tenant_id
      and sm.store_id = v_request.store_id
      and sm.user_id = v_user_id
      and sm.status = 'active'
  ) then
    raise exception 'この店舗の有効なスタッフではありません。';
  end if;

  if p_submitted and not exists (
    select 1
    from public.shift_request_entries entry
    where entry.shift_request_id = v_request.id
  ) then
    raise exception '1日以上の希望を入力してから提出してください。';
  end if;

  v_submitted_at := case when p_submitted then clock_timestamp() else null end;

  update public.shift_requests
  set submitted_at = v_submitted_at,
      updated_at = clock_timestamp()
  where id = v_request.id;

  return v_submitted_at;
end;
$$;

revoke all on function public.save_mobile_shift_request_draft(uuid, jsonb) from public;
revoke all on function public.save_mobile_shift_request_draft(uuid, jsonb) from anon;
grant execute on function public.save_mobile_shift_request_draft(uuid, jsonb) to authenticated;

revoke all on function public.set_mobile_shift_request_submitted(uuid, boolean) from public;
revoke all on function public.set_mobile_shift_request_submitted(uuid, boolean) from anon;
grant execute on function public.set_mobile_shift_request_submitted(uuid, boolean) to authenticated;

drop policy if exists shift_request_entries_self_write
on public.shift_request_entries;

create policy shift_request_entries_self_write
on public.shift_request_entries
for all
to authenticated
using (
  exists (
    select 1
    from public.shift_requests sr
    join public.shift_periods sp on sp.id = sr.shift_period_id
    where sr.id = shift_request_entries.shift_request_id
      and sr.user_id = (select auth.uid())
      and sr.submitted_at is null
      and sr.tenant_id = shift_request_entries.tenant_id
      and sr.store_id = sp.store_id
      and sp.tenant_id = sr.tenant_id
      and sp.status = 'open'::public.shift_period_status
      and sp.request_deadline_at > now()
  )
)
with check (
  exists (
    select 1
    from public.shift_requests sr
    join public.shift_periods sp on sp.id = sr.shift_period_id
    where sr.id = shift_request_entries.shift_request_id
      and sr.user_id = (select auth.uid())
      and sr.submitted_at is null
      and sr.tenant_id = shift_request_entries.tenant_id
      and sr.store_id = sp.store_id
      and sp.tenant_id = sr.tenant_id
      and sp.status = 'open'::public.shift_period_status
      and sp.request_deadline_at > now()
      and shift_request_entries.work_date between sp.start_date and sp.end_date
      and not exists (
        select 1
        from public.shift_period_closed_days closed
        where closed.shift_period_id = sp.id
          and closed.work_date = shift_request_entries.work_date
      )
  )
);
