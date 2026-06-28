insert into public.workout_categories (id, name, sort_order) values
  (1, 'Beginner', 10),
  (2, 'Senior', 20),
  (3, 'Cardio', 30),
  (4, 'Strength', 40),
  (5, 'Flexibility', 50)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

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

insert into public.workout_exercises
  (workout_id, name, sets, reps, points, sort_order, feedback_prompt)
values
  (1, 'Breathing Reset', 1, 5, 20, 10, 'Relax your shoulders and keep breathing steadily.'),
  (1, 'Standing Forward Fold', 2, 6, 35, 20, 'Hinge gently and keep your knees soft.'),
  (1, 'Seated Twist', 2, 8, 35, 30, 'Rotate slowly and keep your spine tall.'),
  (2, 'Seated Marches', 3, 10, 45, 10, 'Lift one knee at a time and sit tall.'),
  (2, 'Chair Arm Raises', 2, 12, 35, 20, 'Keep your shoulders relaxed as your arms rise.'),
  (2, 'Ankle Circles', 2, 10, 20, 30, 'Move smoothly and avoid locking your knees.'),
  (3, 'Walk In Place', 3, 20, 50, 10, 'Land softly and keep your chest open.'),
  (3, 'Side Steps', 3, 12, 45, 20, 'Step wide enough to feel balanced.'),
  (3, 'Heel Digs', 2, 16, 35, 30, 'Point your toes upward and move with control.'),
  (4, 'Squats', 3, 10, 50, 10, 'Keep knees aligned with toes.'),
  (4, 'Wall Push-ups', 3, 8, 40, 20, 'Keep your body long from shoulders to heels.'),
  (4, 'Arm Circles', 2, 15, 30, 30, 'Small controlled circles, shoulders down.'),
  (4, 'Leg Raises', 3, 10, 50, 40, 'Brace your core before lifting.'),
  (4, 'Cool Down Stretch', 1, 1, 30, 50, 'Slow your breathing and ease into the stretch.'),
  (5, 'Tandem Stand', 3, 8, 35, 10, 'Use a wall or chair nearby for confidence.'),
  (5, 'Side Leg Lifts', 2, 10, 35, 20, 'Lift only as high as you can stay stable.'),
  (5, 'Heel-to-Toe Walk', 2, 12, 30, 30, 'Move slowly and keep your gaze forward.'),
  (6, 'Low Jacks', 3, 12, 50, 10, 'Step out instead of jumping.'),
  (6, 'Fast Marches', 3, 18, 55, 20, 'Drive your arms and stay light on your feet.'),
  (6, 'Squat Reach', 2, 10, 35, 30, 'Reach tall after each controlled squat.'),
  (7, 'Band Rows', 3, 12, 55, 10, 'Pull elbows back without shrugging.'),
  (7, 'Band Press', 3, 10, 50, 20, 'Press forward with steady wrists.'),
  (7, 'Band Good Morning', 2, 10, 45, 30, 'Hinge at the hips and keep your back neutral.'),
  (8, 'Neck Release', 1, 6, 15, 10, 'Move slowly and avoid forcing range.'),
  (8, 'Hamstring Stretch', 2, 6, 20, 20, 'Keep the stretch gentle and even.'),
  (8, 'Child Pose Breathing', 1, 5, 20, 30, 'Let each breath soften your back.')
on conflict (workout_id, sort_order) do update set
  name = excluded.name,
  sets = excluded.sets,
  reps = excluded.reps,
  points = excluded.points,
  target_landmarks = excluded.target_landmarks,
  feedback_prompt = excluded.feedback_prompt;

insert into public.reward_vouchers (id, name, points, emoji, category) values
  (1, 'FairPrice $5 Voucher', 500, '🛒', 'Groceries'),
  (2, 'GrabFood $10 Voucher', 1000, '🍔', 'Food'),
  (3, 'Guardian $5 Voucher', 500, '💊', 'Health'),
  (4, 'Decathlon $15 Voucher', 1500, '⚽', 'Sports')
on conflict (id) do update set name = excluded.name, points = excluded.points, emoji = excluded.emoji, category = excluded.category;

insert into public.achievements (id, title, emoji, description, requirement_type, requirement_value, sort_order) values
  (1, '7-Day Streak', '🔥', 'Complete 7 days in a row', 'streak_days', 7, 10),
  (2, 'First Workout', '🎯', 'Finish your first session', 'total_workouts', 1, 20),
  (3, '1000 Points', '💯', 'Earn 1000 Healthpoints', 'healthpoints', 1000, 30),
  (4, '30-Day Streak', '🏆', 'Complete 30 consecutive days', 'streak_days', 30, 40)
on conflict (id) do update set title = excluded.title, emoji = excluded.emoji, description = excluded.description, requirement_type = excluded.requirement_type, requirement_value = excluded.requirement_value, sort_order = excluded.sort_order;

insert into public.onboarding_choices (field_name, label, sort_order) values
  ('fitness_level', 'Beginner', 10),
  ('fitness_level', 'Intermediate', 20),
  ('fitness_level', 'Advanced', 30),
  ('fitness_level', 'Low Impact', 40),
  ('preferred_intensity', 'Low', 10),
  ('preferred_intensity', 'Medium', 20),
  ('preferred_intensity', 'High', 30)
on conflict (field_name, label) do update set sort_order = excluded.sort_order;

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

insert into public.profile_goals (label, sort_order) values
  ('Stay Active', 10),
  ('Build Strength', 20),
  ('Improve Flexibility', 30)
on conflict (label) do update set sort_order = excluded.sort_order;

insert into public.profile_menu_items (icon, label, badge, action_key, color, sort_order) values
  ('settings', 'Account Settings', null, null, '#14B8A6', 10),
  ('bell', 'Notifications', '3', null, '#14B8A6', 20),
  ('help-circle', 'Help & Support', null, null, '#14B8A6', 30),
  ('shield', 'Privacy Settings', null, null, '#14B8A6', 40),
  ('log-out', 'Log Out', null, 'logout', '#EF4444', 50)
on conflict do nothing;
