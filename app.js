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
            <td><b>${total.toLocaleString('fr-FR')} €</b></td>
            <td><small>Dernier contact: ${d.last_contact_date || 'Jamais'}</small></td>
            <td><button class="btn-primary" onclick="openDonorFile('${d.id}')">Dossier</button></td>
        </tr>`;
    }).join('');
}

// FORMULAIRE DE CRÉATION / ÉDITION
function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    renderDonorForm();
}

function renderDonorForm(type = 'Particulier') {
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <h2 class="section-title">Nouveau Dossier</h2>
        <div style="margin-bottom:20px;">
            <button class="btn-export" onclick="renderDonorForm('Particulier')">👨 Particulier</button>
            <button class="btn-export" onclick="renderDonorForm('Entreprise')">🏢 Entreprise</button>
        </div>
        <form onsubmit="saveNewDonor(event, '${type}')" class="luxe-form">
            <div class="grid-2">
                <div><label>${type === 'Entreprise' ? 'Nom de l\'entreprise' : 'Nom'}</label><input type="text" id="n-nom" required></div>
                ${type === 'Particulier' ? '<div><label>Prénom</label><input type="text" id="n-pren" required></div>' : ''}
            </div>
            
            <label>Entités concernées (cumulables)</label>
            <div style="font-size:0.8rem; margin-bottom:15px;">
                <input type="checkbox" name="entite" value="Alsatia"> Institut Alsatia 
                <input type="checkbox" name="entite" value="Herrade"> Cours Herrade 
                <input type="checkbox" name="entite" value="Martin"> Collège Martin
            </div>

            <div class="grid-2">
                <div><label>Type / Catégorie</label><input type="text" id="n-cat" placeholder="ex: Parent, Ami, Mécène..."></div>
                <div><label>Introduit par</label><input type="text" id="n-intro"></div>
            </div>

            <div class="grid-2">
                <div><label>Email</label><input type="email" id="n-email"></div>
                <div><label>Téléphone</label><input type="text" id="n-tel"></div>
            </div>

            <label>Adresse Postale</label>
            <input type="text" id="n-adr" placeholder="Rue">
            <div style="display:grid; grid-template-columns:1fr 2fr 1fr; gap:10px;">
                <input type="text" id="n-cp" placeholder="CP">
                <input type="text" id="n-ville" placeholder="Ville">
                <input type="text" id="n-pays" value="France">
            </div>

            <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;">Créer le dossier ${type}</button>
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

    await supabaseClient.from('donors').insert([donor]);
    closeModal();
    loadDonors();
}

// OUVERTURE DU DOSSIER COMPLET (ÉDITION + DONS)
async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <h2>${donor.first_name || ''} ${donor.last_name.toUpperCase()}</h2>
            <p>Type: ${donor.category || 'Non classé'} | Via: ${donor.introduced_by || 'Direct'}</p>
        </div>
        <div class="fiche-grid">
            <div class="luxe-form">
                <h3 class="section-title">Suivi & Actions</h3>
                <label>Date dernier contact</label>
                <input type="date" value="${donor.last_contact_date || ''}" onchange="updateField('${id}', 'last_contact_date', this.value)">
                <label>Dernière action</label>
                <textarea onchange="updateField('${id}', 'last_action', this.value)">${donor.last_action || ''}</textarea>
                <label>Prochaine action</label>
                <textarea onchange="updateField('${id}', 'next_action', this.value)">${donor.next_action || ''}</textarea>
                <label>Notes / Commentaires</label>
                <textarea style="height:100px;" onchange="updateField('${id}', 'notes', this.value)">${donor.notes || ''}</textarea>
            </div>
            <div>
                <h3 class="section-title">Historique des Dons</h3>
                <div style="max-height:300px; overflow-y:auto;">
                    ${donor.donations?.map(don => `
                        <div class="donation-item">
                            <b>${don.amount} €</b> (${new Date(don.date).getFullYear()})
                            <br><small>Reçu n°: ${don.tax_receipt_number || 'S/N'}</small>
                            <br><span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                        </div>
                    `).join('') || 'Aucun don'}
                </div>
                <button class="btn-primary" onclick="addDonation('${id}')" style="width:100%; margin-top:10px;">+ Ajouter un don</button>
            </div>
        </div>`;
}

async function addDonation(donorId) {
    const amount = prompt("Montant (€) :");
    const receipt = prompt("Numéro de reçu fiscal (optionnel) :");
    if (amount) {
        await supabaseClient.from('donations').insert([{ 
            donor_id: donorId, 
            amount: parseFloat(amount), 
            tax_receipt_number: receipt 
        }]);
        loadDonors().then(() => openDonorFile(donorId));
    }
}

async function updateField(id, field, value) {
    await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
function switchTab(t) { /* logique onglets habituelle */ }
window.onload = init;
