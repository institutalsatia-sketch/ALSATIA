const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let allDonors = [];
let confirmCallback = null;

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
        const displayName = d.donor_type === 'Entreprise' ? d.last_name : `${d.last_name.toUpperCase()} ${d.first_name || ''}`;
        return `
        <tr>
            <td><strong>${displayName}</strong><br><small>${d.city || '-'} | ${d.category || '-'}</small></td>
            <td><b style="color:var(--primary)">${total.toLocaleString('fr-FR')} €</b></td>
            <td><small>${d.last_contact_date ? new Date(d.last_contact_date).toLocaleDateString('fr-FR') : 'Jamais'}</small></td>
            <td><button class="btn-primary" style="padding:6px 12px; font-size:0.75rem;" onclick="openDonorFile('${d.id}')">Dossier</button></td>
        </tr>`;
    }).join('');
}

// --- MODALES ET TOASTS ---
function customConfirm(message, callback) {
    confirmCallback = callback;
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('custom-confirm').style.display = 'block';
}

function closeConfirm() { document.getElementById('custom-confirm').style.display = 'none'; }

document.getElementById('confirm-yes').onclick = () => { if (confirmCallback) confirmCallback(); closeConfirm(); };

function showToast(msg) {
    const t = document.getElementById('toast-notification');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// --- GESTION DONATEURS ---
function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    document.getElementById('modal-body').innerHTML = `
        <h2 class="section-title">Nouveau Dossier</h2>
        <div style="display:flex; gap:20px; justify-content:center; padding:20px;">
            <button class="btn-primary" onclick="renderDonorForm('Particulier')">👨 Particulier</button>
            <button class="btn-primary" onclick="renderDonorForm('Entreprise')">🏢 Entreprise</button>
        </div>`;
}

function renderDonorForm(type) {
    document.getElementById('modal-body').innerHTML = `
        <h2 class="section-title">Initialisation ${type}</h2>
        <form onsubmit="saveNewDonor(event, '${type}')" class="luxe-form">
            <div class="grid-2">
                <div><label>Civilité</label><input type="text" id="n-civ" placeholder="M., Mme..."></div>
                <div><label>Nom</label><input type="text" id="n-nom" required></div>
            </div>
            ${type === 'Particulier' ? '<label>Prénom</label><input type="text" id="n-pren" required>' : ''}
            <label>Affectation :</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin:10px 0; font-size:0.8rem;">
                <label><input type="checkbox" name="entite" value="Institut Alsatia"> Institut Alsatia</label>
                <label><input type="checkbox" name="entite" value="Cours Herrade"> Cours Herrade</label>
                <label><input type="checkbox" name="entite" value="Collège Martin"> Collège Martin</label>
                <label><input type="checkbox" name="entite" value="Academia Alsatia"> Academia Alsatia</label>
            </div>
            <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;">Créer la fiche</button>
        </form>`;
}

async function saveNewDonor(e, type) {
    e.preventDefault();
    const entites = Array.from(document.querySelectorAll('input[name="entite"]:checked')).map(el => el.value).join(', ');
    const donor = { 
        donor_type: type, last_name: document.getElementById('n-nom').value, 
        first_name: type === 'Particulier' ? document.getElementById('n-pren').value : '',
        title: document.getElementById('n-civ').value, entities: entites, country: 'France' 
    };
    const { data, error } = await supabaseClient.from('donors').insert([donor]).select();
    if(!error) loadDonors().then(() => openDonorFile(data[0].id));
}

