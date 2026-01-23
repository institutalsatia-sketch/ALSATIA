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
        const displayName = d.donor_type === 'Entreprise' ? d.last_name : `${d.last_name.toUpperCase()} ${d.first_name || ''}`;
        return `
        <tr>
            <td><span class="badge-type">${d.donor_type}</span> <strong>${displayName}</strong><br><small>${d.city || '-'} | ${d.category || '-'}</small></td>
            <td><b style="color:var(--primary)">${total.toLocaleString('fr-FR')} €</b></td>
            <td><small>${d.last_contact_date ? new Date(d.last_contact_date).toLocaleDateString('fr-FR') : 'Jamais'}</small></td>
            <td><button class="btn-primary" style="padding:6px 12px; font-size:0.75rem;" onclick="openDonorFile('${d.id}')">Dossier</button></td>
        </tr>`;
    }).join('');
}

function filterDonors() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allDonors.filter(d => 
        d.last_name.toLowerCase().includes(q) || 
        (d.first_name && d.first_name.toLowerCase().includes(q)) ||
        (d.city && d.city.toLowerCase().includes(q)) ||
        (d.category && d.category.toLowerCase().includes(q))
    );
    renderDonors(filtered);
}

// --- MODAL CRÉATION ---
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
        <h2 class="section-title">Nouveau ${type}</h2>
        <form onsubmit="saveNewDonor(event, '${type}')" class="luxe-form">
            <div class="grid-2">
                <div><label>Civilité / Titre</label><input type="text" id="n-civ" placeholder="M., Mme, Famille..."></div>
                <div><label>${type === 'Entreprise' ? 'Nom Entreprise' : 'Nom'}</label><input type="text" id="n-nom" required></div>
            </div>
            ${type === 'Particulier' ? '<label>Prénom</label><input type="text" id="n-pren" required>' : ''}
            
            <label>Affectation des dons :</label>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:5px; margin:5px 0; font-size:0.8rem;">
                <label><input type="checkbox" name="entite" value="Institut Alsatia"> Institut Alsatia</label>
                <label><input type="checkbox" name="entite" value="Cours Herrade de Landsberg"> Cours Herrade de Landsberg</label>
                <label><input type="checkbox" name="entite" value="Collège Saints Louis et Zélie Martin"> Collège Martin</label>
                <label><input type="checkbox" name="entite" value="Academia Alsatia"> Academia Alsatia</label>
            </div>
            <div class="grid-2">
                <div><label>Catégorie (Parent, Ami...)</label><input type="text" id="n-cat"></div>
                <div><label>Introduit par</label><input type="text" id="n-intro"></div>
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
        title: document.getElementById('n-civ').value,
        entities: entites, category: document.getElementById('n-cat').value, 
        introduced_by: document.getElementById('n-intro').value, country: 'France' 
    };
    const { data } = await supabaseClient.from('donors').insert([donor]).select();
    loadDonors().then(() => openDonorFile(data[0].id));
}

