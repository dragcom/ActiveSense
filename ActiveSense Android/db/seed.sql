-- Seed workout categories used for filters and catalog grouping.
insert into public.workout_categories (id, name, sort_order) values
  (1, 'Beginner', 10),
  (2, 'Senior', 20),
  (3, 'Cardio', 30),
  (4, 'Strength', 40),
  (5, 'Flexibility', 50)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Seed the main workout catalog shown in Home and Workouts.
insert into public.workouts
  (id, title, duration_minutes, difficulty, calories, category_id, emoji, gradient_start, gradient_end, description, recommended_min_age, recommended_max_age, intensity)
values
  (1, 'Gentle Morning Yoga', 15, 'Beginner', 50, 5, '🧘', '#A78BFA', '#EC4899', 'Start your day with gentle stretches and mindful breathing.', null, null, 'Low'),
  (2, 'Senior Seated Exercises', 20, 'Low Impact', 60, 2, '🪑', '#14B8A6', '#06B6D4', 'Safe, effective chair-based movements for mobility.', 55, null, 'Low'),
  (3, 'Cardio Walk Burst', 18, 'Moderate', 120, 3, '🚶', '#2DD4BF', '#22D3EE', 'Light cardio intervals to boost endurance and mood.', null, null, 'Medium'),
  (4, 'Core Stability Basics', 16, 'Beginner', 90, 4, '🧠', '#FB923C', '#F43F5E', 'Build a strong core with low-impact strength work.', null, null, 'Low'),
  (5, 'Balance & Mobility', 12, 'Low Impact', 45, 2, '⚖️', '#60A5FA', '#38BDF8', 'Improve balance with steady, confidence-building drills.', 55, null, 'Low'),
  (6, 'Low Impact HIIT', 14, 'Intermediate', 140, 3, '⚡', '#F97316', '#EF4444', 'Short bursts of energy without the joint strain.', null, 55, 'High'),
  (7, 'Resistance Band Flow', 22, 'Intermediate', 160, 4, '🎯', '#34D399', '#10B981', 'Strengthen major muscle groups with gentle resistance.', null, null, 'Medium'),
  (8, 'Evening Stretch Reset', 10, 'Beginner', 35, 5, '🌙', '#A78BFA', '#818CF8', 'Wind down with soothing stretches and breath work.', null, null, 'Low')
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
  intensity = excluded.intensity;

-- Seed the exercises that make up each workout session.
insert into public.workout_exercises
  (workout_id, name, sets, reps, points, sort_order, pose_class, feedback_prompt)
