// --- 1. CONFIGURATION ET VARIABLES ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonors = [];

// --- 2. FONCTIONS DE CHARGEMENT (DÉFINITIONS) ---

// Charger le Dashboard
async function loadDashboard() {
    console.log("Chargement du Dashboard...");
    const feedDons = document.getElementById('urgent-donations-feed');
    if (!feedDons) return;

    const { data, error } = await supabaseClient
        .from('donations')
        .select('*, donors(last_name)')
        .eq('thank_you_status', 'En attente')
        .limit(5);

    if (error) {
        feedDons.innerHTML = "Erreur de chargement des dons.";
        return;
    }

    feedDons.innerHTML = data.length > 0 ? data.map(d => `
        <div class="donation-item">
            <strong>${d.donors?.last_name || 'Inconnu'}</strong> : ${d.amount} €
            <button onclick="openDonorFile('${d.donor_id}')" class="btn-primary" style="font-size:0.6rem; float:right;">Voir</button>
        </div>
    `).join('') : "Aucun don en attente.";
}

// Charger les Donateurs
async function loadDonors() {
    console.log("Chargement des Donateurs...");
    let query = supabaseClient.from('donors').select('*, donations(*)');

    if (currentUser.portal !== 'Institut Alsatia') {
        const schoolKeyword = currentUser.portal.split(' ')[1];
        query = query.ilike('entities', `%${schoolKeyword}%`);
    }

    const { data, error } = await query.order('last_name');
    if (!error) {
        allDonors = data;
        renderDonors(data);
    }
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    list.innerHTML = data.map(d => {
        const total = d.donations ? d.donations.reduce((sum, don) => sum + Number(don.amount), 0) : 0;
        return `
            <tr>
                <td><strong>${d.last_name}</strong> ${d.first_name || ''}</td>
                <td><small>${d.entities || ''}</small></td>
                <td>${total} €</td>
                <td><span class="status-tag">${d.next_action || 'Aucune'}</span></td>
                <td><button onclick="openDonorFile('${d.id}')" class="btn-primary" style="font-size:0.7rem;">Ouvrir</button></td>
            </tr>
        `;
    }).join('');
}

// Charger les Événements
async function loadEvents() {
    const { data } = await supabaseClient.from('events').select('*').order('event_date', { ascending: true });
    const container = document.getElementById('events-container');
    if(!container) return;
    container.innerHTML = data ? data.map(ev => `
        <div class="card">
            <small style="color:var(--gold)">${new Date(ev.event_date).toLocaleDateString()}</small>
            <h4>${ev.title}</h4>
            <p>${ev.description || ''}</p>
        </div>
    `).join('') : "Aucun événement.";
}

// --- 3. ACTIONS ET MODALES ---

function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = `
        <h3>Nouveau Donateur</h3>
        <form onsubmit="handleNewDonor(event)">
            <label>Type</label>
            <select id="new-type" class="luxe-input"><option>Particulier</option><option>Entreprise</option></select>
            <input type="text" id="new-lname" placeholder="Nom / Raison Sociale" class="luxe-input" required>
            <input type="text" id="new-fname" placeholder="Prénom" class="luxe-input">
            <input type="text" id="new-entities" placeholder="Entités (ex: Herrade, Institut)" class="luxe-input" value="${currentUser.portal}">
            <button type="submit" class="btn-primary" style="width:100%">Créer le dossier</button>
        </form>
    `;
}

async function handleNewDonor(e) {
    e.preventDefault();
    const newDonor = {
        donor_type: document.getElementById('new-type').value,
        last_name: document.getElementById('new-lname').value,
        first_name: document.getElementById('new-fname').value,
        entities: document.getElementById('new-entities').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('donors').insert([newDonor]);
    if (!error) {
        closeModal('donor-modal');
        loadDonors();
        showToast("Donateur créé !");
    }
}

async function openDonorFile(donorId) {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    content.innerHTML = "Chargement...";

    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();

    content.innerHTML = `
        <h2>${donor.last_name}</h2>
        <p>Type: ${donor.donor_type} | Entités: ${donor.entities}</p>
        <hr style="margin:20px 0;">
        <div class="grid-2">
            <div>
                <h3>Dons</h3>
                <input type="number" id="new-don-amount" placeholder="Montant €" class="luxe-input">
                <button onclick="addDonation('${donor.id}')" class="btn-primary">Ajouter Don</button>
            </div>
            <div>
                <h3>Notes internes</h3>
                <div style="height:150px; overflow-y:auto; background:#f8fafc; padding:10px; margin-bottom:10px;">
                    ${donor.messages?.map(m => `<p><strong>${m.author_name}:</strong> ${m.content}</p>`).join('') || 'Aucune note.'}
                </div>
                <input type="text" id="donor-chat-input" placeholder="Ajouter une note..." class="luxe-input">
                <button onclick="sendDonorMessage('${donor.id}')" class="btn-primary">Publier</button>
            </div>
        </div>
    `;
}

// --- 4. NAVIGATION ET INITIALISATION ---

async function loadAllData() {
    // On appelle les fonctions DÉJÀ définies plus haut
    await loadDonors();
    await loadDashboard();
    await loadEvents();
}

async function init() {
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    await loadAllData();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
}

// --- UTILITAIRES ---
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(msg) {
    const t = document.getElementById('toast-notification');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// DÉMARRAGE DU SCRIPT
window.onload = init;
