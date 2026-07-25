-- pgcrypto provides gen_random_uuid() for user-owned rows.
create extension if not exists pgcrypto;

-- Exercise types stay limited to movements the 33-point pose model can inspect reliably.
create table public.exercise_types (
  slug text primary key,
  label text not null unique,
  description text not null,
  sort_order integer not null default 0
);

-- Workout categories power filters and recommendation labels.
create table public.workout_categories (
  id bigserial primary key,
  name text not null unique,
  sort_order integer not null default 0
);

-- Workouts are the catalog cards shown on Home and Workouts screens.
create table public.workouts (
  id bigserial primary key,
  title text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  difficulty text not null,
  calories integer not null check (calories >= 0),
  category_id bigint not null references public.workout_categories(id),
  emoji text not null,
  gradient_start text not null,
  gradient_end text not null,
  description text not null,
  recommended_min_age integer,
  recommended_max_age integer,
  is_active boolean not null default true,
  intensity text not null default 'Low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (difficulty in ('Beginner', 'Intermediate', 'Advanced', 'Low Impact')),
  check (intensity in ('Low', 'Medium', 'High')),
  check (recommended_min_age is null or recommended_min_age > 0),
  check (recommended_max_age is null or recommended_max_age > 0),
  check (recommended_min_age is null or recommended_max_age is null or recommended_min_age <= recommended_max_age)
);

-- Workout exercises describe each camera-tracked step inside a workout session.
create table public.workout_exercises (
  id bigserial primary key,
  workout_id bigint not null references public.workouts(id) on delete cascade,
  name text not null,
  sets integer not null check (sets > 0),
  reps integer not null check (reps > 0),
  points integer not null check (points >= 0),
  sort_order integer not null default 0,
  target_landmarks integer not null default 33,
  pose_class text not null references public.exercise_types(slug),
  feedback_prompt text not null default 'Great form! Keep it up!',
  check (target_landmarks = 33)
);

-- Prevent duplicate exercise ordering inside the same workout.
create unique index workout_exercises_workout_sort_unique on public.workout_exercises(workout_id, sort_order);
create unique index workout_exercises_workout_name_unique on public.workout_exercises(workout_id, name);

-- Reward vouchers are redeemed with Healthpoints in the Progress screen.
create table public.reward_vouchers (
  id bigserial primary key,
  name text not null,
  points integer not null check (points > 0),
  emoji text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Achievements unlock when user_stats reaches the required values.
create table public.achievements (
  id bigserial primary key,
  title text not null,
  emoji text not null,
  description text not null,
  requirement_type text not null check (requirement_type in ('healthpoints', 'streak_days', 'total_workouts')),
  requirement_value integer not null check (requirement_value >= 0),
  sort_order integer not null default 0
);

-- App option groups collect small configurable lists without one table per UI list.
create table public.app_option_groups (
  id bigserial primary key,
  key text not null unique,
  label text not null,
  group_type text not null check (group_type in ('onboarding', 'medical_condition', 'profile')),
  sort_order integer not null default 0
);

-- App options are the relation-backed rows for onboarding choices, medical options, and profile chips/menu rows.
create table public.app_options (
  id bigserial primary key,
  group_id bigint not null references public.app_option_groups(id) on delete cascade,
  label text not null,
  value text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  unique (group_id, label),
  unique (group_id, value)
);

-- App settings gives Supabase a place for small JSON configuration values.
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

-- App pages store reusable help/settings/legal copy outside React components.
create table public.app_pages (
  action_key text primary key,
  page_type text not null default 'info',
  title text not null,
  icon text not null default 'info',
  body text not null,
  sort_order integer not null default 0
);

-- Pose samples store simple feature vectors for the local pose classifier.
create table public.pose_training_samples (
  id bigserial primary key,
  label text not null references public.exercise_types(slug),
  features double precision[] not null,
  created_at timestamptz not null default now(),
  check (array_length(features, 1) = 10)
);

-- User profiles store onboarding answers and use Supabase Auth user IDs.
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age integer not null check (age > 0),
  fitness_level text not null check (fitness_level in ('Beginner', 'Intermediate', 'Advanced', 'Low Impact')),
  preferred_intensity text not null check (preferred_intensity in ('Low', 'Medium', 'High')),
  privacy_mode text not null default 'avatar' check (privacy_mode in ('avatar', 'camera')),
  avatar_config jsonb not null default '{"optionId":"user-avatar","label":"My ActiveSense Avatar","avatarUrl":"/avatars/avatar_test.glb","accentColor":"#14B8A6"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User medical conditions are normalized so health constraints remain queryable.
create table public.user_profile_medical_conditions (
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  option_id bigint not null references public.app_options(id),
  created_at timestamptz not null default now(),
  primary key (profile_id, option_id)
);

-- User stats store the counters shown on Home and Progress.
create table public.user_stats (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  healthpoints integer not null default 0 check (healthpoints >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  total_workouts integer not null default 0 check (total_workouts >= 0),
  last_workout_date date,
  updated_at timestamptz not null default now()
);

-- Every completed profile starts with a progress row so Home/Progress can read Supabase immediately.
create or replace function public.create_initial_user_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger user_profiles_create_initial_stats
after insert on public.user_profiles
for each row execute function public.create_initial_user_stats();

-- Workout sessions are saved after a completed camera-tracked workout.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  workout_id bigint references public.workouts(id) on delete set null,
  client_session_id text,
  points_earned integer not null default 0,
  completed_at timestamptz not null default now(),
  pose_landmark_count integer check (pose_landmark_count is null or pose_landmark_count >= 0),
  processed_locally boolean not null default true
);

-- Exercise results keep future rep/form analytics normalized instead of stuffing JSON into sessions.
create table public.workout_session_exercise_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id bigint references public.workout_exercises(id) on delete set null,
  exercise_type text references public.exercise_types(slug),
  reps_completed integer not null default 0 check (reps_completed >= 0),
  points_earned integer not null default 0 check (points_earned >= 0),
  form_score numeric(5,2) check (form_score is null or (form_score >= 0 and form_score <= 100)),
  created_at timestamptz not null default now()
);