values
  (1, 'Breathing Reset', 1, 5, 20, 10, 'standing', 'Relax your shoulders and keep breathing steadily.'),
  (1, 'Standing Forward Fold', 2, 6, 35, 20, 'stretch', 'Hinge gently and keep your knees soft.'),
  (1, 'Seated Twist', 2, 8, 35, 30, 'seated', 'Rotate slowly and keep your spine tall.'),
  (2, 'Seated Marches', 3, 10, 45, 10, 'seated', 'Lift one knee at a time and sit tall.'),
  (2, 'Chair Arm Raises', 2, 12, 35, 20, 'arm-raise', 'Keep your shoulders relaxed as your arms rise.'),
  (2, 'Ankle Circles', 2, 10, 20, 30, 'seated', 'Move smoothly and avoid locking your knees.'),
  (3, 'Walk In Place', 3, 20, 50, 10, 'standing', 'Land softly and keep your chest open.'),
  (3, 'Side Steps', 3, 12, 45, 20, 'standing', 'Step wide enough to feel balanced.'),
  (3, 'Heel Digs', 2, 16, 35, 30, 'standing', 'Point your toes upward and move with control.'),
  (4, 'Squats', 3, 10, 50, 10, 'squat', 'Keep knees aligned with toes.'),
  (4, 'Wall Push-ups', 3, 8, 40, 20, 'pushup', 'Keep your body long from shoulders to heels.'),
  (4, 'Arm Circles', 2, 15, 30, 30, 'arm-raise', 'Small controlled circles, shoulders down.'),
  (4, 'Leg Raises', 3, 10, 50, 40, 'side-leg-lift', 'Brace your core before lifting.'),
  (4, 'Cool Down Stretch', 1, 1, 30, 50, 'stretch', 'Slow your breathing and ease into the stretch.'),
  (5, 'Tandem Stand', 3, 8, 35, 10, 'standing', 'Use a wall or chair nearby for confidence.'),
  (5, 'Side Leg Lifts', 2, 10, 35, 20, 'side-leg-lift', 'Lift only as high as you can stay stable.'),
  (5, 'Heel-to-Toe Walk', 2, 12, 30, 30, 'standing', 'Move slowly and keep your gaze forward.'),
  (6, 'Low Jacks', 3, 12, 50, 10, 'standing', 'Step out instead of jumping.'),
  (6, 'Fast Marches', 3, 18, 55, 20, 'standing', 'Drive your arms and stay light on your feet.'),
  (6, 'Squat Reach', 2, 10, 35, 30, 'squat', 'Reach tall after each controlled squat.'),
  (7, 'Band Rows', 3, 12, 55, 10, 'standing', 'Pull elbows back without shrugging.'),
  (7, 'Band Press', 3, 10, 50, 20, 'arm-raise', 'Press forward with steady wrists.'),
  (7, 'Band Good Morning', 2, 10, 45, 30, 'stretch', 'Hinge at the hips and keep your back neutral.'),
  (8, 'Neck Release', 1, 6, 15, 10, 'standing', 'Move slowly and avoid forcing range.'),
  (8, 'Hamstring Stretch', 2, 6, 20, 20, 'stretch', 'Keep the stretch gentle and even.'),
  (8, 'Child Pose Breathing', 1, 5, 20, 30, 'stretch', 'Let each breath soften your back.')
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
  (1, 'standing', array[174,174,176,176,170,170,84,1.75,0.26,0.22]::double precision[]),
  (2, 'standing', array[168,170,172,174,165,166,88,1.65,0.31,0.28]::double precision[]),
  (3, 'seated', array[145,148,91,94,86,89,82,1.05,0.24,0.58]::double precision[]),
  (4, 'seated', array[132,136,104,108,91,95,77,0.98,0.33,0.62]::double precision[]),
  (5, 'squat', array[166,165,82,84,72,74,65,1.12,0.30,0.55]::double precision[]),
  (6, 'squat', array[158,160,96,93,83,82,68,1.20,0.28,0.48]::double precision[]),
  (7, 'pushup', array[105,108,162,160,174,172,20,0.38,0.62,0.26]::double precision[]),
  (8, 'pushup', array[82,86,166,164,172,173,16,0.34,0.70,0.25]::double precision[]),
  (9, 'situp', array[152,150,94,96,95,98,32,0.72,0.45,0.52]::double precision[]),
  (10, 'situp', array[165,166,78,80,82,84,24,0.65,0.48,0.58]::double precision[]),
  (11, 'arm-raise', array[166,168,172,174,166,168,84,1.68,0.78,0.24]::double precision[]),
  (12, 'arm-raise', array[112,118,170,172,164,166,80,1.58,0.72,0.27]::double precision[]),
  (13, 'side-leg-lift', array[168,170,112,170,94,166,70,1.45,0.34,0.72]::double precision[]),
  (14, 'side-leg-lift', array[170,168,170,116,166,96,70,1.45,0.34,0.72]::double precision[]),
  (15, 'stretch', array[172,172,158,160,82,84,42,1.02,0.40,0.46]::double precision[]),
  (16, 'stretch', array[160,158,150,148,72,74,35,0.92,0.44,0.50]::double precision[])
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

-- Seed selectable answers for onboarding profile setup.
insert into public.onboarding_choices (field_name, label, sort_order) values
  ('fitness_level', 'Beginner', 10),
  ('fitness_level', 'Intermediate', 20),
  ('fitness_level', 'Advanced', 30),
  ('fitness_level', 'Low Impact', 40),
  ('preferred_intensity', 'Low', 10),
  ('preferred_intensity', 'Medium', 20),
  ('preferred_intensity', 'High', 30)
