const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let allDonors = [];

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    
    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
    document.getElementById('user-name').innerText = profile ? `${profile.first_name} ${profile.last_name}` : session.user.email;
    
    loadDonors();
    loadDashboard();
}

// GESTION DES ONGLETS
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    if(tabName === 'donors') loadDonors();
}

// CHARGEMENT DE LA BASE
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonors = data || [];
    renderDonors(allDonors);
}

function renderDonors(list) {
    const body = document.getElementById('donors-body');
    body.innerHTML = list.map(d => {
        const total = d.donations?.reduce((sum, don) => sum + don.amount, 0) || 0;
        const isEntreprise = d.donor_type === 'Entreprise';
        return `
        <tr>
            <td>
                <span class="badge-type">${d.donor_type}</span>
                <strong>${isEntreprise ? d.last_name : d.last_name.toUpperCase() + ' ' + d.first_name}</strong>
                <br><small>${d.city || '-'} | ${d.category || '-'}</small>
            </td>
            <td><b>${total.toLocaleString('fr-FR')} €</b><br><small>${d.donations?.length || 0} don(s)</small></td>
            <td><small>Dernier contact :<br>${d.last_contact_date ? new Date(d.last_contact_date).toLocaleDateString() : 'Aucun'}</small></td>
            <td><button class="btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="openDonorFile('${d.id}')">Dossier</button></td>
        </tr>`;
    }).join('');
}

// RECHERCHE
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

// MODAL : CRÉATION (CHOIX TYPE)
function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    renderDonorForm('Particulier');
}

