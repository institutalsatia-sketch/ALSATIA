/**
 * CRM INSTITUT ALSATIA - LOGIQUE INTEGRALE v4.0
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// EXPOSITION DES FONCTIONS POUR LE HTML
window.switchTab = switchTab;
window.openDonorFile = openDonorFile;
window.filterDonors = filterDonors;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.saveDonorChanges = saveDonorChanges;
window.addDonationUI = addDonationUI;
window.submitDonation = submitDonation;
window.addNote = addNote;
window.deleteNote = deleteNote;
window.deleteDonation = deleteDonation;
window.deleteFullDonor = deleteFullDonor;
window.updateReceipt = updateReceipt;
window.exportDonorExcel = exportDonorExcel;
window.exportGlobalExcel = exportGlobalExcel;
window.closeModal = closeModal;
window.closeConfirm = closeConfirm;
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadAllData();
}

async function loadAllData() {
    if (currentUser.portal === 'Institut Alsatia') await loadDonors();
}

// --- UI : TOASTS & CONFIRM ---
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

function customConfirm(message, onConfirm) {
    document.getElementById('confirm-msg').innerText = message;
    document.getElementById('confirm-modal').style.display = 'flex';
    document.getElementById('confirm-yes').onclick = () => { onConfirm(); closeConfirm(); };
}
function closeConfirm() { document.getElementById('confirm-modal').style.display = 'none'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- CRM LOGIQUE ---
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => `
        <tr>
            <td><strong>${(d.last_name || '').toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td><small>${d.entities}</small></td>
            <td class="gold-text">${d.donations.reduce((s,n)=>s+Number(n.amount),0)} €</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Détails</button></td>
        </tr>
    `).join('');
}

function filterDonors() {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name || "").toLowerCase().includes(val) || 
        (d.first_name || "").toLowerCase().includes(val)
    );
    renderDonorsTable(filtered);
}

// --- FICHE DETAILLEE ---
async function openDonorFile(donorId) {
    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    document.getElementById('donor-modal').style.display = 'block';
    
    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <h2>${donor.last_name.toUpperCase()} ${donor.first_name || ''}</h2>
                <button onclick="closeModal('donor-modal')" class="btn-sm">X</button>
            </header>
            <div class="grid-2">
                <div class="card-inner">
                    <label>Prénom / Nom</label>
                    <div style="display:flex; gap:5px;"><input type="text" id="e-fname" value="${donor.first_name || ''}" class="luxe-input"><input type="text" id="e-lname" value="${donor.last_name || ''}" class="luxe-input"></div>
                    <label>Email</label><input type="email" id="e-mail" value="${donor.email || ''}" class="luxe-input">
                    <label>Ville</label><input type="text" id="e-city" value="${donor.city || ''}" class="luxe-input">
                </div>
                <div class="card-inner">
                    <label>Entité Principale</label>
                    <select id="e-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}" ${donor.entities === e ? 'selected' : ''}>${e}</option>`).join('')}</select>
                    <label>Lien / Introduit par</label><input type="text" id="e-link" value="${donor.next_action || ''}" class="luxe-input">
                </div>
            </div>
            <div class="card-inner full-width" style="margin-top:15px;">
                <h3>Notes</h3>
                <div class="notes-list">${notes.map(n => `<div class="note-row"><span>${n.author_name}: ${n.content}</span><button onclick="deleteNote('${n.id}','${donor.id}')" class="btn-icon">🗑️</button></div>`).join('')}</div>
                <div style="display:flex; gap:10px;"><input type="text" id="n-txt" class="luxe-input" placeholder="Ajouter note..."><button onclick="addNote('${donor.id}')" class="btn-save">OK</button></div>
            </div>
            <div class="card-inner full-width" style="margin-top:15px;">
                <h3>Dons</h3>
                <table class="luxe-table">
                    ${donations.map(d => `<tr><td>${d.date}</td><td>${d.amount}€</td><td><input type="text" value="${d.tax_receipt_id || ''}" onchange="updateReceipt('${d.id}', this.value)" class="table-input"></td><td><button onclick="deleteDonation('${d.id}','${donor.id}')" class="btn-icon">🗑️</button></td></tr>`).join('')}
                </table>
                <button onclick="addDonationUI('${donor.id}')" class="btn-outline-gold">+ Ajouter Don</button>
            </div>
            <div class="modal-footer" style="margin-top:20px;">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save" style="width:100%">Sauvegarder</button>
                <button onclick="deleteFullDonor('${donor.id}')" class="btn-sm-danger" style="margin-top:10px; width:100%">Supprimer le dossier</button>
            </div>
        </div>
    `;
}

// --- ACTIONS ---
async function addNote(donorId) {
    const val = document.getElementById('n-txt').value;
    if(!val) return;
    await supabaseClient.from('messages').insert([{ donor_id: donorId, content: val, author_name: currentUser.first_name, private: true }]);
    openDonorFile(donorId);
}

async function saveDonorChanges(id) {
    const up = {
        first_name: document.getElementById('e-fname').value,
        last_name: document.getElementById('e-lname').value,
        email: document.getElementById('e-mail').value,
        city: document.getElementById('e-city').value,
        entities: document.getElementById('e-ent').value,
        next_action: document.getElementById('e-link').value
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    showNotify("Enregistré");
    loadDonors();
    closeModal('donor-modal');
}

async function deleteFullDonor(id) {
    customConfirm("Supprimer TOUT le dossier ?", async () => {
        await supabaseClient.from('donations').delete().eq('donor_id', id);
        await supabaseClient.from('donors').delete().eq('id', id);
        showNotify("Supprimé");
        closeModal('donor-modal');
        loadDonors();
    });
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
}
