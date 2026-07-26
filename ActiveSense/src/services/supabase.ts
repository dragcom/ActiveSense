import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Expo exposes variables prefixed with EXPO_PUBLIC_ to mobile JavaScript.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Lets services fall back gracefully when run before environment variable setup.
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

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

// Centralized guard keeps missing Supabase setup errors consistent and type-safe.
export const requireSupabase = () => {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
};

export const getCurrentSupabaseUserId = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
};

export const signUpWithPassword = async (email: string, password: string, displayName: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: displayName.trim() },
    },
  });
  if (error) throw error;
  if (!data.session) {
    throw new Error('Please confirm your email address, then log in to finish creating your ActiveSense profile.');
  }
  return data;
};

export const signInWithPassword = async (email: string, password: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
};

// --- In-App Password Update Helper ---
export const updateUserPassword = async (newPassword: string) => {
  const client = requireSupabase();
  const { data, error } = await client.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
};