// CONFIGURATION SUPABASE (À compléter avec vos accès)
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentProfile = null;

// ==========================================
// 1. INITIALISATION & CONNEXION
// ==========================================

async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html'; // Rediriger si non connecté
        return;
    }
    currentUser = session.user;
    await loadProfile();
    setupUIByRole();
    loadDashboard();
}

async function loadProfile() {
    const { data, error } = await supabase
        .from('profiles')
        .where('id', '==', currentUser.id)
        .single();
    
    if (data) {
        currentProfile = data;
        document.getElementById('user-name').innerText = `${data.first_name} (${data.role})`;
    }
}

// ==========================================
// 2. DASHBOARD DES URGENCES
// ==========================================

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    feed.innerHTML = '<p>Chargement des alertes...</p>';

    // Requête filtrée par RLS (les admins voient tout, les autres leur entité)
    let query = supabase
        .from('comments')
        .select(`*, donors(last_name, first_name)`)
        .eq('is_urgent', true)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

    const { data, error } = await query;

    feed.innerHTML = '';
    if (data.length === 0) {
        feed.innerHTML = '<p>Aucune urgence en cours. Tout est sous contrôle.</p>';
        return;
    }

    data.forEach(msg => {
        const entityClass = msg.entity.toLowerCase().split(' ')[0]; // alsatia, herrade, martin...
        const card = document.createElement('div');
        card.className = `urgent-card ${entityClass}`;
        card.innerHTML = `
            <h3>${msg.donors.last_name} ${msg.donors.first_name}</h3>
            <p>"${msg.content}"</p>
            <div class="card-footer">
                <small>Par ${msg.entity} - ${new Date(msg.created_at).toLocaleDateString()}</small>
                <button onclick="resolveUrgency('${msg.id}')" class="btn-resolved">✓ Terminer</button>
            </div>
        `;
        feed.appendChild(card);
    });
}

async function resolveUrgency(commentId) {
    const { error } = await supabase
        .from('comments')
        .update({ status: 'resolved' })
        .eq('id', commentId);
    
    if (!error) loadDashboard();
}

// ==========================================
// 3. AGENDA PARTAGÉ
// ==========================================

async function loadAgenda() {
    const calendar = document.getElementById('calendar-view');
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

    calendar.innerHTML = '<div class="event-list"></div>';
    const list = calendar.querySelector('.event-list');

    data.forEach(event => {
        const entityClass = event.entity.toLowerCase().split(' ')[0];
        const item = document.createElement('div');
        item.className = `event-item ${entityClass}`;
        item.innerHTML = `
            <strong>${new Date(event.start_date).toLocaleDateString()}</strong> - 
            <span>${event.title}</span> 
            <small>(${event.entity})</small>
        `;
        list.appendChild(item);
    });
}

// ==========================================
// 4. NAVIGATION ET UI
// ==========================================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    if(tabName === 'dashboard') loadDashboard();
    if(tabName === 'donors') loadDonors();
    if(tabName === 'agenda') loadAgenda();
}

function setupUIByRole() {
    // Si l'utilisateur est un simple Directeur de Com, on masque certains boutons d'admin
    if (currentProfile.role === 'com') {
        const adminButtons = document.querySelectorAll('.btn-admin-only');
        adminButtons.forEach(btn => btn.style.display = 'none');
    }
}

// Lancement au chargement de la page
window.onload = init;
