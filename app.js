/**
 * PARTENAIRE DE CODE - CRM INSTITUT ALSATIA v3.0
 * Gestion Multi-Entités, Traçabilité & Exports Excel Pro
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

const ENTITIES = [
    "Institut Alsatia",
    "Cours Herrade de Landsberg",
    "Collège Saints Louis et Zélie Martin",
    "Academia Alsatia"
];

// EXPOSITION DES FONCTIONS AU WINDOW
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
window.updateReceipt = updateReceipt;

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

// --- 1. CRÉATION AVEC PRÉNOM/NOM & TRAÇABILITÉ ---
function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h3 class="gold-title">Créer un nouveau Dossier</h3>
            <div class="grid-2">
                <div class="input-stack">
                    <label>Prénom</label>
                    <input type="text" id="n-fname" class="luxe-input" placeholder="Ex: Jean">
                </div>
                <div class="input-stack">
                    <label>Nom</label>
                    <input type="text" id="n-lname" class="luxe-input" placeholder="Ex: MARTIN">
                </div>
            </div>
            <div class="input-stack" style="margin-top:15px;">
                <label>Entité principale de rattachement</label>
                <select id="n-entities" class="luxe-input">
                    ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
            </div>
            <div class="signature-info">✍️ Créé par : ${currentUser.first_name} ${currentUser.last_name}</div>
            <button onclick="handleNewDonor()" class="btn-primary" style="width:100%; margin-top:15px;">Valider la création</button>
        </div>
    `;
}

async function handleNewDonor() {
    const fname = document.getElementById('n-fname').value;
    const lname = document.getElementById('n-lname').value;
    const entity = document.getElementById('n-entities').value;

    if (!lname) return alert("Le nom est obligatoire.");

    const { error } = await supabaseClient.from('donors').insert([{
        first_name: fname,
        last_name: lname,
        entities: entity,
        last_modified_by: `Créé par ${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if (!error) { closeModal('donor-modal'); loadDonors(); }
}

// --- 2. FICHE DÉTAILLÉE : MODIFICATIONS & NOTES SIGNÉES ---
async function openDonorFile(donorId) {
    const { data: donor } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';

    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <div>
                    <h2>${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
                    <span class="created-at">Dossier : ${donor.last_modified_by || 'Auteur inconnu'}</span>
                </div>
                <div class="actions-top">
                    <button onclick="exportDonorExcel('${donor.id}')" class="btn-sm-gold">📊 Excel</button>
                    <button onclick="closeModal('donor-modal')" class="btn-sm">Fermer</button>
                </div>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Identité & Adresse</h3>
                    <div class="input-stack">
                        <label>Prénom</label>
                        <input type="text" id="edit-fname" value="${donor.first_name || ''}" class="luxe-input">
                        <label>Nom</label>
                        <input type="text" id="edit-lname" value="${donor.last_name || ''}" class="luxe-input">
                        <label>Adresse Postale Professionnelle</label>
                        <input type="text" id="edit-address" value="${donor.address || ''}" class="luxe-input">
                        <div style="display:flex; gap:10px;">
                            <input type="text" id="edit-zip" value="${donor.zip_code || ''}" class="luxe-input" placeholder="CP" style="width:80px;">
                            <input type="text" id="edit-city" value="${donor.city || ''}" class="luxe-input" placeholder="Ville">
                        </div>
                    </div>
                </div>

                <div class="card-inner">
                    <h3>🤝 Suivi & Entité</h3>
                    <div class="input-stack">
                        <label>Entité Principale</label>
                        <select id="edit-entities" class="luxe-input">
                            ${ENTITIES.map(e => `<option value="${e}" ${donor.entities === e ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                        <label>Lien / Introduit par</label>
                        <input type="text" id="edit-next-action" value="${donor.next_action || ''}" class="luxe-input">
                        <label>Email</label>
                        <input type="email" id="edit-email" value="${donor.email || ''}" class="luxe-input">
                    </div>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📝 Notes de Suivi</h3>
                <div class="notes-container">
                    ${notes.filter(n => !n.event).map(n => `
                        <div class="note-item">
                            <div class="note-meta">Le ${new Date(n.created_at).toLocaleDateString()} par <strong>${n.author_name}</strong></div>
                            <div class="note-body">${n.content}</div>
                        </div>
                    `).join('') || '<p class="text-muted">Aucun commentaire enregistré.</p>'}
                </div>
                <div class="note-input-area">
                    <input type="text" id="new-note-content" class="luxe-input" placeholder="Ajouter une note importante...">
                    <button onclick="addNote('${donor.id}')" class="btn-primary">Publier</button>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💶 Registre des Dons</h3>
                <table class="luxe-table">
                    <thead>
                        <tr><th>Date</th><th>Montant</th><th>Entité Cible</th><th>N° Reçu Fiscal</th></tr>
                    </thead>
                    <tbody>
                        ${donations.map(d => `
                            <tr>
                                <td>${d.date}</td>
                                <td><strong>${d.amount} €</strong></td>
                                <td>${d.thank_you_status || 'Général'}</td>
                                <td><input type="text" value="${d.tax_receipt_id || ''}" 
                                     onchange="updateReceipt('${d.id}', this.value)" class="table-input" placeholder="RF-..."></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button onclick="addDonation('${donor.id}')" class="btn-primary" style="margin-top:10px;">+ Enregistrer un Don</button>
            </div>

            <div class="modal-footer">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save">💾 Enregistrer tout le dossier</button>
            </div>
        </div>
    `;
}

// --- 3. LOGIQUE DES DONS & NOTES ---
async function addDonation(donorId) {
    const container = document.getElementById('donor-detail-content');
    container.innerHTML = `
        <div class="pro-fiche">
            <h3>Nouveau Don pour l'Entité</h3>
            <div class="input-stack">
                <label>Montant du don (€)</label>
                <input type="number" id="d-amount" class="luxe-input" placeholder="0.00">
                <label>Entité Destinataire</label>
                <select id="d-entity" class="luxe-input">
                    ${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
                <label>Numéro de Reçu Fiscal (si déjà émis)</label>
                <input type="text" id="d-receipt" class="luxe-input" placeholder="Ex: RF-2026-001">
                <label>Date du versement</label>
                <input type="date" id="d-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="modal-actions">
                <button onclick="submitDonation('${donorId}')" class="btn-save">Confirmer le don</button>
                <button onclick="openDonorFile('${donorId}')" class="btn-outline">Annuler</button>
            </div>
        </div>
    `;
}

async function submitDonation(donorId) {
    const amount = document.getElementById('d-amount').value;
    const entity = document.getElementById('d-entity').value;
    const receipt = document.getElementById('d-receipt').value;
    const date = document.getElementById('d-date').value;

    if (!amount) return alert("Montant requis");

    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amount),
        date: date,
        tax_receipt_id: receipt || null,
        thank_you_status: entity // On utilise ce champ pour l'entité spécifique du don
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

// --- 4. EXPORTS EXCEL .XLSX ---
function exportDonorExcel(donorId) {
    const donor = allDonorsData.find(d => d.id === donorId);
    const data = [
        ["INSTITUT ALSATIA - FICHE INDIVIDUELLE"],
        ["Exporté le", new Date().toLocaleDateString()],
        [],
        ["IDENTITÉ", "VALEUR"],
        ["Prénom", donor.first_name],
        ["Nom", donor.last_name],
        ["Entité Principale", donor.entities],
        ["Adresse", donor.address || ""],
        ["Ville", `${donor.zip_code || ""} ${donor.city || ""}`],
        ["Lien / Intro", donor.next_action || ""],
        [],
        ["HISTORIQUE FINANCIER"],
        ["DATE", "MONTANT", "ENTITÉ CIBLE", "REÇU FISCAL"]
    ];
    
    donor.donations.forEach(d => data.push([d.date, d.amount, d.thank_you_status, d.tax_receipt_id]));

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fiche");
    XLSX.writeFile(wb, `Fiche_${donor.last_name}_${new Date().getFullYear()}.xlsx`);
}

async function exportGlobalExcel() {
    const { data: d } = await supabaseClient.from('donations').select('*, donors(*)');
    const rows = d.map(x => ({
        "Année": x.date.split('-')[0],
        "Date": x.date,
        "Nom": x.donors.last_name,
        "Prénom": x.donors.first_name,
        "Entité Donateur": x.donors.entities,
        "Entité Cible Don": x.thank_you_status,
        "Montant": x.amount,
        "Numéro Reçu Fiscal": x.tax_receipt_id
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registre Annuel");
    XLSX.writeFile(wb, "Rapport_Dons_Global_Alsatia.xlsx");
}

// --- UTILITAIRES ---
async function updateReceipt(donationId, value) {
    await supabaseClient.from('donations').update({ tax_receipt_id: value }).eq('id', donationId);
}

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => `
        <tr>
            <td><strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}</td>
            <td>${d.entities}</td>
            <td class="gold-text">${d.donations.reduce((s,n)=>s+Number(n.amount),0)} €</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir Dossier</button></td>
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
        next_action: document.getElementById('edit-next-action').value,
        email: document.getElementById('edit-email').value
    };
    await supabaseClient.from('donors').update(up).eq('id', id);
    alert("Données sauvegardées.");
    loadDonors();
    closeModal('donor-modal');
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
}
function loadGlobalChat() { /* ... Logique de chat existante ... */ }
