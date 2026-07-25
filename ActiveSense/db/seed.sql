-- Seed workout categories used for filters and catalog grouping.
delete from public.workout_session_exercise_results
where exercise_type in ('pushup', 'lunge', 'hip_extension', 'quad_stretch', 'triceps_stretch');

delete from public.workout_exercises
where workout_id in (1, 2, 3)
  or pose_class in ('pushup', 'lunge', 'hip_extension', 'quad_stretch', 'triceps_stretch');

delete from public.pose_training_samples;

delete from public.exercise_types
where slug in ('pushup', 'lunge', 'hip_extension', 'quad_stretch', 'triceps_stretch');

delete from public.workouts
where id not in (1, 2, 3);

delete from public.workout_categories
where id not in (1, 2, 3);

insert into public.exercise_types (slug, label, description, sort_order) values
  ('squat', 'Squat', 'Lower-body strength movement tracked from hip, knee, and ankle landmarks.', 10),
  ('sit_to_stand', 'Sit to Stand', 'Low-impact chair strength movement tracked from hip and knee height changes.', 20),
  ('calf_raise', 'Calf Raise', 'Standing lower-leg strength movement tracked from heel and toe landmarks.', 30),
  ('side_leg_raise', 'Side Leg Raise', 'Supported lateral leg raise tracked from hip and ankle movement.', 40),
  ('march', 'Stationary March', 'Warm-up movement tracked from alternating knee lifts.', 50),
  ('torso_twist', 'Torso Twist', 'Gentle trunk rotation tracked from shoulder and hip alignment.', 60),
  ('side_bend', 'Side Bend', 'Lateral trunk mobility movement tracked from shoulder tilt.', 70),
  ('overhead_reach', 'Overhead Reach', 'Shoulder mobility movement tracked from wrist height above shoulders.', 80),
  ('single_leg_stand', 'Single Leg Stand', 'Balance hold tracked from one lifted foot and a steady upright torso.', 90)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.workout_categories (id, name, sort_order) values
  (1, 'Strength', 10),
  (2, 'Healthy Ageing', 20),
  (3, 'Mobility', 30)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Seed the main workout catalog shown in Home and Workouts.
insert into public.workouts
  (id, title, duration_minutes, difficulty, calories, category_id, emoji, gradient_start, gradient_end, description, recommended_min_age, recommended_max_age, is_active, intensity)
values
  (1, 'Strength Form Basics', 15, 'Beginner', 105, 1, 'activity', '#14B8A6', '#2563EB', 'Camera-tracked squats, sit-to-stands, and calf raises focused on visible lower-body form.', null, null, true, 'Low'),
  (2, 'Healthy Ageing Balance & Strength', 22, 'Low Impact', 100, 2, 'heart', '#0F766E', '#84CC16', 'Gentle camera-tracked functional strength and balance exercises for active ageing.', 50, null, true, 'Low'),
  (3, 'Mobility & Flexibility', 12, 'Beginner', 55, 3, 'repeat', '#06B6D4', '#8B5CF6', 'Low-impact upper-body and trunk mobility movements tracked with visible posture cues.', null, null, true, 'Low')
on conflict (id) do update set
  title = excluded.title,
  duration_minutes = excluded.duration_minutes,
  difficulty = excluded.difficulty,
  calories = excluded.calories,
  category_id = excluded.category_id,
  emoji = excluded.emoji,
  gradient_start = excluded.gradient_start,
  gradient_end = excluded.gradient_end,
  description = excluded.description,
  recommended_min_age = excluded.recommended_min_age,
  recommended_max_age = excluded.recommended_max_age,
  is_active = excluded.is_active,
  intensity = excluded.intensity;

-- Seed the exercises that make up each workout session.
insert into public.workout_exercises
  (workout_id, name, sets, reps, points, sort_order, pose_class, feedback_prompt)
values
  (1, 'Squats', 3, 10, 50, 10, 'squat', 'Keep knees aligned with toes and chest lifted.'),
  (1, 'Sit to Stand', 3, 10, 40, 20, 'sit_to_stand', 'Lean forward slightly, stand tall, then lower with control.'),
  (1, 'Calf Raises', 3, 12, 35, 30, 'calf_raise', 'Rise onto your toes, pause briefly, then lower with control.'),
  (2, 'Stationary March', 2, 20, 30, 10, 'march', 'Stand tall and lift each knee gently.'),
  (2, 'Side Leg Raise', 2, 10, 35, 20, 'side_leg_raise', 'Keep your body tall and lift one straight leg to the side.'),
  (2, 'Single Leg Stand', 2, 5, 35, 30, 'single_leg_stand', 'Stand tall and lift one foot while keeping your balance.'),
  (2, 'Sit to Stand', 2, 10, 35, 40, 'sit_to_stand', 'Use a steady chair, stand tall, then sit back down slowly.'),
  (2, 'Calf Raises', 2, 12, 30, 50, 'calf_raise', 'Rise onto your toes while keeping posture upright.'),
  (3, 'Overhead Reach', 2, 10, 25, 10, 'overhead_reach', 'Reach one or both arms overhead, then lower smoothly.'),
  (3, 'Side Bend', 2, 10, 25, 20, 'side_bend', 'Bend gently to one side, return upright, then switch sides.'),
  (3, 'Torso Twist', 2, 10, 25, 30, 'torso_twist', 'Rotate your shoulders gently while keeping hips steady.')
