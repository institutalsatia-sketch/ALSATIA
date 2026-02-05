// --- CONFIGURATION ---
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

// LISTE DES ENTITÉS OFFICIELLES
const ENTITIES = [
    "Institut Alsatia",
    "Cours Herrade de Landsberg",
    "Collège Saints Louis et Zélie Martin",
    "Academia Alsatia"
];

// EXPOSITION DES FONCTIONS
window.switchTab = switchTab;
window.openDonorFile = openDonorFile;
window.saveDonorChanges = saveDonorChanges;
window.addDonation = addDonation;
window.submitDonation = submitDonation;
window.addNote = addNote;
window.exportDonorExcel = exportDonorExcel;
window.exportGlobalExcel = exportGlobalExcel;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.closeModal = closeModal;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    
    if (currentUser.portal !== 'Institut Alsatia') {
        const navDonors = document.getElementById('nav-donors');
        if (navDonors) navDonors.style.display = 'none';
    }
    loadAllData();
}

async function loadAllData() {
    if (currentUser.portal === 'Institut Alsatia') await loadDonors();
    loadGlobalChat();
}

// --- 1. CRÉATION AVEC TRAÇABILITÉ ---
function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h3>Nouveau Dossier Donateur</h3>
            <div class="grid-2">
                <input type="text" id="n-fname" placeholder="Prénom" class="luxe-input">
                <input type="text" id="n-lname" placeholder="Nom" class="luxe-input">
            </div>
            <label>Entité principale</label>
            <select id="n-entities" class="luxe-input">
                ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
            <p style="font-size: 0.8rem; color: gray;">Créateur : ${currentUser.first_name} ${currentUser.last_name}</p>
            <button onclick="handleNewDonor()" class="btn-primary" style="width:100%; margin-top:15px;">Créer la fiche</button>
        </div>
    `;
}

async function handleNewDonor() {
    const fname = document.getElementById('n-fname').value;
    const lname = document.getElementById('n-lname').value;
    const entity = document.getElementById('n-entities').value;

    if (!lname) return alert("Le nom est obligatoire");

    const { error } = await supabaseClient.from('donors').insert([{
        first_name: fname,
        last_name: lname,
        entities: entity,
        last_modified_by: `Créé par ${currentUser.first_name} ${currentUser.last_name}` // Traçabilité
    }]);

    if (!error) { closeModal('donor-modal'); loadDonors(); }
}

// --- 2. FICHE DÉTAILLÉE & MODIFICATIONS ---
async function openDonorFile(donorId) {
    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';

    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <h2>${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
                <div class="actions-top">
                    <button onclick="exportDonorExcel('${donor.id}')" class="btn-sm-gold">Excel</button>
                    <button onclick="closeModal('donor-modal')" class="btn-sm">Fermer</button>
                </div>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées & Identité</h3>
                    <input type="text" id="edit-fname" value="${donor.first_name || ''}" class="luxe-input" placeholder="Prénom">
                    <input type="text" id="edit-lname" value="${donor.last_name || ''}" class="luxe-input" placeholder="Nom">
                    <input type="text" id="edit-address" value="${donor.address || ''}" class="luxe-input" placeholder="Adresse">
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="edit-zip" value="${donor.zip_code || ''}" class="luxe-input" style="width:80px;" placeholder="CP">
                        <input type="text" id="edit-city" value="${donor.city || ''}" class="luxe-input" placeholder="Ville">
                    </div>
                </div>

                <div class="card-inner">
                    <h3>🤝 Suivi & Entité</h3>
                    <select id="edit-entities" class="luxe-input">
                        ${ENTITIES.map(e => `<option value="${e}" ${donor.entities === e ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                    <label>Lien / Introduit par</label>
                    <input type="text" id="edit-next-action" value="${donor.next_action || ''}" class="luxe-input">
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📝 Notes & Commentaires</h3>
                <div class="notes-history">
                    ${notes.filter(n => !n.event).map(n => `
                        <div class="note-item">
                            <small>${new Date(n.created_at).toLocaleDateString()} - <strong>${n.author_name}</strong> :</small>
                            <p>${n.content}</p>
                        </div>
                    `).join('') || '<p>Aucune note.</p>'}
                </div>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <input type="text" id="new-note-content" class="luxe-input" placeholder="Ajouter une note...">
                    <button onclick="addNote('${donor.id}')" class="btn-primary">Ajouter</button>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💶 Historique des Dons</h3>
                <table class="luxe-table">
                    <thead><tr><th>Date</th><th>Montant</th><th>Entité</th><th>Reçu Fiscal</th></tr></thead>
                    <tbody>
                        ${donations.map(d => `
                            <tr>
                                <td>${d.date}</td>
                                <td>${d.amount} €</td>
                                <td>${d.thank_you_status || 'Alsatia'}</td>
                                <td><input type="text" value="${d.tax_receipt_id || ''}" 
                                     onchange="updateReceipt('${d.id}', this.value)" class="table-input"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button onclick="addDonation('${donor.id}')" class="btn-primary" style="margin-top:10px;">+ Enregistrer un Don</button>
            </div>

            <div class="modal-footer">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save">Enregistrer la fiche</button>
            </div>
        </div>
    `;
}

// --- 3. SAISIE DES DONS & NOTES ---
async function addDonation(donorId) {
    const modal = document.getElementById('donor-detail-content');
    modal.innerHTML = `
        <div class="pro-fiche">
            <h3>Nouveau Don</h3>
            <label>Montant (€)</label>
            <input type="number" id="d-amount" class="luxe-input">
            <label>Entité Destinataire</label>
            <select id="d-entity" class="luxe-input">
                ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
            <label>Numéro Reçu Fiscal (Optionnel)</label>
            <input type="text" id="d-receipt" class="luxe-input">
            <label>Date</label>
            <input type="date" id="d-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
            <button onclick="submitDonation('${donorId}')" class="btn-primary" style="width:100%; margin-top:15px;">Valider</button>
        </div>
    `;
}

async function submitDonation(donorId) {
    const amount = document.getElementById('d-amount').value;
    const entity = document.getElementById('d-entity').value;
    const receipt = document.getElementById('d-receipt').value;
    const date = document.getElementById('d-date').value;

    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amount),
        date: date,
        tax_receipt_id: receipt || null,
        thank_you_status: entity // On détourne ce champ pour l'entité du don
    }]);
    openDonorFile(donorId);
}

