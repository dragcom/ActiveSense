create extension if not exists pgcrypto;

create table public.workout_categories (
  id bigserial primary key,
  name text not null unique,
  sort_order integer not null default 0
);

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

create table public.workout_exercises (
  id bigserial primary key,
  workout_id bigint not null references public.workouts(id) on delete cascade,
  name text not null,
  sets integer not null check (sets > 0),
  reps integer not null check (reps > 0),
  points integer not null check (points >= 0),
  sort_order integer not null default 0,
  target_landmarks integer not null default 33,
  feedback_prompt text not null default 'Great form! Keep it up!'
);

create unique index workout_exercises_workout_sort_unique on public.workout_exercises(workout_id, sort_order);

create table public.reward_vouchers (
  id bigserial primary key,
  name text not null,
  points integer not null check (points > 0),
  emoji text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.achievements (
  id bigserial primary key,
  title text not null,
  emoji text not null,
  description text not null,
  requirement_type text not null,
  requirement_value integer not null check (requirement_value >= 0),
  sort_order integer not null default 0
);

create table public.onboarding_choices (
  id bigserial primary key,
  field_name text not null,
  label text not null,
  sort_order integer not null default 0,
  unique (field_name, label)
);

create table public.medical_condition_options (
  id bigserial primary key,
  category text not null,
  label text not null,
  sort_order integer not null default 0,
  unique (category, label)
);

create table public.profile_goals (
  id bigserial primary key,
  label text not null unique,
  sort_order integer not null default 0
);

create table public.profile_menu_items (
  id bigserial primary key,
  icon text not null,
  label text not null,
  badge text,
  action_key text,
  color text not null,
  sort_order integer not null default 0
);

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  age integer not null check (age > 0),
  fitness_level text not null,
  preferred_intensity text not null,
  medical_conditions text[] not null default '{}',
  privacy_mode text not null default 'avatar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_stats (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  healthpoints integer not null default 0 check (healthpoints >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  total_workouts integer not null default 0 check (total_workouts >= 0),
  updated_at timestamptz not null default now()
);

create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.user_profiles(id) on delete set null,
  workout_id bigint references public.workouts(id) on delete set null,
  points_earned integer not null default 0,
  completed_at timestamptz not null default now(),
  pose_landmark_count integer,
  processed_locally boolean not null default true
);

create table public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  voucher_id bigint not null references public.reward_vouchers(id),
  points_spent integer not null check (points_spent > 0),
  redeemed_at timestamptz not null default now(),
  unique (user_id, voucher_id)
);

create index workouts_category_idx on public.workouts(category_id);
create index workout_exercises_workout_sort_idx on public.workout_exercises(workout_id, sort_order);
create index workout_sessions_user_completed_idx on public.workout_sessions(user_id, completed_at desc);
