-- Seed workout categories used for filters and catalog grouping.
update public.workouts
set is_active = false
where id <> 1;

delete from public.workout_exercises
where workout_id = 1;

delete from public.pose_training_samples;

insert into public.exercise_types (slug, label, description, sort_order) values
  ('squat', 'Squat', 'Lower-body strength movement tracked from hip, knee, and ankle landmarks.', 10),
  ('pushup', 'Push-up', 'Upper-body strength movement tracked from shoulder, elbow, and wrist landmarks.', 20),
  ('lunge', 'Lunge', 'Single-leg strength movement tracked from split stance, hip, knee, and ankle landmarks.', 30)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.workout_categories (id, name, sort_order) values
  (1, 'Strength', 10)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Seed the main workout catalog shown in Home and Workouts.
insert into public.workouts
  (id, title, duration_minutes, difficulty, calories, category_id, emoji, gradient_start, gradient_end, description, recommended_min_age, recommended_max_age, is_active, intensity)
values
  (1, 'Strength Form Basics', 15, 'Beginner', 105, 1, 'activity', '#14B8A6', '#2563EB', 'Camera-tracked squats, push-ups, and lunges focused on visible, coachable strength form.', null, null, true, 'Low')
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
  (1, 'Push-ups', 3, 8, 50, 20, 'pushup', 'Keep shoulders, hips, and heels in one strong line.'),
  (1, 'Lunges', 3, 8, 50, 30, 'lunge', 'Step into a split stance, keep your chest tall, then drive back up.')
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
  (3, 'pushup', array[105,108,162,160,174,172,20,0.38,0.62,0.26]::double precision[]),
  (4, 'pushup', array[82,86,166,164,172,173,16,0.34,0.70,0.25]::double precision[]),
  (5, 'lunge', array[164,162,92,128,102,118,78,1.65,1.02,2.20]::double precision[]),
  (6, 'lunge', array[166,164,118,88,116,98,82,1.58,1.04,2.05]::double precision[])
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
  (3, '1000 Points', '💯', 'Earn 1000 Healthpoints', 'healthpoints', 1000, 30),
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
  (8, 'profile_goals', 'Profile goals', 'profile', 80),
  (9, 'profile_menu_items', 'Profile menu items', 'profile', 90)
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
  (8, 'Improve Form', 'improve_form', '{}'::jsonb, 20)
on conflict (group_id, label) do update set
  value = excluded.value,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

-- Seed the default quick-workout target so quick start is database configurable.
insert into public.app_settings (key, value) values
  ('default_workout_id', '{"workout_id": 1}'::jsonb),
  ('dashboard_settings', '{"goal_label": "30 min"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Seed reusable Profile and legal information pages.
insert into public.app_pages (action_key, page_type, title, icon, body, sort_order) values
  ('settings', 'info', 'Account Settings', 'settings', 'Supabase Auth will manage email, password, and account security here. Local prototype data is currently stored on this device when Supabase Auth is not configured.', 10),
  ('notifications', 'info', 'Notifications', 'bell', 'Workout reminders, streak prompts, and reward updates will be configured here. Notification preferences will become database-backed user settings.', 20),
  ('support', 'info', 'Help & Support', 'help-circle', 'For the prototype, support content explains how ActiveSense uses local pose estimation, Healthpoints, and tailored workouts. A future support center can connect FAQs and contact forms.', 30),
  ('privacy', 'info', 'Privacy Settings', 'shield', 'ActiveSense processes camera frames locally for pose landmarks. Raw workout video is not uploaded in this prototype; Supabase should store profile, workout, reward, and landmark summary metadata only.', 40),
  ('profile_photo', 'info', 'Profile Photo', 'camera', 'Profile photo upload will connect to Supabase Storage. The camera used during workouts remains separate and is used for local pose landmarks.', 50),
  ('terms', 'info', 'Terms', 'file-text', 'Prototype terms: ActiveSense is an educational NUS Orbital prototype and should not replace professional medical advice. Stop exercising if you feel pain, dizziness, or discomfort.', 60),
  ('contact', 'info', 'Contact', 'mail', 'Contact and feedback forms will be connected when backend messaging is added. For now, this page confirms the link is wired.', 70)
on conflict (action_key) do update set
  page_type = excluded.page_type,
  title = excluded.title,
  icon = excluded.icon,
  body = excluded.body,
  sort_order = excluded.sort_order;

-- Seed settings-style rows shown in the Profile menu.
insert into public.app_options (group_id, label, value, metadata, sort_order) values
  (9, 'Account Settings', 'settings', '{"legacy_id":1,"icon":"settings","color":"#14B8A6"}'::jsonb, 10),
  (9, 'Notifications', 'notifications', '{"legacy_id":2,"icon":"bell","badge":"3","color":"#14B8A6"}'::jsonb, 20),
  (9, 'Help & Support', 'support', '{"legacy_id":3,"icon":"help-circle","color":"#14B8A6"}'::jsonb, 30),
  (9, 'Privacy Settings', 'privacy', '{"legacy_id":4,"icon":"shield","color":"#14B8A6"}'::jsonb, 40),
  (9, 'Log Out', 'logout', '{"legacy_id":5,"icon":"log-out","color":"#EF4444"}'::jsonb, 50)
on conflict (group_id, label) do update set
  value = excluded.value,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order;

select setval(pg_get_serial_sequence('public.app_option_groups', 'id'), (select max(id) from public.app_option_groups));
select setval(pg_get_serial_sequence('public.app_options', 'id'), (select max(id) from public.app_options));
select setval(pg_get_serial_sequence('public.workout_categories', 'id'), (select max(id) from public.workout_categories));
select setval(pg_get_serial_sequence('public.workouts', 'id'), (select max(id) from public.workouts));
select setval(pg_get_serial_sequence('public.workout_exercises', 'id'), (select max(id) from public.workout_exercises));
select setval(pg_get_serial_sequence('public.pose_training_samples', 'id'), (select max(id) from public.pose_training_samples));
