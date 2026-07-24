# ActiveSense Supabase Setup

<!-- This file explains how local SQL becomes real Supabase tables. -->

The SQL files in this folder are the source of truth for the production-ready prototype database. They must be run against the Supabase project's Postgres database.

## What The Schema Contains

The schema keeps the model intentionally small and relational:

- `exercise_types`: allowed pose-tracked movements. Currently `squat`, `pushup`, and `lunge`.
- `workout_categories`, `workouts`, `workout_exercises`: strength workout catalog.
- `pose_training_samples`: classifier examples linked to `exercise_types`.
- `user_profiles`, `user_profile_medical_conditions`, `user_stats`, `workout_sessions`, `workout_session_exercise_results`: normalized user profile, health constraints, progress, and future per-exercise analytics.
- `reward_vouchers`, `voucher_redemptions`, `achievements`: Healthpoints rewards and milestones.
- `app_option_groups`, `app_options`, `app_settings`, `app_pages`: configurable app copy/options without many tiny tables.

The seed file inserts the current strength-only catalog and deactivates older workout rows without deleting historical session records.

## Create And Populate Supabase

1. Create a Supabase project at `https://supabase.com`.

2. Copy the direct database URL from Supabase:

   `Project Settings > Database > Connection string > URI`

3. Put that URL in your shell:

   ```sh
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
   ```

4. Run the schema and seed data from the app folder:

   ```sh
   cd /Users/yixun/Desktop/POC/ActiveSense/ActiveSense
   npm run db:setup
   ```

If `psql` is not installed, install PostgreSQL locally or paste `schema.sql` then `seed.sql` into Supabase SQL Editor and run them in that order.

5. Verify the app can read catalog data, register a user, save profile choices, link medical conditions, and complete a workout:

   ```sh
   npm run db:verify
   ```

   To also verify that deleting a Supabase Auth user cascades through all user-owned public rows, put a local-only service-role key in `.env`:

   ```sh
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

   Never use the service-role key in an `EXPO_PUBLIC_` variable or commit it to Git.

## Link The App

1. Copy the mobile env file:

   ```sh
   cp .env.example .env
   ```

2. Fill these values from Supabase:

   ```sh
   EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-or-publishable-key>
   ```

Use the anon or publishable key only. Never put the service-role key or an `sb_secret_...` key in Expo public env vars.

3. Restart Expo after changing `.env`:

   ```sh
   npx expo start --clear
   ```

For an existing Supabase database that already has earlier prototype tables, apply the new schema in a fresh Supabase project or migrate those rows deliberately before running the seed file. The seed keeps workout history safe by deactivating old workout catalog rows instead of deleting session data.
