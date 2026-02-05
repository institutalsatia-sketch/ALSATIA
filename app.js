/**
 * CRM INSTITUT ALSATIA - MOTEUR FINAL v4.0
 * Aucune fenêtre native - Traçabilité Totale - Sécurité Supabase
 */

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// --- UI : SYSTÈME DE NOTIFICATION & CONFIRMATION ---
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
    }, 3500);
}

function customConfirm(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').innerText = message;
    modal.style.display = 'flex';
    document.getElementById('confirm-yes').onclick = () => {
        onConfirm();
        closeConfirm();
    };
}
function closeConfirm() { document.getElementById('confirm-modal').style.display = 'none'; }

// --- RECHERCHE ET FILTRES ---
function filterDonors() {
    const val = document.getElementById('search-donor').value.toLowerCase();
    const filtered = allDonorsData.filter(d => 
        (d.last_name || "").toLowerCase().includes(val) || 
        (d.first_name || "").toLowerCase().includes(val) ||
        (d.entities || "").toLowerCase().includes(val)
    );
    renderDonorsTable(filtered);
}

// --- FICHE DONATEUR (DÉTAILS & MODIFICATIONS) ---
async function openDonorFile(donorId) {
    const { data: donor, error } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', donorId).single();
    if (error) return showNotify("Erreur de chargement", "error");

    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';

    const donations = donor.donations || [];
    const notes = donor.messages || [];

    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header class="fiche-header">
                <div>
                    <h2>${donor.last_name.toUpperCase()} ${donor.first_name || ''}</h2>
                    <span class="signature-tag">Auteur : ${donor.last_modified_by || 'Inconnu'}</span>
                </div>
                <div class="header-actions">
                    <button onclick="exportDonorExcel('${donor.id}')" class="btn-sm-gold">Excel</button>
                    <button onclick="deleteFullDonor('${donor.id}')" class="btn-sm-danger">Supprimer Fiche</button>
                </div>
            </header>

            <div class="grid-2">
                <div class="card-inner">
                    <h3>📍 Coordonnées</h3>
                    <div class="input-stack">
                        <label>Prénom / Nom</label>
                        <div style="display:flex; gap:5px;">
                            <input type="text" id="e-fname" value="${donor.first_name || ''}" class="luxe-input">
                            <input type="text" id="e-lname" value="${donor.last_name || ''}" class="luxe-input">
                        </div>
                        <label>Email Professionnel</label>
                        <input type="email" id="e-mail" value="${donor.email || ''}" class="luxe-input">
                        <label>Adresse Postale</label>
                        <input type="text" id="e-addr" value="${donor.address || ''}" class="luxe-input">
                        <div style="display:flex; gap:5px;">
                            <input type="text" id="e-zip" value="${donor.zip_code || ''}" class="luxe-input" placeholder="CP" style="width:80px;">
                            <input type="text" id="e-city" value="${donor.city || ''}" class="luxe-input" placeholder="Ville">
                        </div>
                    </div>
                </div>

                <div class="card-inner">
                    <h3>🤝 Relation & Suivi</h3>
                    <div class="input-stack">
                        <label>Entité principale</label>
                        <select id="e-ent" class="luxe-input">
                            ${ENTITIES.map(e => `<option value="${e}" ${donor.entities === e ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                        <label>Introduit par (Lien)</label>
                        <input type="text" id="e-link" value="${donor.next_action || ''}" class="luxe-input">
                    </div>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>📝 Notes (Signées)</h3>
                <div class="notes-list">
                    ${notes.filter(n => !n.event).map(n => `
                        <div class="note-row">
                            <span><strong>${n.author_name}</strong> (${new Date(n.created_at).toLocaleDateString()}) : ${n.content}</span>
                            <button onclick="deleteNote('${n.id}', '${donor.id}')" class="btn-icon">🗑️</button>
                        </div>
                    `).join('') || 'Aucune note.'}
                </div>
                <div class="note-add-bar">
                    <input type="text" id="new-note-txt" placeholder="Ajouter un commentaire..." class="luxe-input">
                    <button onclick="addNote('${donor.id}')" class="btn-primary">Publier</button>
                </div>
            </div>

            <div class="card-inner full-width" style="margin-top:20px;">
                <h3>💶 Historique des Dons</h3>
                <table class="luxe-table">
                    <thead><tr><th>Date</th><th>Montant</th><th>Entité</th><th>N° Reçu</th><th>Action</th></tr></thead>
                    <tbody>
                        ${donations.map(d => `
                            <tr>
                                <td>${d.date}</td>
                                <td><strong>${d.amount}€</strong></td>
                                <td>${d.thank_you_status || 'Général'}</td>
                                <td><input type="text" value="${d.tax_receipt_id || ''}" onchange="updateReceipt('${d.id}', this.value)" class="table-input"></td>
                                <td><button onclick="deleteDonation('${d.id}', '${donor.id}')" class="btn-icon">🗑️</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <button onclick="addDonationUI('${donor.id}')" class="btn-outline-gold" style="margin-top:10px;">+ Enregistrer un don</button>
            </div>

            <div class="modal-footer">
                <button onclick="saveDonorChanges('${donor.id}')" class="btn-save">💾 Sauvegarder les modifications</button>
            </div>
        </div>
    `;
}

// --- ACTIONS BDD & VALIDATIONS ---
async function saveDonorChanges(id) {
    const lname = document.getElementById('e-lname').value;
    const email = document.getElementById('e-mail').value;

    if (!lname) return showNotify("Le nom est obligatoire", "error");
    if (email && !email.includes('@')) return showNotify("Format email invalide", "error");

    const { error } = await supabaseClient.from('donors').update({
        first_name: document.getElementById('e-fname').value,
        last_name: lname,
        email: email,
        address: document.getElementById('e-addr').value,
        zip_code: document.getElementById('e-zip').value,
        city: document.getElementById('e-city').value,
        entities: document.getElementById('e-ent').value,
        next_action: document.getElementById('e-link').value
    }).eq('id', id);

    if (error) showNotify("Erreur de sauvegarde", "error");
    else { showNotify("Fiche mise à jour"); loadDonors(); closeModal('donor-modal'); }
}

async function deleteDonation(id, donorId) {
    customConfirm("Supprimer ce don ?", async () => {
        await supabaseClient.from('donations').delete().eq('id', id);
        showNotify("Don supprimé");
        openDonorFile(donorId);
    });
}

async function deleteNote(id, donorId) {
    customConfirm("Supprimer cette note ?", async () => {
        await supabaseClient.from('messages').delete().eq('id', id);
        showNotify("Note supprimée");
        openDonorFile(donorId);
    });
}

async function deleteFullDonor(id) {
    customConfirm("⚠️ SUPPRIMER TOUT LE DOSSIER ET LES DONS ?", async () => {
        await supabaseClient.from('donations').delete().eq('donor_id', id);
        await supabaseClient.from('messages').delete().eq('donor_id', id);
        await supabaseClient.from('donors').delete().eq('id', id);
        showNotify("Dossier supprimé définitivement");
        closeModal('donor-modal');
        loadDonors();
    });
}

// --- EXPORTS EXCEL ---
function exportDonorExcel(donorId) {
    const donor = allDonorsData.find(d => d.id === donorId);
    const rows = [
        ["FICHE DONATEUR"], ["Nom", donor.last_name, "Prénom", donor.first_name],
        ["Entité", donor.entities], ["Contact", donor.email], [],
        ["DATE", "MONTANT", "ENTITÉ CIBLE", "REÇU FISCAL"]
    ];
    donor.donations.forEach(d => rows.push([d.date, d.amount, d.thank_you_status, d.tax_receipt_id]));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Détails");
    XLSX.writeFile(wb, `Alsatia_${donor.last_name}.xlsx`);
}
