// Configuration Supabase pour l'Institut Alsatia
const SUPABASE_URL = 'https://ptiosrmpliffsjooedle.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o'; // Remplacez par votre clé anon

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Protection des pages : Redirige si non connecté
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'index.html';
    }
    return user;
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}