-- Voucher redemptions prevent the same user from claiming the same reward twice.
create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  voucher_id bigint not null references public.reward_vouchers(id),
  points_spent integer not null check (points_spent > 0),
  redeemed_at timestamptz not null default now(),
  unique (user_id, voucher_id)
);

-- Indexes keep common catalog and user-history queries fast.
create index workouts_category_idx on public.workouts(category_id);
create index workout_exercises_workout_sort_idx on public.workout_exercises(workout_id, sort_order);
create index app_options_group_sort_idx on public.app_options(group_id, sort_order);
create index pose_training_samples_label_idx on public.pose_training_samples(label);
create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);
create index user_profile_medical_conditions_option_idx on public.user_profile_medical_conditions(option_id);
create unique index workout_sessions_user_client_session_unique on public.workout_sessions(user_id, client_session_id) where client_session_id is not null;
create index workout_session_exercise_results_session_idx on public.workout_session_exercise_results(session_id);
create index voucher_redemptions_user_redeemed_idx on public.voucher_redemptions(user_id, redeemed_at desc);

-- Keep updated_at columns reliable without trusting client clocks.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workouts_touch_updated_at
before update on public.workouts
for each row execute function public.touch_updated_at();

create trigger user_profiles_touch_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

create trigger user_stats_touch_updated_at
before update on public.user_stats
for each row execute function public.touch_updated_at();

-- RLS is explicit here so security is predictable even without Supabase automatic RLS.
alter table public.exercise_types enable row level security;
alter table public.workout_categories enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.reward_vouchers enable row level security;
alter table public.achievements enable row level security;
alter table public.app_option_groups enable row level security;
alter table public.app_options enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_pages enable row level security;
alter table public.pose_training_samples enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profile_medical_conditions enable row level security;
alter table public.user_stats enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercise_results enable row level security;
alter table public.voucher_redemptions enable row level security;