on conflict (field_name, label) do update set sort_order = excluded.sort_order;

-- Seed medical options used to personalize recommendations safely.
insert into public.medical_condition_options (id, category, label, sort_order) values
  (1, 'General', 'None', 10),
  (2, 'Mobility & Joint', 'Knee pain', 20),
  (3, 'Mobility & Joint', 'Back pain', 30),
  (4, 'Mobility & Joint', 'Arthritis', 40),
  (5, 'Mobility & Joint', 'Balance concerns', 50),
  (6, 'Cardiovascular & Metabolic', 'Hypertension', 60),
  (7, 'Cardiovascular & Metabolic', 'Diabetes', 70),
  (8, 'Respiratory', 'Asthma', 80),
  (9, 'Respiratory', 'Breathing difficulty', 90),
  (10, 'Other', 'Recent injury', 100)
on conflict (id) do update set
  category = excluded.category,
  label = excluded.label,
  sort_order = excluded.sort_order;

-- Seed profile goal chips shown on the Profile screen.
insert into public.profile_goals (label, sort_order) values
  ('Stay Active', 10),
  ('Build Strength', 20),
  ('Improve Flexibility', 30)
on conflict (label) do update set sort_order = excluded.sort_order;

-- Seed the default quick-workout target so quick start is database configurable.
insert into public.app_settings (key, value) values
  ('default_workout_id', '{"workout_id": 4}'::jsonb),
  ('dashboard_settings', '{"goal_label": "30 min"}'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Seed reusable Profile and legal information pages.
insert into public.info_pages (action_key, title, icon, body, sort_order) values
  ('settings', 'Account Settings', 'settings', 'Supabase Auth will manage email, password, and account security here. Local prototype data is currently stored on this device when Supabase Auth is not configured.', 10),
  ('notifications', 'Notifications', 'bell', 'Workout reminders, streak prompts, and reward updates will be configured here. Notification preferences will become database-backed user settings.', 20),
  ('support', 'Help & Support', 'help-circle', 'For the prototype, support content explains how ActiveSense uses local pose estimation, Healthpoints, and tailored workouts. A future support center can connect FAQs and contact forms.', 30),
  ('privacy', 'Privacy Settings', 'shield', 'ActiveSense processes camera frames locally for pose landmarks. Raw workout video is not uploaded in this prototype; Supabase should store profile, workout, reward, and landmark summary metadata only.', 40),
  ('profile_photo', 'Profile Photo', 'camera', 'Profile photo upload will connect to Supabase Storage. The camera used during workouts remains separate and is used for local pose landmarks.', 50),
  ('terms', 'Terms', 'file-text', 'Prototype terms: ActiveSense is an educational NUS Orbital prototype and should not replace professional medical advice. Stop exercising if you feel pain, dizziness, or discomfort.', 60),
  ('contact', 'Contact', 'mail', 'Contact and feedback forms will be connected when backend messaging is added. For now, this page confirms the link is wired.', 70)
on conflict (action_key) do update set
  title = excluded.title,
  icon = excluded.icon,
  body = excluded.body,
  sort_order = excluded.sort_order;

-- Seed settings-style rows shown in the Profile menu.
insert into public.profile_menu_items (id, icon, label, badge, action_key, color, sort_order) values
  (1, 'settings', 'Account Settings', null, 'settings', '#14B8A6', 10),
  (2, 'bell', 'Notifications', '3', 'notifications', '#14B8A6', 20),
  (3, 'help-circle', 'Help & Support', null, 'support', '#14B8A6', 30),
  (4, 'shield', 'Privacy Settings', null, 'privacy', '#14B8A6', 40),
  (5, 'log-out', 'Log Out', null, 'logout', '#EF4444', 50)
on conflict (id) do update set
  icon = excluded.icon,
  label = excluded.label,
  badge = excluded.badge,
  action_key = excluded.action_key,
  color = excluded.color,
  sort_order = excluded.sort_order;

select setval(pg_get_serial_sequence('public.profile_menu_items', 'id'), (select max(id) from public.profile_menu_items));