on conflict (workout_id, sort_order) do update set
  name = excluded.name,
  sets = excluded.sets,
  reps = excluded.reps,
  points = excluded.points,
  target_landmarks = excluded.target_landmarks,
  pose_class = excluded.pose_class,
  feedback_prompt = excluded.feedback_prompt;

-- Seed feature vectors used by the lightweight pose classifier.
insert into public.pose_training_samples (id, label, features) values
  (1, 'squat', array[166,165,82,84,72,74,65,1.12,0.30,0.55]::double precision[]),
  (2, 'squat', array[158,160,96,93,83,82,68,1.20,0.28,0.48]::double precision[]),
  (3, 'sit_to_stand', array[168,168,96,98,78,80,72,1.12,0.72,0.50]::double precision[]),
  (4, 'sit_to_stand', array[166,166,128,126,112,114,76,1.16,0.62,0.52]::double precision[]),
  (5, 'calf_raise', array[168,168,168,168,166,166,88,1.25,0.52,0.55]::double precision[]),
  (6, 'calf_raise', array[166,166,170,170,168,168,88,1.28,0.50,0.50]::double precision[]),
  (7, 'side_leg_raise', array[168,168,170,156,170,142,88,1.38,0.48,2.45]::double precision[]),
  (8, 'side_leg_raise', array[168,168,156,170,142,170,88,1.36,0.48,2.35]::double precision[]),
  (9, 'single_leg_stand', array[166,166,92,168,90,168,88,1.25,0.50,1.30]::double precision[]),
  (10, 'single_leg_stand', array[166,166,168,92,168,90,88,1.25,0.50,1.30]::double precision[]),
  (11, 'march', array[150,150,88,166,92,164,86,1.20,0.85,1.45]::double precision[]),
  (12, 'march', array[150,150,166,88,164,92,86,1.20,0.85,1.45]::double precision[]),
  (13, 'overhead_reach', array[168,168,168,168,168,168,88,1.32,1.75,0.55]::double precision[]),
  (14, 'side_bend', array[168,168,168,168,168,168,76,1.30,0.70,0.55]::double precision[]),
  (15, 'torso_twist', array[168,168,168,168,168,168,88,1.55,0.65,0.55]::double precision[])
on conflict (id) do update set label = excluded.label, features = excluded.features;

-- Seed rewards that users can redeem with Healthpoints.
insert into public.reward_vouchers (id, name, points, emoji, category) values
  (1, 'FairPrice $5 Voucher', 500, '🛒', 'Groceries'),
  (2, 'GrabFood $10 Voucher', 1000, '🍔', 'Food'),
  (3, 'Guardian $5 Voucher', 500, '💊', 'Health'),
  (4, 'Decathlon $15 Voucher', 1500, '⚽', 'Sports')
on conflict (id) do update set name = excluded.name, points = excluded.points, emoji = excluded.emoji, category = excluded.category;

-- Seed achievement definitions checked against user_stats.
insert into public.achievements (id, title, emoji, description, requirement_type, requirement_value, sort_order) values
  (1, '7-Day Streak', '🔥', 'Complete 7 days in a row', 'streak_days', 7, 10),
  (2, 'First Workout', '🎯', 'Finish your first session', 'total_workouts', 1, 20),
  (3, '1000 Points', '💯', 'Earn 1000 lifetime Healthpoints', 'lifetime_healthpoints', 1000, 30),
  (4, '30-Day Streak', '🏆', 'Complete 30 consecutive days', 'streak_days', 30, 40)
on conflict (id) do update set title = excluded.title, emoji = excluded.emoji, description = excluded.description, requirement_type = excluded.requirement_type, requirement_value = excluded.requirement_value, sort_order = excluded.sort_order;