// --- FICHE COMPLETE & DONS ---
async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <div>
                <span class="badge-type">${donor.donor_type}</span>
                <h2 style="margin:5px 0 0 0;">${donor.title || ''} ${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
            </div>
            <button class="btn-danger" style="padding:5px 10px; font-size:0.7rem;" onclick="deleteDonor('${id}')">Supprimer Dossier</button>
        </div>
        <div class="fiche-grid">
            <div class="luxe-form">
                <h3 class="section-title">Informations</h3>
                <div class="grid-2">
                    <div><label>Email</label><input type="email" value="${donor.email || ''}" onchange="updateField('${id}', 'email', this.value)"></div>
                    <div><label>Téléphone</label><input type="text" value="${donor.phone || ''}" onchange="updateField('${id}', 'phone', this.value)"></div>
                </div>
                <label>Adresse</label><input type="text" value="${donor.address || ''}" onchange="updateField('${id}', 'address', this.value)">
                <div class="grid-2">
                    <input type="text" value="${donor.zip_code || ''}" placeholder="CP" onchange="updateField('${id}', 'zip_code', this.value)">
                    <input type="text" value="${donor.city || ''}" placeholder="Ville" onchange="updateField('${id}', 'city', this.value)">
                </div>
                <h3 class="section-title">Suivi Relationnel</h3>
                <label>Prochaine Action</label>
                <textarea style="border: 2px solid var(--gold)" onchange="updateField('${id}', 'next_action', this.value)">${donor.next_action || ''}</textarea>
                <label>Notes</label>
                <textarea style="height:100px;" onchange="updateField('${id}', 'notes', this.value)">${donor.notes || ''}</textarea>
            </div>
            <div>
                <h3 class="section-title">Dons</h3>
                <div style="background:#f1f5f9; padding:15px; border-radius:10px; margin-bottom:15px;">
                    <div class="grid-2">
                        <input type="number" id="don-mt" placeholder="Montant €">
                        <input type="date" id="don-dt" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <button class="btn-primary" style="width:100%; margin-top:10px;" onclick="submitDonation('${id}')">Ajouter Don</button>
                </div>
                <div style="max-height:400px; overflow-y:auto;">
                    ${donor.donations?.sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div class="donation-item" style="border-left: 4px solid ${don.thank_you_status === 'Effectué' ? 'var(--success)' : 'var(--danger)'}">
                            <button class="btn-delete-small" onclick="deleteDonation('${don.id}', '${id}')">×</button>
                            <div class="grid-2">
                                <input type="number" value="${don.amount}" onchange="updateDonationField('${don.id}', 'amount', this.value, '${id}')" style="font-weight:bold; border:none; background:transparent;">
                                <input type="date" value="${don.date}" onchange="updateDonationField('${don.id}', 'date', this.value, '${id}')" style="border:none; background:transparent;">
                            </div>
                            <input type="text" value="${don.tax_receipt_number || ''}" placeholder="N° Reçu Fiscal" onchange="updateDonationField('${don.id}', 'tax_receipt_number', this.value, '${id}')" style="width:100%; border:none; border-bottom:1px solid #ddd; background:transparent; font-size:0.8rem; margin-top:5px;">
                            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                                <span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                                <button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;" onclick="markAsThanked('${don.id}', '${id}')">Remercié</button>
                            </div>
                        </div>
                    `).join('') || 'Aucun don.'}
                </div>
            </div>
        </div>`;
}

// --- LOGIQUE SUPABASE ---
async function updateField(id, field, value) {
    const { error } = await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
    if(!error) showToast("Sauvegardé");
}

async function updateDonationField(donId, field, value, donorId) {
    await supabaseClient.from('donations').update({ [field]: value }).eq('id', donId);
    showToast("Don mis à jour");
    await loadDonors();
}

async function submitDonation(donorId) {
    const mt = document.getElementById('don-mt').value;
    const dt = document.getElementById('don-dt').value;
    if(!mt) return;
    await supabaseClient.from('donations').insert([{ donor_id: donorId, amount: parseFloat(mt), date: dt }]);
    loadDonors().then(() => openDonorFile(donorId));
}

async function markAsThanked(donId, donorId) {
    await supabaseClient.from('donations').update({ thank_you_status: 'Effectué' }).eq('id', donId);
    loadDonors().then(() => openDonorFile(donorId));
}

async function deleteDonor(id) {
    customConfirm("Supprimer définitivement ce dossier ?", async () => {
        await supabaseClient.from('donors').delete().eq('id', id);
        closeModal(); loadDonors();
        showToast("Dossier supprimé");
    });
}

async function deleteDonation(donId, donorId) {
    customConfirm("Supprimer ce don ?", async () => {
        await supabaseClient.from('donations').delete().eq('id', donId);
        loadDonors().then(() => openDonorFile(donorId));
        showToast("Don supprimé");
    });
}

function filterDonors() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allDonors.filter(d => d.last_name.toLowerCase().includes(q) || (d.city && d.city.toLowerCase().includes(q)));
    renderDonors(filtered);
}

function switchTab(t) {
    document.querySelectorAll('.tab-content, .nav-links li').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${t}`).classList.add('active');
    document.getElementById(`nav-${t}`).classList.add('active');
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }
window.onload = init;