// --- FICHE COMPLÈTE (ÉDITION TOTALE) ---
async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <div>
                <span class="badge-type">${donor.donor_type}</span>
                <h2 style="margin:5px 0 0 0;">${donor.title || ''} ${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
                <p style="color:var(--gold); font-weight:600; font-size:0.85rem; margin-top:5px;">${donor.entities || 'Aucune entité'}</p>
            </div>
            <button class="btn-danger" onclick="deleteDonor('${id}')">Supprimer Dossier</button>
        </div>

        <div class="fiche-grid">
            <div class="luxe-form">
                <h3 class="section-title">Identité & Coordonnées</h3>
                <div class="grid-2">
                    <div><label>Civilité / Titre</label><input type="text" value="${donor.title || ''}" onchange="updateField('${id}', 'title', this.value)"></div>
                    <div><label>Catégorie</label><input type="text" value="${donor.category || ''}" onchange="updateField('${id}', 'category', this.value)"></div>
                </div>
                <div class="grid-2">
                    <div><label>Email</label><input type="email" value="${donor.email || ''}" onchange="updateField('${id}', 'email', this.value)"></div>
                    <div><label>Téléphone</label><input type="text" value="${donor.phone || ''}" onchange="updateField('${id}', 'phone', this.value)"></div>
                </div>
                <label>Adresse Postale</label>
                <input type="text" value="${donor.address || ''}" onchange="updateField('${id}', 'address', this.value)">
                <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:10px;">
                    <input type="text" value="${donor.zip_code || ''}" placeholder="CP" onchange="updateField('${id}', 'zip_code', this.value)">
                    <input type="text" value="${donor.city || ''}" placeholder="Ville" onchange="updateField('${id}', 'city', this.value)">
                    <input type="text" value="${donor.country || 'France'}" placeholder="Pays" onchange="updateField('${id}', 'country', this.value)">
                </div>

                <h3 class="section-title">Suivi & Stratégie</h3>
                <div class="grid-2">
                    <div><label>Dernier contact</label><input type="date" value="${donor.last_contact_date || ''}" onchange="updateField('${id}', 'last_contact_date', this.value)"></div>
                    <div><label>Introduit par</label><input type="text" value="${donor.introduced_by || ''}" onchange="updateField('${id}', 'introduced_by', this.value)"></div>
                </div>
                <label>Dernière action réalisée</label>
                <textarea onchange="updateField('${id}', 'last_action', this.value)">${donor.last_action || ''}</textarea>
                <label style="color:var(--primary)">Prochaine action prévue (Rappel)</label>
                <textarea style="border: 2px solid var(--gold)" onchange="updateField('${id}', 'next_action', this.value)">${donor.next_action || ''}</textarea>
                <label>Notes confidentielles</label>
                <textarea style="height:100px;" onchange="updateField('${id}', 'notes', this.value)">${donor.notes || ''}</textarea>
            </div>

            <div>
                <h3 class="section-title">Historique Financier</h3>
                <div style="background:#f1f5f9; padding:15px; border-radius:10px; margin-bottom:20px;">
                    <h4 style="margin:0 0 10px 0; font-size:0.8rem;">Enregistrer un don</h4>
                    <div class="grid-2">
                        <input type="number" id="don-mt" placeholder="Montant €">
                        <input type="date" id="don-dt" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <input type="text" id="don-rf" placeholder="N° Reçu Fiscal" style="margin-top:8px; width:100%;">
                    <textarea id="don-cm" placeholder="Commentaire (ex: Virement, Event...)" style="margin-top:8px; width:100%; height:45px;"></textarea>
                    <button class="btn-primary" style="width:100%; margin-top:12px;" onclick="submitDonation('${id}')">Valider le don</button>
                </div>

                <div style="max-height:450px; overflow-y:auto;">
                    ${donor.donations?.sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div class="donation-item">
                            <button class="btn-delete-small" onclick="deleteDonation('${don.id}', '${id}')">×</button>
                            <div style="display:flex; justify-content:space-between;">
                                <b>${don.amount.toLocaleString()} €</b>
                                <small>${new Date(don.date).toLocaleDateString()}</small>
                            </div>
                            <div style="font-size:0.75rem; margin-top:5px;">
                                <b>Reçu :</b> ${don.tax_receipt_number || 'S/N'}<br>
                                <span style="color:#64748b; font-style:italic;">${don.comment || ''}</span>
                            </div>
                            <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                                <span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                                ${don.thank_you_status === 'En attente' ? `<button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;" onclick="markAsThanked('${don.id}', '${id}')">Remercié</button>` : ''}
                            </div>
                        </div>
                    `).join('') || '<p style="text-align:center; color:#94a3b8;">Aucun don enregistré.</p>'}
                </div>
            </div>
        </div>`;
}

// --- LOGIQUE SYNC ---
async function updateField(id, field, value) {
    await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
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

async function markAsThanked(donId, donorId) {
    await supabaseClient.from('donations').update({ thank_you_status: 'Effectué' }).eq('id', donId);
    loadDonors().then(() => openDonorFile(donorId));
}

async function deleteDonor(id) {
    if(confirm("Supprimer ce dossier et tous ses dons ?")) {
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
    let csv = "Civilité;Nom;Prénom;Entités;Total;Dernier Contact;Ville;Catégorie\n";
    allDonors.forEach(d => {
        const total = d.donations?.reduce((s,n)=>s+n.amount,0) || 0;
        csv += `${d.title || ''};${d.last_name};${d.first_name || ''};${d.entities || ''};${total};${d.last_contact_date || ''};${d.city || ''};${d.category || ''}\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "CRM_EXPERT_ALSATIA.csv"; link.click();
}

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name, first_name)').eq('thank_you_status', 'En attente').limit(5);
    feed.innerHTML = data?.length ? data.map(d => `<div class="donation-item"><h4>${d.donors.last_name}</h4><p>${d.amount}€ à remercier</p></div>`).join('') : '<p>Rien à signaler.</p>';
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
