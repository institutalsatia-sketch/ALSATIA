// Configuration Supabase pour l'Institut Alsatia
const SUPABASE_URL = 'https://ptiosrmpliffsjooedle.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';

// Initialisation du client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Protection des pages : Redirige si non connecté
async function checkAuth() {
    const { data, error } = await supabaseClient.auth.getSession();
    
    // Si pas de session ou erreur, on redirige vers le login
    if (error || !data.session) {
        // On évite la boucle de redirection si on est déjà sur index.html
        if (!window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
        }
        return null;
    }
    
    return data.session.user;
}

// Fonction de déconnexion
async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}
