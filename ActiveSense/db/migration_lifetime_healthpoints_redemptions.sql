-- Run this once on an existing ActiveSense Supabase project before rerunning seed.sql.
alter table public.user_stats
  add column if not exists lifetime_healthpoints integer not null default 0 check (lifetime_healthpoints >= 0);

update public.user_stats
set lifetime_healthpoints = greatest(lifetime_healthpoints, healthpoints);

alter table public.achievements
  drop constraint if exists achievements_requirement_type_check;

alter table public.achievements
  add constraint achievements_requirement_type_check
  check (requirement_type in ('healthpoints', 'lifetime_healthpoints', 'streak_days', 'total_workouts'));

alter table public.voucher_redemptions
  add column if not exists redemption_code text;

alter table public.voucher_redemptions
  add column if not exists used_at timestamptz;

alter table public.voucher_redemptions
  add column if not exists used_by text;

update public.voucher_redemptions
set redemption_code = 'AS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where redemption_code is null;

alter table public.voucher_redemptions
  alter column redemption_code set not null;

alter table public.voucher_redemptions
  alter column redemption_code set default ('AS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

create unique index if not exists voucher_redemptions_redemption_code_unique
  on public.voucher_redemptions(redemption_code);

create index if not exists voucher_redemptions_code_idx
  on public.voucher_redemptions(redemption_code);

drop function if exists public.complete_workout(bigint, integer, integer, text);

create or replace function public.complete_workout(
  p_workout_id bigint,
  p_points_earned integer,
  p_pose_landmark_count integer,
  p_client_session_id text default null
)
returns table (
  healthpoints integer,
  lifetime_healthpoints integer,
  streak_days integer,
  total_workouts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_key text := nullif(p_client_session_id, '');
  v_workout_exists boolean;
  v_workout_points integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required to complete a workout.';
  end if;

  if p_points_earned < 0 then
    raise exception 'Workout points cannot be negative.';
  end if;

  if p_pose_landmark_count is not null and p_pose_landmark_count < 0 then
    raise exception 'Pose landmark count cannot be negative.';
  end if;

  if p_workout_id is not null then
    select exists (
      select 1
      from public.workouts
      where workouts.id = p_workout_id
        and workouts.is_active = true
    )
    into v_workout_exists;

    if not v_workout_exists then
      raise exception 'Workout is not available.';
    end if;

    select coalesce(sum(workout_exercises.points), 0)
    into v_workout_points
    from public.workout_exercises
    where workout_exercises.workout_id = p_workout_id;

    if v_workout_points <= 0 then
      raise exception 'Workout has no configured points.';
    end if;

    if p_points_earned > v_workout_points then
      raise exception 'Workout points exceed configured exercise points.';
    end if;
  end if;

  insert into public.user_stats (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  if v_session_key is not null and exists (
    select 1
    from public.workout_sessions
    where user_id = v_user_id and client_session_id = v_session_key
  ) then
    select user_stats.healthpoints, user_stats.lifetime_healthpoints, user_stats.streak_days, user_stats.total_workouts
    into healthpoints, lifetime_healthpoints, streak_days, total_workouts
    from public.user_stats
    where user_id = v_user_id;

    return next;
    return;
  end if;

  insert into public.workout_sessions (
    user_id,
    workout_id,
    client_session_id,
    points_earned,
    pose_landmark_count,
    processed_locally
  )
  values (
    v_user_id,
    p_workout_id,
    v_session_key,
    p_points_earned,
    p_pose_landmark_count,
    true
  );

  update public.user_stats
  set
    healthpoints = user_stats.healthpoints + p_points_earned,
    lifetime_healthpoints = user_stats.lifetime_healthpoints + p_points_earned,
    total_workouts = user_stats.total_workouts + 1,
    streak_days = case
      when user_stats.last_workout_date = current_date then user_stats.streak_days
      else user_stats.streak_days + 1
    end,
    last_workout_date = current_date,
    updated_at = now()
  where user_id = v_user_id
  returning user_stats.healthpoints, user_stats.lifetime_healthpoints, user_stats.streak_days, user_stats.total_workouts
  into healthpoints, lifetime_healthpoints, streak_days, total_workouts;

  return next;
end;
$$;

drop function if exists public.redeem_voucher(bigint);

create or replace function public.redeem_voucher(p_voucher_id bigint)
returns table (
  healthpoints integer,
  lifetime_healthpoints integer,
  streak_days integer,
  total_workouts integer,
  redemption_code text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer;
  v_redemption_code text;
  v_current_stats public.user_stats%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required to redeem a voucher.';
  end if;

  select points
  into v_points
  from public.reward_vouchers
  where id = p_voucher_id and is_active = true;

  if v_points is null then
    raise exception 'Voucher is not available.';
  end if;

  insert into public.user_stats (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select *
  into v_current_stats
  from public.user_stats
  where user_id = v_user_id
  for update;

  if v_current_stats.healthpoints < v_points then
    raise exception 'Not enough Healthpoints to redeem this reward.';
  end if;

  if exists (
    select 1
    from public.voucher_redemptions
    where user_id = v_user_id and voucher_id = p_voucher_id
  ) then
    raise exception 'Voucher already redeemed.';
  end if;

  insert into public.voucher_redemptions (user_id, voucher_id, points_spent)
  values (v_user_id, p_voucher_id, v_points)
  returning voucher_redemptions.redemption_code into v_redemption_code;

  update public.user_stats
  set
    healthpoints = user_stats.healthpoints - v_points,
    updated_at = now()
  where user_id = v_user_id
  returning user_stats.healthpoints, user_stats.lifetime_healthpoints, user_stats.streak_days, user_stats.total_workouts
  into healthpoints, lifetime_healthpoints, streak_days, total_workouts;

  redemption_code := v_redemption_code;
  return next;
end;
$$;

revoke all on function public.complete_workout(bigint, integer, integer, text) from public;
revoke all on function public.redeem_voucher(bigint) from public;
grant execute on function public.complete_workout(bigint, integer, integer, text) to authenticated;
grant execute on function public.redeem_voucher(bigint) to authenticated;

create or replace function public.mark_voucher_used(
  p_redemption_code text,
  p_used_by text default null
)
returns table (
  voucher_id bigint,
  redemption_code text,
  used_at timestamptz,
  used_by text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(p_redemption_code), '') is null then
    raise exception 'Redemption code is required.';
  end if;

  update public.voucher_redemptions
  set
    used_at = coalesce(voucher_redemptions.used_at, now()),
    used_by = coalesce(voucher_redemptions.used_by, nullif(trim(p_used_by), ''))
  where voucher_redemptions.redemption_code = upper(trim(p_redemption_code))
  returning voucher_redemptions.voucher_id,
    voucher_redemptions.redemption_code,
    voucher_redemptions.used_at,
    voucher_redemptions.used_by
  into voucher_id, redemption_code, used_at, used_by;

  if redemption_code is null then
    raise exception 'Redemption code not found.';
  end if;

  return next;
end;
$$;

revoke all on function public.mark_voucher_used(text, text) from public;
grant execute on function public.mark_voucher_used(text, text) to authenticated;