-- Public catalog tables can be read by the mobile anon key.
create policy "Exercise types are readable" on public.exercise_types for select using (true);
create policy "Catalog categories are readable" on public.workout_categories for select using (true);
create policy "Catalog workouts are readable" on public.workouts for select using (is_active = true);
create policy "Catalog exercises are readable" on public.workout_exercises for select using (true);
create policy "Active rewards are readable" on public.reward_vouchers for select using (is_active = true);
create policy "Achievements are readable" on public.achievements for select using (true);
create policy "App option groups are readable" on public.app_option_groups for select using (true);
create policy "App options are readable" on public.app_options for select using (true);
create policy "Public app settings are readable" on public.app_settings for select using (true);
create policy "App pages are readable" on public.app_pages for select using (true);
create policy "Pose training samples are readable" on public.pose_training_samples for select using (true);

-- Users may read and update only their own profile and progress rows.
create policy "Users can read own profile" on public.user_profiles for select using (id = auth.uid());
create policy "Users can insert own profile" on public.user_profiles for insert with check (id = auth.uid());
create policy "Users can update own profile" on public.user_profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Users can read own medical conditions" on public.user_profile_medical_conditions for select using (profile_id = auth.uid());
create policy "Users can insert own medical conditions" on public.user_profile_medical_conditions for insert with check (profile_id = auth.uid());
create policy "Users can delete own medical conditions" on public.user_profile_medical_conditions for delete using (profile_id = auth.uid());

create policy "Users can read own stats" on public.user_stats for select using (user_id = auth.uid());

create policy "Users can read own workout sessions" on public.workout_sessions for select using (user_id = auth.uid());

create policy "Users can read own exercise results" on public.workout_session_exercise_results
for select using (
  exists (
    select 1
    from public.workout_sessions
    where workout_sessions.id = workout_session_exercise_results.session_id
      and workout_sessions.user_id = auth.uid()
  )
);

create policy "Users can read own redemptions" on public.voucher_redemptions for select using (user_id = auth.uid());

-- SQL privileges mirror the RLS model used by the mobile anon and authenticated keys.
grant usage on schema public to anon, authenticated;

grant select on
  public.exercise_types,
  public.workout_categories,
  public.workouts,
  public.workout_exercises,
  public.reward_vouchers,
  public.achievements,
  public.app_option_groups,
  public.app_options,
  public.app_settings,
  public.app_pages,
  public.pose_training_samples
to anon, authenticated;

grant select, insert, update on
  public.user_profiles
to authenticated;

grant select on
  public.user_stats,
  public.workout_sessions,
  public.workout_session_exercise_results,
  public.voucher_redemptions
to authenticated;

grant select, insert, delete on
  public.user_profile_medical_conditions
to authenticated;

-- complete_workout awards points and records a session in one transaction.
create or replace function public.complete_workout(
  p_workout_id bigint,
  p_points_earned integer,
  p_pose_landmark_count integer,
  p_client_session_id text default null
)
returns table (
  healthpoints integer,
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
    select user_stats.healthpoints, user_stats.streak_days, user_stats.total_workouts
    into healthpoints, streak_days, total_workouts
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
    total_workouts = user_stats.total_workouts + 1,
    streak_days = case
      when user_stats.last_workout_date = current_date then user_stats.streak_days
      else user_stats.streak_days + 1
    end,
    last_workout_date = current_date,
    updated_at = now()
  where user_id = v_user_id
  returning user_stats.healthpoints, user_stats.streak_days, user_stats.total_workouts
  into healthpoints, streak_days, total_workouts;

  return next;
end;
$$;

-- redeem_voucher checks balance, records redemption, and deducts points atomically.
create or replace function public.redeem_voucher(p_voucher_id bigint)
returns table (
  healthpoints integer,
  streak_days integer,
  total_workouts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_points integer;
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
  values (v_user_id, p_voucher_id, v_points);

  update public.user_stats
  set
    healthpoints = user_stats.healthpoints - v_points,
    updated_at = now()
  where user_id = v_user_id
  returning user_stats.healthpoints, user_stats.streak_days, user_stats.total_workouts
  into healthpoints, streak_days, total_workouts;

  return next;
end;
$$;

revoke all on function public.complete_workout(bigint, integer, integer, text) from public;
revoke all on function public.redeem_voucher(bigint) from public;
revoke all on function public.create_initial_user_stats() from public;
grant execute on function public.complete_workout(bigint, integer, integer, text) to authenticated;
grant execute on function public.redeem_voucher(bigint) to authenticated;
