import { createClient } from '@supabase/supabase-api'

// Ces lignes disent à l'application d'aller chercher 
// les clés dans le "coffre-fort" de GitHub ou dans le fichier de config.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