function renderDonorForm(type) {
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <h2 class="section-title">Nouveau Dossier : ${type}</h2>
        <div style="margin-bottom:20px; display:flex; gap:10px;">
            <button class="btn-export" style="${type === 'Particulier' ? 'border-color:var(--gold)' : ''}" onclick="renderDonorForm('Particulier')">👨 Particulier</button>
            <button class="btn-export" style="${type === 'Entreprise' ? 'border-color:var(--gold)' : ''}" onclick="renderDonorForm('Entreprise')">🏢 Entreprise</button>
        </div>
        <form onsubmit="saveNewDonor(event, '${type}')" class="luxe-form">
            <div class="grid-2">
                <div><label>${type === 'Entreprise' ? 'Nom Entité' : 'Nom'}</label><input type="text" id="n-nom" required></div>
                ${type === 'Particulier' ? '<div><label>Prénom</label><input type="text" id="n-pren" required></div>' : ''}
            </div>
            
            <label>Dons pour quelle(s) entité(s) ?</label>
            <div style="margin: 10px 0; display:flex; gap:15px; font-size:0.85rem;">
                <label style="color:inherit; text-transform:none;"><input type="checkbox" name="entite" value="Institut Alsatia"> Alsatia</label>
                <label style="color:inherit; text-transform:none;"><input type="checkbox" name="entite" value="Cours Herrade"> Herrade</label>
                <label style="color:inherit; text-transform:none;"><input type="checkbox" name="entite" value="Collège Martin"> Martin</label>
            </div>

            <div class="grid-2">
                <div><label>Type (Parent, Ami, Mécène...)</label><input type="text" id="n-cat"></div>
                <div><label>Lien (Introduit par...)</label><input type="text" id="n-intro"></div>
            </div>

            <div class="grid-2">
                <div><label>Email</label><input type="email" id="n-email"></div>
                <div><label>Téléphone</label><input type="text" id="n-tel"></div>
            </div>

            <label>Adresse Postale</label>
            <input type="text" id="n-adr" placeholder="Adresse">
            <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:10px;">
                <input type="text" id="n-cp" placeholder="CP">
                <input type="text" id="n-ville" placeholder="Ville">
                <input type="text" id="n-pays" value="France">
            </div>

            <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;">Enregistrer le dossier</button>
        </form>`;
}

async function saveNewDonor(e, type) {
    e.preventDefault();
    const entites = Array.from(document.querySelectorAll('input[name="entite"]:checked')).map(el => el.value).join(', ');
    
    const donor = {
        donor_type: type,
        last_name: document.getElementById('n-nom').value,
        first_name: type === 'Particulier' ? document.getElementById('n-pren').value : '',
        entities: entites,
        category: document.getElementById('n-cat').value,
        introduced_by: document.getElementById('n-intro').value,
        email: document.getElementById('n-email').value,
        phone: document.getElementById('n-tel').value,
        address: document.getElementById('n-adr').value,
        zip_code: document.getElementById('n-cp').value,
        city: document.getElementById('n-ville').value,
        country: document.getElementById('n-pays').value
    };

    const { error } = await supabaseClient.from('donors').insert([donor]);
    if (error) alert("Erreur : " + error.message);
    else { closeModal(); loadDonors(); }
}

// FICHE DOSSIER COMPLÈTE
async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <h2 style="margin:0">${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
            <p style="color:var(--gold); font-weight:bold; margin-top:5px;">${donor.entities || 'Aucune entité'}</p>
        </div>
        <div class="fiche-grid">
            <div class="luxe-form">
                <h3 class="section-title">Suivi Relationnel</h3>
                <label>Date dernier contact</label>
                <input type="date" value="${donor.last_contact_date || ''}" onchange="updateField('${id}', 'last_contact_date', this.value)">
                
                <label>Dernière action réalisée</label>
                <textarea onchange="updateField('${id}', 'last_action', this.value)">${donor.last_action || ''}</textarea>
                
                <label>Prochaine action à prévoir</label>
                <textarea onchange="updateField('${id}', 'next_action', this.value)">${donor.next_action || ''}</textarea>
                
                <label>Notes & Commentaires généraux</label>
                <textarea style="height:100px;" onchange="updateField('${id}', 'notes', this.value)">${donor.notes || ''}</textarea>
            </div>
            
            <div>
                <h3 class="section-title">Dons & Fiscalité</h3>
                <div style="max-height:350px; overflow-y:auto; padding-right:10px;">
                    ${donor.donations?.sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div class="donation-item">
                            <div style="display:flex; justify-content:space-between; font-weight:bold;">
                                <span>${don.amount.toLocaleString('fr-FR')} €</span>
                                <span style="font-weight:normal; font-size:0.8rem;">${new Date(don.date).toLocaleDateString()}</span>
                            </div>
                            <div style="font-size:0.8rem; margin:5px 0;">Reçu fiscal : ${don.tax_receipt_number || 'En attente'}</div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                                <span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                                ${don.thank_you_status === 'En attente' ? `<button class="btn-primary" style="padding:4px 8px; font-size:0.6rem;" onclick="markAsThanked('${don.id}', '${donor.id}')">Remercié</button>` : ''}
                            </div>
                        </div>
                    `).join('') || '<p>Aucun don enregistré.</p>'}
                </div>
                <button class="btn-primary" onclick="addDonation('${id}')" style="width:100%; margin-top:20px;">+ Enregistrer un don</button>
            </div>
        </div>`;
}

async function addDonation(donorId) {
    const amount = prompt("Montant du don (€) :");
    if (!amount || isNaN(amount)) return;
    const receipt = prompt("Numéro de reçu fiscal (si disponible) :");
    const comment = prompt("Commentaire sur le don :");

    await supabaseClient.from('donations').insert([{ 
        donor_id: donorId, 
        amount: parseFloat(amount), 
        tax_receipt_number: receipt,
        comment: comment
    }]);
    await loadDonors();
    openDonorFile(donorId);
}

async function updateField(id, field, value) {
    await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
}

async function markAsThanked(donId, donorId) {
    await supabaseClient.from('donations').update({ thank_you_status: 'Effectué' }).eq('id', donId);
    await loadDonors();
    openDonorFile(donorId);
}

function exportToExcel() {
    let csv = "Type;Nom;Prenom;Entites;Total Dons;Dernier Contact\n";
    allDonors.forEach(d => {
        const total = d.donations?.reduce((sum, don) => sum + don.amount, 0) || 0;
        csv += `${d.donor_type};${d.last_name};${d.first_name || ''};${d.entities || ''};${total};${d.last_contact_date || ''}\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "base_crm_alsatia.csv";
    link.click();
}

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('donors').select('*').not('next_action', 'is', null).limit(5);
    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="donation-item"><h4>Aucune action prévue</h4><p>Le carnet de suivi est vide.</p></div>';
        return;
    }
    feed.innerHTML = data.map(d => `<div class="donation-item"><h4>${d.last_name}</h4><p>À faire : ${d.next_action}</p></div>`).join('');
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }
window.onload = init;
