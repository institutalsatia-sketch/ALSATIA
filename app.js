const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let allDonors = [];

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    loadDonors();
}

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonors = data || [];
    renderDonors(allDonors);
    loadDashboard();
}

function renderDonors(list) {
    const body = document.getElementById('donors-body');
    body.innerHTML = list.map(d => {
        const total = d.donations?.reduce((sum, don) => sum + don.amount, 0) || 0;
        return `
        <tr>
            <td><span class="badge-type">${d.donor_type}</span><strong>${d.last_name.toUpperCase()} ${d.first_name || ''}</strong><br><small>${d.city || '-'}</small></td>
            <td><b>${total.toLocaleString('fr-FR')} €</b></td>
            <td><small>${d.last_contact_date ? new Date(d.last_contact_date).toLocaleDateString() : 'Aucun'}</small></td>
            <td><button class="btn-primary btn-mini" onclick="openDonorFile('${d.id}')">Ouvrir Dossier</button></td>
        </tr>`;
    }).join('');
}

function filterDonors() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allDonors.filter(d => d.last_name.toLowerCase().includes(q) || (d.first_name && d.first_name.toLowerCase().includes(q)));
    renderDonors(filtered);
}

// --- CRÉATION ---
function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    renderTypeChoice();
}

function renderTypeChoice() {
    document.getElementById('modal-body').innerHTML = `
        <h2 class="section-title">Nouveau Dossier</h2>
        <div style="display:flex; gap:20px; justify-content:center; padding:40px;">
            <button class="btn-primary" onclick="renderDonorForm('Particulier')">👨 Particulier</button>
            <button class="btn-primary" onclick="renderDonorForm('Entreprise')">🏢 Entreprise</button>
        </div>`;
}

function renderDonorForm(type) {
    document.getElementById('modal-body').innerHTML = `
        <h2 class="section-title">Nouveau ${type}</h2>
        <form onsubmit="saveNewDonor(event, '${type}')" class="luxe-form">
            <div class="grid-2">
                <div><label>Nom / Entité</label><input type="text" id="n-nom" required></div>
                ${type === 'Particulier' ? '<div><label>Prénom</label><input type="text" id="n-pren" required></div>' : ''}
            </div>
            <label>Dons pour :</label>
            <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.8rem; margin:10px 0;">
                <label><input type="checkbox" name="entite" value="Institut Alsatia"> Institut Alsatia</label>
                <label><input type="checkbox" name="entite" value="Cours Herrade de Landsberg"> Cours Herrade</label>
                <label><input type="checkbox" name="entite" value="Collège Saints Louis et Zélie Martin"> Collège Martin</label>
                <label><input type="checkbox" name="entite" value="Academia Alsatia"> Academia Alsatia</label>
            </div>
            <div class="grid-2">
                <div><label>Type / Catégorie</label><input type="text" id="n-cat" placeholder="Parent, Ami..."></div>
                <div><label>Lien / Introduit par</label><input type="text" id="n-intro"></div>
            </div>
            <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;">Créer le dossier</button>
        </form>`;
}

async function saveNewDonor(e, type) {
    e.preventDefault();
    const entites = Array.from(document.querySelectorAll('input[name="entite"]:checked')).map(el => el.value).join(', ');
    const donor = { 
        donor_type: type, last_name: document.getElementById('n-nom').value, 
        first_name: type === 'Particulier' ? document.getElementById('n-pren').value : '', 
        entities: entites, category: document.getElementById('n-cat').value, introduced_by: document.getElementById('n-intro').value 
    };
    await supabaseClient.from('donors').insert([donor]);
    closeModal(); loadDonors();
}

