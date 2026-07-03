import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Expo only exposes variables prefixed with EXPO_PUBLIC_ to mobile JavaScript.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// This flag lets services fall back gracefully when the app is run before env setup.
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// The mobile app must use the anon key; service-role or secret keys never belong here.
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Centralized guard keeps missing Supabase setup errors consistent and easy to read.
export const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

// Most user-owned mutations need an authenticated Supabase user for RLS to work.
export const getCurrentSupabaseUserId = async () => {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
};

export const signUpWithPassword = async (email: string, password: string, displayName: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        display_name: displayName.trim(),
      },
    },
  });
  if (error) {
    throw error;
  }
  return data;
};

export const signInWithPassword = async (email: string, password: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    throw error;
  }
  return data;
};
