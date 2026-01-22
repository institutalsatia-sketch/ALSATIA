// CONFIGURATION SUPABASE
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentProfile = null;

// ==========================================
// 1. INITIALISATION & CONNEXION
// ==========================================

async function init() {
    // Vérifier si l'utilisateur est connecté
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError || !session) {
        console.log("Pas de session, redirection vers login");
        window.location.href = 'login.html';
        return;
    }

    const user = session.user;
    console.log("Utilisateur connecté:", user.email);

    // Charger le profil public
    const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
    if (profileError) {
        console.error("Erreur profil:", profileError);
        document.getElementById('user-name').innerText = user.email;
    } else {
        currentProfile = profile;
        document.getElementById('user-name').innerText = `${profile.first_name} ${profile.last_name} (${profile.role})`;
    }

    // Charger les données du tableau de bord
    loadDashboard();
}

// ==========================================
// 2. DASHBOARD DES URGENCES
// ==========================================

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    feed.innerHTML = '<p>Recherche d\'alertes en cours...</p>';

    // Récupérer les commentaires marqués comme urgents
    const { data, error } = await supabaseClient
        .from('comments')
        .select(`*, donors(last_name, first_name)`)
        .eq('is_urgent', true)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erreur dashboard:", error);
        feed.innerHTML = '<p>Erreur lors du chargement des données.</p>';
        return;
    }

    feed.innerHTML = '';
    if (!data || data.length === 0) {
        feed.innerHTML = `
            <div class="urgent-card" style="border-color: #27ae60; grid-column: 1/-1; text-align: center;">
                <h3>Tout est sous contrôle</h3>
                <p>Aucune alerte urgente n'est signalée pour le moment.</p>
            </div>`;
        return;
    }

    data.forEach(msg => {
        const entityClass = msg.entity ? msg.entity.toLowerCase().split(' ')[0] : 'alsatia';
        const card = document.createElement('div');
        card.className = `urgent-card ${entityClass}`;
        card.innerHTML = `
            <h3>${msg.donors ? msg.donors.last_name : 'Donateur'}</h3>
            <p>"${msg.content}"</p>
            <div class="card-footer">
                <small>Par ${msg.entity} - ${new Date(msg.created_at).toLocaleDateString()}</small>
                <button onclick="resolveUrgency('${msg.id}')" class="btn-resolved">✓ Terminer</button>
            </div>
        `;
        feed.appendChild(card);
    });
}

// ==========================================
// 3. FONCTIONS UTILITAIRES
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if(tabName === 'dashboard') loadDashboard();
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// Lancement au chargement de la page
window.onload = init;