async function addNote(donorId) {
    const content = document.getElementById('new-note-content').value;
    if (!content) return;
    await supabaseClient.from('messages').insert([{
        donor_id: donorId,
        content: content,
        author_name: `${currentUser.first_name} ${currentUser.last_name}`,
        private: true
    }]);
    openDonorFile(donorId);
}

// --- 4. EXPORTS EXCEL (POINT 3) ---
function exportDonorExcel(donorId) {
    const donor = allDonorsData.find(d => d.id === donorId);
    const rows = [
        ["FICHE DONATEUR - INSTITUT ALSATIA"],
        ["Nom", donor.last_name, "Prénom", donor.first_name],
        ["Entité", donor.entities],
        ["Adresse", `${donor.address || ''}, ${donor.zip_code || ''} ${donor.city || ''}`],
        [],
        ["DATE", "MONTANT", "ENTITÉ CIBLE", "REÇU FISCAL"]
    ];
    donor.donations.forEach(d => rows.push([d.date, d.amount, d.thank_you_status, d.tax_receipt_id]));
    
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fiche");
    XLSX.writeFile(wb, `Donateur_${donor.last_name}.xlsx`);
}

async function exportGlobalExcel() {
    const { data: d } = await supabaseClient.from('donations').select('*, donors(*)');
    const rows = d.map(x => ({
        Annee: x.date.split('-')[0],
        Date: x.date,
        Nom: x.donors.last_name,
        Prenom: x.donors.first_name,
        Entite_Donateur: x.donors.entities,
        Entite_Don: x.thank_you_status,
        Montant: x.amount,
        Recu_Fiscal: x.tax_receipt_id
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dons par Année");
    XLSX.writeFile(wb, "Export_Global_Alsatia.xlsx");
}

// --- FONCTIONS STANDARDS ---
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    const list = document.getElementById('donors-list');
    list.innerHTML = allDonorsData.map(d => `
        <tr>
            <td>${d.last_name.toUpperCase()} ${d.first_name || ''}</td>
            <td><small>${d.entities}</small></td>
            <td>${d.donations.reduce((s,n)=>s+Number(n.amount),0)}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td>
        </tr>
    `).join('');
}

async function saveDonorChanges(id) {
    const up = {
        first_name: document.getElementById('edit-fname').value,
        last_name: document.getElementById('edit-lname').value,
        address: document.getElementById('edit-address').value,
        zip_code: document.getElementById('edit-zip').value,
        city: document.getElementById('edit-city').value,
        entities: document.getElementById('edit-entities').value,
        next_action: document.getElementById('edit-next-action').value
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    alert("Modifications enregistrées");
    loadDonors();
    closeModal('donor-modal');
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchTab(id) { /* logique de switch identique */ }
function loadGlobalChat() { /* logique chat identique */ }
