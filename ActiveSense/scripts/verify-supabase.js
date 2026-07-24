#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const root = path.resolve(__dirname, '..');

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return Object.fromEntries(
    fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
};

const env = {
  ...readEnvFile(path.join(root, '.env')),
  ...process.env,
};

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.');
}

const createSupabaseClient = (key) =>
  createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

const assertNoError = (label, error) => {
  if (error) {
    throw new Error(`${label}: ${error.code ? `${error.code} ` : ''}${error.message}`);
  }
};

const assert = (label, condition) => {
  if (!condition) {
    throw new Error(label);
  }
};

const tableCount = async (client, table, filterColumn, filterValue) => {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filterColumn) {
    query = query.eq(filterColumn, filterValue);
  }
  const { count, error } = await query;
  assertNoError(`count ${table}`, error);
  return count ?? 0;
};

const main = async () => {
  const anon = createSupabaseClient(anonKey);
  const admin = serviceRoleKey ? createSupabaseClient(serviceRoleKey) : null;
  const testEmail = env.SUPABASE_TEST_EMAIL ?? `activesense.db.test+${Date.now()}@gmail.com`;
  const testPassword = env.SUPABASE_TEST_PASSWORD ?? `ActiveSenseTest-${Date.now()}!`;

  console.log('Checking public catalog tables...');
  const tableChecks = [
    ['exercise_types', 'slug,label'],
    ['workouts', 'id,title,is_active'],
    ['workout_exercises', 'id,workout_id,pose_class'],
    ['app_options', 'id,label'],
    ['reward_vouchers', 'id,name,points'],
  ];
  for (const [table, select] of tableChecks) {
    const { data, error } = await anon.from(table).select(select).limit(3);
    assertNoError(`read ${table}`, error);
    assert(`${table} should have seed rows`, Array.isArray(data) && data.length > 0);
    console.log(`OK ${table}: ${data.length} sample row(s)`);
  }

  const { data: activeWorkouts, error: workoutError } = await anon
    .from('workouts')
    .select('id,title')
    .eq('is_active', true);
  assertNoError('read active workouts', workoutError);
  assert('Only the strength workout should be active', activeWorkouts?.length === 1 && activeWorkouts[0].id === 1);

  const expectedPoseClasses = ['squat', 'pushup', 'lunge'];
  const { data: exerciseTypes, error: exerciseTypeError } = await anon
    .from('exercise_types')
    .select('slug')
    .in('slug', expectedPoseClasses);
  assertNoError('read expected exercise types', exerciseTypeError);
  const existingPoseClasses = new Set((exerciseTypes ?? []).map((row) => row.slug));
  expectedPoseClasses.forEach((slug) => {
    assert(`Missing exercise_types row for ${slug}`, existingPoseClasses.has(slug));
  });

  const { data: workoutExercises, error: workoutExerciseError } = await anon
    .from('workout_exercises')
    .select('pose_class')
    .eq('workout_id', 1);
  assertNoError('read strength workout exercises', workoutExerciseError);
  const workoutPoseClasses = new Set((workoutExercises ?? []).map((row) => row.pose_class));
  expectedPoseClasses.forEach((slug) => {
    assert(`Missing workout_exercises row for ${slug}`, workoutPoseClasses.has(slug));
  });

  console.log('Creating Supabase Auth test user...');
  let userId;
  if (admin) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        display_name: 'ActiveSense DB Test',
      },
    });
    assertNoError('admin create confirmed user', createError);
    userId = created.user?.id;
  } else {
    const { data: signup, error: signupError } = await anon.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'ActiveSense DB Test',
        },
      },
    });
    assertNoError('signup', signupError);
    userId = signup.user?.id;
    assert(
      'Signup requires email confirmation before profile rows can be tested. Set SUPABASE_SERVICE_ROLE_KEY locally for automated verification, or disable email confirmation for a local test run.',
      signup.session,
    );
  }
  assert('Signup did not return a user id', userId);

  const { data: signin, error: signinError } = await anon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  assertNoError('signin after user creation', signinError);
  assert('Signin did not return a session', signin.session);
  const authenticated = anon;
  console.log('Saving profile with Intermediate level and medical conditions...');
  const profilePayload = {
    id: userId,
    display_name: 'ActiveSense DB Test',
    age: 64,
    fitness_level: 'Intermediate',
    preferred_intensity: 'Medium',
    privacy_mode: 'avatar',
    avatar_config: {
      optionId: 'user-avatar',
      label: 'My ActiveSense Avatar',
      avatarUrl: '/avatars/avatar_test.glb',
      accentColor: '#14B8A6',
    },
  };
  const { error: profileError } = await authenticated.from('user_profiles').upsert(profilePayload);
  assertNoError('save user profile', profileError);

  const { data: options, error: optionsError } = await authenticated
    .from('app_options')
    .select('id,label,app_option_groups!inner(group_type)')
    .eq('app_option_groups.group_type', 'medical_condition')
    .in('label', ['Knee pain', 'Back pain']);
  assertNoError('read medical options', optionsError);
  assert('Expected Knee pain and Back pain medical options', options?.length === 2);

  const { error: conditionsError } = await authenticated.from('user_profile_medical_conditions').insert(
    options.map((option) => ({
      profile_id: userId,
      option_id: option.id,
    })),
  );
  assertNoError('save medical condition links', conditionsError);

  const { data: profile, error: profileReadError } = await authenticated
    .from('user_profiles')
    .select('display_name,age,fitness_level,preferred_intensity')
    .eq('id', userId)
    .single();
  assertNoError('read saved profile', profileReadError);
  assert('Profile fitness level was not saved as Intermediate', profile.fitness_level === 'Intermediate');
  assert('Profile intensity was not saved as Medium', profile.preferred_intensity === 'Medium');

  const { data: linkedConditions, error: linkedConditionsError } = await authenticated
    .from('user_profile_medical_conditions')
    .select('app_options(label)')
    .eq('profile_id', userId);
  assertNoError('read linked medical conditions', linkedConditionsError);
  const labels = linkedConditions.map((row) => row.app_options?.label).sort();
  assert('Medical conditions were not linked correctly', labels.join(',') === 'Back pain,Knee pain');

  const { data: statsBefore, error: statsBeforeError } = await authenticated
    .from('user_stats')
    .select('healthpoints,streak_days,total_workouts')
    .eq('user_id', userId)
    .single();
  assertNoError('read initial stats', statsBeforeError);
  assert('Initial stats row was not created by trigger', statsBefore.total_workouts === 0);

  console.log('Testing complete_workout RPC...');
  const { data: updatedStats, error: workoutRpcError } = await authenticated.rpc('complete_workout', {
    p_workout_id: 1,
    p_points_earned: 100,
    p_pose_landmark_count: 33,
    p_client_session_id: `verify-${Date.now()}`,
  });
  assertNoError('complete_workout RPC', workoutRpcError);
  const statsAfter = Array.isArray(updatedStats) ? updatedStats[0] : updatedStats;
  assert('Workout RPC did not increment total workouts', statsAfter.total_workouts === 1);
  assert('Workout RPC did not award Healthpoints', statsAfter.healthpoints === 100);

  if (!admin) {
    console.log('SKIP deletion cascade: set SUPABASE_SERVICE_ROLE_KEY locally to test auth.admin.deleteUser.');
    console.log(`Created test user id: ${userId}`);
    return;
  }

  console.log('Deleting test user through Supabase Admin API and checking cascade...');
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  assertNoError('admin delete user', deleteError);

  const remaining = {
    profiles: await tableCount(admin, 'user_profiles', 'id', userId),
    stats: await tableCount(admin, 'user_stats', 'user_id', userId),
    medicalConditions: await tableCount(admin, 'user_profile_medical_conditions', 'profile_id', userId),
    sessions: await tableCount(admin, 'workout_sessions', 'user_id', userId),
    redemptions: await tableCount(admin, 'voucher_redemptions', 'user_id', userId),
  };
  assert('User-linked rows were not fully deleted', Object.values(remaining).every((count) => count === 0));
  console.log('OK deletion cascade removed all user-linked public rows.');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
