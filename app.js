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

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    document.getElementById(`nav-${tabName}`).classList.add('active');
    if(tabName === 'donors') loadDonors();
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
        const pending = d.donations?.filter(don => don.thank_you_status === 'En attente').length || 0;
        return `
        <tr>
            <td><strong>${d.last_name.toUpperCase()} ${d.first_name}</strong><br><small>${d.city || '-'}</small></td>
            <td><b>${total.toLocaleString('fr-FR')} €</b><br><small>${d.donations?.length || 0} don(s)</small></td>
            <td><span class="status-tag ${pending > 0 ? 'status-waiting' : 'status-done'}">${pending > 0 ? pending + ' à remercier' : 'À jour'}</span></td>
            <td><button class="btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="openDonorFile('${d.id}')">Dossier</button></td>
        </tr>`;
    }).join('');
}

function filterDonors() {
    const q = document.getElementById('search-input').value.toLowerCase();
    const filtered = allDonors.filter(d => 
        d.last_name.toLowerCase().includes(q) || d.first_name.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q)
    );
    renderDonors(filtered);
}

async function openDonorFile(id) {
    const donor = allDonors.find(d => d.id === id);
    document.getElementById('donor-modal').style.display = 'block';
    const body = document.getElementById('modal-body');
    
    body.innerHTML = `
        <div class="fiche-header">
            <h2 style="margin:0">${donor.first_name} ${donor.last_name.toUpperCase()}</h2>
            <p style="color:var(--gold); font-weight:bold; margin:5px 0 0 0;">${donor.entities}</p>
        </div>
        <div class="fiche-grid">
            <div class="info-perso luxe-form">
                <h3 class="section-title">Coordonnées</h3>
                <label>Email</label><input type="text" value="${donor.email || ''}" onchange="updateDonorField('${id}', 'email', this.value)">
                <label>Téléphone</label><input type="text" value="${donor.phone || ''}" onchange="updateDonorField('${id}', 'phone', this.value)">
                <label>Adresse Postale</label><textarea onchange="updateDonorField('${id}', 'address', this.value)">${donor.address || ''}</textarea>
                <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px;">
                    <div><label>CP</label><input type="text" value="${donor.zip_code || ''}" onchange="updateDonorField('${id}', 'zip_code', this.value)"></div>
                    <div><label>Ville</label><input type="text" value="${donor.city || ''}" onchange="updateDonorField('${id}', 'city', this.value)"></div>
                </div>
            </div>
            <div class="historique-dons">
                <h3 class="section-title">Historique des Dons</h3>
                <div id="donations-list" style="max-height:350px; overflow-y:auto; padding-right:10px;">
                    ${donor.donations?.sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div class="donation-item">
                            <div style="display:flex; justify-content:space-between; font-weight:bold;">
                                <span>${don.amount.toLocaleString('fr-FR')} €</span>
                                <span style="font-weight:normal; font-size:0.8rem;">${new Date(don.date).toLocaleDateString()}</span>
                            </div>
                            <div style="margin-top:5px; font-size:0.85rem; color:#666;">"${don.comment || 'Sans commentaire'}"</div>
                            <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                                <span class="status-tag ${don.thank_you_status === 'Effectué' ? 'status-done' : 'status-waiting'}">${don.thank_you_status}</span>
                                ${don.thank_you_status === 'En attente' ? `<button class="btn-primary" style="font-size:0.6rem; padding:4px 8px;" onclick="markAsThanked('${don.id}', '${donor.id}')">Marquer remercié</button>` : ''}
                            </div>
                        </div>
                    `).join('') || '<p>Aucun don.</p>'}
                </div>
                <button class="btn-primary" onclick="addDonation('${donor.id}')" style="width:100%; margin-top:20px;">+ Nouveau don</button>
            </div>
        </div>`;
}

async function addDonation(donorId) {
    const amount = prompt("Montant (€) :");
    if (!amount || isNaN(amount)) return;
    const comment = prompt("Commentaire :");
    await supabaseClient.from('donations').insert([{ donor_id: donorId, amount: parseFloat(amount), comment: comment }]);
    await loadDonors();
    openDonorFile(donorId);
}

async function markAsThanked(donId, donorId) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from('donations').update({ thank_you_status: 'Effectué', thanked_by: user.email }).eq('id', donId);
    await loadDonors();
    openDonorFile(donorId);
}

async function updateDonorField(id, field, value) {
    await supabaseClient.from('donors').update({ [field]: value }).eq('id', id);
}

function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    document.getElementById('modal-body').innerHTML = `
        <h2 class="section-title">Nouveau Donateur</h2>
        <form onsubmit="saveNewDonor(event)" class="luxe-form">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div><label>Nom</label><input type="text" id="n-nom" required></div>
                <div><label>Prénom</label><input type="text" id="n-pren" required></div>
            </div>
            <label>Établissement</label>
            <select id="n-eco"><option>Institut Alsatia</option><option>Cours Herrade</option><option>Collège Martin</option></select>
            <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;">Créer le dossier</button>
        </form>`;
}

async function saveNewDonor(e) {
    e.preventDefault();
    const donor = { last_name: document.getElementById('n-nom').value.trim(), first_name: document.getElementById('n-pren').value.trim(), entities: document.getElementById('n-eco').value };
    await supabaseClient.from('donors').insert([donor]);
    closeModal();
    loadDonors();
}

function exportToExcel() {
    let csv = "Nom;Prenom;Etablissement;Total Dons\n";
    allDonors.forEach(d => {
        const total = d.donations?.reduce((sum, don) => sum + don.amount, 0) || 0;
        csv += `${d.last_name};${d.first_name};${d.entities};${total}\n`;
    });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "base_alsatia.csv";
    link.click();
}

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name, first_name)').eq('thank_you_status', 'En attente').limit(5);
    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="donation-item"><h3>Tout est à jour</h3></div>';
        return;
    }
    feed.innerHTML = data.map(d => `<div class="donation-item"><h4>${d.donors.last_name}</h4><p>Don de ${d.amount}€ à remercier</p></div>`).join('');
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }
window.onload = init;
