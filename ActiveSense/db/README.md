# ActiveSense Supabase Setup

<!-- This file explains how local SQL becomes real Supabase tables. -->

The SQL files in this folder do not create tables by themselves. They must be run against the Supabase project's Postgres database.

1. Put the direct Postgres connection string in your shell:

   ```sh
   export SUPABASE_DB_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
   ```

2. Run the schema and seed data:

   ```sh
   npm run db:setup
   ```

3. Add mobile-safe Expo env vars:

   ```sh
   cp .env.example .env
   ```

Use the anon or publishable key in `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never put the service-role key or an `sb_secret_...` key in Expo public env vars.