// --- FICHE DOSSIER ---
async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <div>
                <h2 style="margin:0">${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
                <p style="color:var(--gold); font-weight:bold; margin-top:5px;">${donor.entities || 'Aucune entité sélectionnée'}</p>
            </div>
            <button class="btn-danger" onclick="deleteDonor('${id}')">Supprimer Dossier</button>
        </div>
        <div class="fiche-grid">
            <div class="luxe-form">
                <h3 class="section-title">Coordonnées & Suivi</h3>
                <div class="grid-2">
                    <div><label>Email</label><input type="text" value="${donor.email || ''}" onchange="updateField('${id}', 'email', this.value)"></div>
                    <div><label>Téléphone</label><input type="text" value="${donor.phone || ''}" onchange="updateField('${id}', 'phone', this.value)"></div>
                </div>
                <label>Adresse postale</label>
                <input type="text" value="${donor.address || ''}" onchange="updateField('${id}', 'address', this.value)">
                <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:10px;">
                    <input type="text" value="${donor.zip_code || ''}" placeholder="CP" onchange="updateField('${id}', 'zip_code', this.value)">
                    <input type="text" value="${donor.city || ''}" placeholder="Ville" onchange="updateField('${id}', 'city', this.value)">
                    <input type="text" value="${donor.country || 'France'}" onchange="updateField('${id}', 'country', this.value)">
                </div>
                <label>Dernière action réalisée</label><textarea onchange="updateField('${id}', 'last_action', this.value)">${donor.last_action || ''}</textarea>
                <label>Prochaine action à prévoir</label><textarea onchange="updateField('${id}', 'next_action', this.value)">${donor.next_action || ''}</textarea>
                <label>Date dernier contact</label><input type="date" value="${donor.last_contact_date || ''}" onchange="updateField('${id}', 'last_contact_date', this.value)">
                <label>Notes & Commentaires</label><textarea style="height:80px;" onchange="updateField('${id}', 'notes', this.value)">${donor.notes || ''}</textarea>
            </div>
            <div>
                <h3 class="section-title">Enregistrement des Dons</h3>
                <div id="don-form-container" style="background:#f1f5f9; padding:15px; border-radius:10px; margin-bottom:20px;">
                    <div class="grid-2">
                        <div><label style="margin-top:0">Montant (€)</label><input type="number" id="don-mt"></div>
                        <div><label style="margin-top:0">Date du don</label><input type="date" id="don-dt" value="${new Date().toISOString().split('T')[0]}"></div>
                    </div>
                    <label>Numéro Reçu Fiscal</label><input type="text" id="don-rf">
                    <label>Commentaire spécifique</label><textarea id="don-cm" style="height:50px;"></textarea>
                    <button class="btn-primary" style="width:100%; margin-top:15px;" onclick="submitDonation('${id}')">Enregistrer le don</button>
                </div>
                <div style="max-height:300px; overflow-y:auto;">
                    ${donor.donations?.sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div class="donation-item">
                            <button class="btn-delete-small" onclick="deleteDonation('${don.id}', '${id}')">×</button>
                            <b>${don.amount} €</b> - ${new Date(don.date).toLocaleDateString()}
                            <br><small>Reçu: ${don.tax_receipt_number || 'S/N'}</small>
                            <p style="margin:5px 0; font-size:0.75rem; font-style:italic; color:#64748b;">${don.comment || ''}</p>
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                                ${don.thank_you_status === 'En attente' ? `<button class="btn-primary btn-mini" onclick="markAsThanked('${don.id}', '${id}')">Remercier</button>` : ''}
                            </div>
                        </div>
                    `).join('') || '<p style="text-align:center; color:#94a3b8;">Aucun don.</p>'}
                </div>
            </div>
        </div>`;
}

async function submitDonation(donorId) {
    const amount = document.getElementById('don-mt').value;
    const date = document.getElementById('don-dt').value;
    const receipt = document.getElementById('don-rf').value;
    const comment = document.getElementById('don-cm').value;
    if(!amount) return;
    await supabaseClient.from('donations').insert([{ donor_id: donorId, amount: parseFloat(amount), date: date, tax_receipt_number: receipt, comment: comment }]);
    loadDonors().then(() => openDonorFile(donorId));
}

async function updateField(id, field, value) {
    await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
}

async function markAsThanked(donId, donorId) {
    await supabaseClient.from('donations').update({ thank_you_status: 'Effectué' }).eq('id', donId);
    loadDonors().then(() => openDonorFile(donorId));
}

// --- SUPPRESSIONS ---
async function deleteDonor(id) {
    if(confirm("Supprimer définitivement ce donateur et TOUT son historique de dons ?")) {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeModal(); loadDonors();
    }
}

async function deleteDonation(donId, donorId) {
    if(confirm("Supprimer ce don ?")) {
        await supabaseClient.from('donations').delete().eq('id', donId);
        loadDonors().then(() => openDonorFile(donorId));
    }
}

function exportToExcel() {
    let csv = "Nom;Type;Entites;Total\n";
    allDonors.forEach(d => { csv += `${d.last_name};${d.donor_type};${d.entities || ''};${d.donations?.reduce((s,n)=>s+n.amount,0)}\n`; });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "crm_alsatia_complet.csv"; link.click();
}

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name)').eq('thank_you_status', 'En attente').limit(5);
    feed.innerHTML = data?.map(d => `<div class="donation-item"><h4>${d.donors.last_name}</h4><p>${d.amount}€ à remercier</p></div>`).join('') || 'Aucun remerciement en attente.';
}

function switchTab(t) {
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(x => x.classList.remove('active'));
    document.getElementById(`tab-${t}`).classList.add('active');
    document.getElementById(`nav-${t}`).classList.add('active');
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }
window.onload = init;
