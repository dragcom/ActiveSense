-- pgcrypto provides gen_random_uuid() for user-owned rows.
create extension if not exists pgcrypto;

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
  intensity text not null default 'Low',
  created_at timestamptz not null default now()
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
  pose_class text not null default 'standing',
  feedback_prompt text not null default 'Great form! Keep it up!'
);

-- Prevent duplicate exercise ordering inside the same workout.
create unique index workout_exercises_workout_sort_unique on public.workout_exercises(workout_id, sort_order);

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
  requirement_type text not null,
  requirement_value integer not null check (requirement_value >= 0),
  sort_order integer not null default 0
);

-- Onboarding choices keep profile setup options data-driven.
create table public.onboarding_choices (
  id bigserial primary key,
  field_name text not null,
  label text not null,
  sort_order integer not null default 0,
  unique (field_name, label)
);

-- Medical condition options help tailor safer workout recommendations.
create table public.medical_condition_options (
  id bigserial primary key,
  category text not null,
  label text not null,
  sort_order integer not null default 0,
  unique (category, label)
);

-- Profile goals are lightweight labels shown on the Profile screen.
create table public.profile_goals (
  id bigserial primary key,
  label text not null unique,
  sort_order integer not null default 0
);

-- Profile menu items keep settings-style rows configurable.
create table public.profile_menu_items (
  id bigserial primary key,
  icon text not null,
  label text not null,
  badge text,
  action_key text,
  color text not null,
  sort_order integer not null default 0
);

-- App settings gives Supabase a place for small JSON configuration values.
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

-- Info pages store reusable help/settings/legal copy outside React components.
create table public.info_pages (
  action_key text primary key,
  title text not null,
  icon text not null default 'info',
  body text not null,
  sort_order integer not null default 0
);

-- Pose samples store simple feature vectors for the local pose classifier.
create table public.pose_training_samples (
  id bigserial primary key,
  label text not null,
  features double precision[] not null,
  created_at timestamptz not null default now()
);

-- User profiles store onboarding answers and use Supabase Auth user IDs.
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  age integer not null check (age > 0),
  fitness_level text not null,
  preferred_intensity text not null,
  medical_conditions text[] not null default '{}',
  privacy_mode text not null default 'avatar',
  avatar_config jsonb not null default '{"optionId":"user-avatar","label":"My ActiveSense Avatar","avatarUrl":"/avatars/avatar_test.glb","accentColor":"#14B8A6"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

-- Workout sessions are saved after a completed camera-tracked workout.
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  workout_id bigint references public.workouts(id) on delete set null,
  client_session_id text,
  points_earned integer not null default 0,
  completed_at timestamptz not null default now(),
  pose_landmark_count integer,
  processed_locally boolean not null default true
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
create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);
create unique index workout_sessions_user_client_session_unique on public.workout_sessions(user_id, client_session_id) where client_session_id is not null;

-- RLS is explicit here so security is predictable even without Supabase automatic RLS.
alter table public.workout_categories enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.reward_vouchers enable row level security;
alter table public.achievements enable row level security;
alter table public.onboarding_choices enable row level security;
alter table public.medical_condition_options enable row level security;
alter table public.profile_goals enable row level security;
alter table public.profile_menu_items enable row level security;
alter table public.app_settings enable row level security;
alter table public.info_pages enable row level security;
alter table public.pose_training_samples enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_stats enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.voucher_redemptions enable row level security;

-- Public catalog tables can be read by the mobile anon key.
create policy "Catalog categories are readable" on public.workout_categories for select using (true);
create policy "Catalog workouts are readable" on public.workouts for select using (true);
create policy "Catalog exercises are readable" on public.workout_exercises for select using (true);
create policy "Active rewards are readable" on public.reward_vouchers for select using (true);
create policy "Achievements are readable" on public.achievements for select using (true);
create policy "Onboarding choices are readable" on public.onboarding_choices for select using (true);
create policy "Medical options are readable" on public.medical_condition_options for select using (true);
create policy "Profile goals are readable" on public.profile_goals for select using (true);
create policy "Profile menu items are readable" on public.profile_menu_items for select using (true);
create policy "Public app settings are readable" on public.app_settings for select using (true);
create policy "Info pages are readable" on public.info_pages for select using (true);
create policy "Pose training samples are readable" on public.pose_training_samples for select using (true);

-- Users may read and update only their own profile and progress rows.
create policy "Users can read own profile" on public.user_profiles for select using (id = auth.uid());
create policy "Users can insert own profile" on public.user_profiles for insert with check (id = auth.uid());
create policy "Users can update own profile" on public.user_profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Users can read own stats" on public.user_stats for select using (user_id = auth.uid());
create policy "Users can insert own stats" on public.user_stats for insert with check (user_id = auth.uid());
create policy "Users can update own stats" on public.user_stats for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can read own workout sessions" on public.workout_sessions for select using (user_id = auth.uid());
create policy "Users can insert own workout sessions" on public.workout_sessions for insert with check (user_id = auth.uid());

create policy "Users can read own redemptions" on public.voucher_redemptions for select using (user_id = auth.uid());
create policy "Users can insert own redemptions" on public.voucher_redemptions for insert with check (user_id = auth.uid());

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
begin
  if v_user_id is null then
    raise exception 'Authentication required to complete a workout.';
  end if;

  if p_points_earned < 0 then
    raise exception 'Workout points cannot be negative.';
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

grant execute on function public.complete_workout(bigint, integer, integer, text) to authenticated;
grant execute on function public.redeem_voucher(bigint) to authenticated;