-- Seed small configurable lists through one relation-backed option model.
insert into public.app_option_groups (id, key, label, group_type, sort_order) values
  (1, 'fitness_level', 'Fitness level', 'onboarding', 10),
  (2, 'preferred_intensity', 'Preferred intensity', 'onboarding', 20),
  (3, 'medical_general', 'General', 'medical_condition', 30),
  (4, 'medical_mobility_joint', 'Mobility & Joint', 'medical_condition', 40),
  (5, 'medical_cardiovascular_metabolic', 'Cardiovascular & Metabolic', 'medical_condition', 50),
  (6, 'medical_respiratory', 'Respiratory', 'medical_condition', 60),
  (7, 'medical_other', 'Other', 'medical_condition', 70),
  (8, 'profile_goals', 'Profile goals', 'profile', 80)
on conflict (id) do update set
  key = excluded.key,
  label = excluded.label,
  group_type = excluded.group_type,
  sort_order = excluded.sort_order;

delete from public.app_options
using public.app_option_groups
where app_options.group_id = app_option_groups.id
  and app_option_groups.key = 'profile_goals';

insert into public.app_options (group_id, label, value, metadata, sort_order) values
  (1, 'Beginner', 'beginner', '{"legacy_id":1}'::jsonb, 10),
  (1, 'Intermediate', 'intermediate', '{"legacy_id":2}'::jsonb, 20),
  (1, 'Advanced', 'advanced', '{"legacy_id":3}'::jsonb, 30),
  (1, 'Low Impact', 'low_impact', '{"legacy_id":4}'::jsonb, 40),
  (2, 'Low', 'low', '{"legacy_id":5}'::jsonb, 10),
  (2, 'Medium', 'medium', '{"legacy_id":6}'::jsonb, 20),
  (2, 'High', 'high', '{"legacy_id":7}'::jsonb, 30),
  (3, 'None', 'none', '{"legacy_id":1}'::jsonb, 10),
  (4, 'Knee pain', 'knee_pain', '{"legacy_id":2}'::jsonb, 20),
  (4, 'Back pain', 'back_pain', '{"legacy_id":3}'::jsonb, 30),
  (4, 'Arthritis', 'arthritis', '{"legacy_id":4}'::jsonb, 40),
  (4, 'Balance concerns', 'balance_concerns', '{"legacy_id":5}'::jsonb, 50),
  (5, 'Hypertension', 'hypertension', '{"legacy_id":6}'::jsonb, 60),
  (5, 'Diabetes', 'diabetes', '{"legacy_id":7}'::jsonb, 70),
  (6, 'Asthma', 'asthma', '{"legacy_id":8}'::jsonb, 80),
  (6, 'Breathing difficulty', 'breathing_difficulty', '{"legacy_id":9}'::jsonb, 90),
  (7, 'Recent injury', 'recent_injury', '{"legacy_id":10}'::jsonb, 100),
  (8, 'Build Strength', 'build_strength', '{}'::jsonb, 10),
  (8, 'Improve Form', 'improve_form', '{}'::jsonb, 20),
  (8, 'Improve Balance', 'improve_balance', '{}'::jsonb, 30),
  (8, 'Age Actively', 'age_actively', '{}'::jsonb, 40)
on conflict (group_id, label) do update set
  value = excluded.value,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

-- Seed the default quick-workout target so quick start is database configurable.
insert into public.app_settings (key, value) values
  ('default_workout_id', '{"workout_id": 1}'::jsonb),
  ('dashboard_settings', '{"goal_label": "30 min"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Remove placeholder Profile/legal pages that no longer have screens in the app.
delete from public.app_pages
where action_key in ('settings', 'notifications', 'support', 'privacy', 'profile_photo', 'terms', 'contact');

-- Remove settings-style Profile rows; Profile now shows only implemented actions.
delete from public.app_options
using public.app_option_groups
where app_options.group_id = app_option_groups.id
  and app_option_groups.key = 'profile_menu_items'
  and app_options.value in ('settings', 'notifications', 'support', 'privacy', 'logout');

delete from public.app_option_groups
where key = 'profile_menu_items';

select setval(pg_get_serial_sequence('public.app_option_groups', 'id'), (select max(id) from public.app_option_groups));
select setval(pg_get_serial_sequence('public.app_options', 'id'), (select max(id) from public.app_options));
select setval(pg_get_serial_sequence('public.workout_categories', 'id'), (select max(id) from public.workout_categories));
select setval(pg_get_serial_sequence('public.workouts', 'id'), (select max(id) from public.workouts));
select setval(pg_get_serial_sequence('public.workout_exercises', 'id'), (select max(id) from public.workout_exercises));
select setval(pg_get_serial_sequence('public.pose_training_samples', 'id'), (select max(id) from public.pose_training_samples));
