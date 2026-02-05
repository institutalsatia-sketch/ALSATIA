/**
 * CRM INSTITUT ALSATIA - LOGIQUE INTEGRALE RECTIFIÉE
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// --- 1. FONCTIONS DE NAVIGATION ET UI (DÉCLARÉES EN PREMIER) ---

window.logout = function() {
    localStorage.clear();
    window.location.href = 'login.html';
};

window.switchTab = function(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${id}`);
    const targetNav = document.getElementById(`nav-${id}`);
    if(targetTab) targetTab.classList.add('active');
    if(targetNav) targetNav.classList.add('active');
};

window.closeModal = function(id) {
    document.getElementById(id).style.display = 'none';
};

window.closeConfirm = function() {
    document.getElementById('confirm-modal').style.display = 'none';
};

function showNotify(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// --- 2. GESTION DES DONATEURS ---

window.openNewDonorModal = function() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h3 class="gold-title">Nouveau Donateur</h3>
            <label>Prénom</label><input type="text" id="n-fname" class="luxe-input">
            <label>Nom</label><input type="text" id="n-lname" class="luxe-input">
            <label>Entité</label>
            <select id="n-ent" class="luxe-input">
                ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:10px;">Créer la fiche</button>
            <button onclick="closeModal('donor-modal')" class="btn-outline" style="width:100%; margin-top:5px;">Annuler</button>
        </div>
    `;
};

window.handleNewDonor = async function() {
    const fn = document.getElementById('n-fname').value;
    const ln = document.getElementById('n-lname').value;
    const ent = document.getElementById('n-ent').value;

    if(!ln) { showNotify("Le nom est requis", "error"); return; }

    const { error } = await supabaseClient.from('donors').insert([{
        first_name: fn,
        last_name: ln,
        entities: ent,
        last_modified_by: currentUser ? currentUser.last_name : "Inconnu"
    }]);

    if(error) showNotify("Erreur BDD", "error");
    else {
        showNotify("Donateur créé");
        closeModal('donor-modal');
        loadDonors();
    }
};

window.filterDonors = function() {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name || "").toLowerCase().includes(val) || 
        (d.first_name || "").toLowerCase().includes(val)
    );
    renderDonorsTable(filtered);
};

async function loadDonors() {
    const { data, error } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    if(error) { console.error(error); return; }
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    list.innerHTML = data.map(d => `
        <tr>
            <td><strong>${(d.last_name || '').toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td><small>${d.entities || ''}</small></td>
            <td class="gold-text">${(d.donations || []).reduce((s,n)=>s+Number(n.amount),0)} €</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Détails</button></td>
        </tr>
    `).join('');
}

window.openDonorFile = async function(donorId) {
    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    document.getElementById('donor-modal').style.display = 'flex';
    
    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <h2>${donor.last_name.toUpperCase()}</h2>
                <button onclick="closeModal('donor-modal')" class="btn-icon">✖</button>
            </header>
            <div class="card-inner">
                <label>Email</label><input type="text" id="e-mail" value="${donor.email || ''}" class="luxe-input">
                <label>Ville</label><input type="text" id="e-city" value="${donor.city || ''}" class="luxe-input">
            </div>
            <div class="card-inner" style="margin-top:10px;">
                <h3>Notes</h3>
                <div class="notes-list">${notes.map(n => `<div class="note-row">${n.author_name}: ${n.content}</div>`).join('')}</div>
                <div style="display:flex; gap:5px;"><input type="text" id="n-txt" class="luxe-input"><button onclick="addNote('${donor.id}')" class="btn-save">Add</button></div>
            </div>
            <button onclick="saveDonorChanges('${donor.id}')" class="btn-save" style="width:100%; margin-top:15px;">Enregistrer</button>
        </div>
    `;
};

window.addNote = async function(donorId) {
    const val = document.getElementById('n-txt').value;
    if(!val) return;
    await supabaseClient.from('messages').insert([{ donor_id: donorId, content: val, author_name: currentUser.first_name }]);
    openDonorFile(donorId);
};

window.saveDonorChanges = async function(id) {
    const up = {
        email: document.getElementById('e-mail').value,
        city: document.getElementById('e-city').value
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    showNotify("Sauvegardé");
    loadDonors();
    closeModal('donor-modal');
};

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadDonors();
});
