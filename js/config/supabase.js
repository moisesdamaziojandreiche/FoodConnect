import{createClient}from'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const supabaseUrl='SUA_URL_SUPABASE';
const supabaseAnonKey='SUA_CHAVE_PUBLICA_SUPABASE';
export const supabase=createClient(supabaseUrl,supabaseAnonKey);
