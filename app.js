const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];

// EXPOSITION
window.switchTab = switchTab;
window.openDonorFile = openDonorFile;
window.addDonation = addDonation;
window.updateDonorInfo = updateDonorInfo;
window.openNewDonorModal = openNewDonorModal;
window.handleNewDonor = handleNewDonor;
window.closeModal = closeModal;
window.sendGlobalMessage = sendGlobalMessage;
window.updateTaxReceipt = updateTaxReceipt;

async function init() {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    loadAllData();
}

async function loadAllData() {
    await loadDonors();
    await loadDashboard();
}

// NAVIGATION
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`nav-${tabId}`).classList.add('active');
    if(tabId === 'chat') loadGlobalChat();
}

// LOGIQUE DONATEURS
async function loadDonors() {
    let query = supabaseClient.from('donors').select('*, donations(*)');
    if (currentUser.portal !== 'Institut Alsatia') {
        const key = currentUser.portal.split(' ')[1];
        query = query.ilike('entities', `%${key}%`);
    }
    const { data } = await query.order('last_name');
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const lastReceipt = d.donations?.find(don => don.tax_receipt_id)?.tax_receipt_id || '---';
        return `<tr>
            <td><strong>${d.last_name}</strong> ${d.first_name || ''}</td>
            <td><small>${d.entities}</small></td>
            <td>${total}€</td>
            <td><code style="background:#eee;padding:2px 5px;">${lastReceipt}</code></td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-primary">Gérer</button></td>
        </tr>`;
    }).join('');
}

// DOSSIER COMPLET & ÉDITION
async function openDonorFile(id) {
    const modal = document.getElementById('donor-modal');
    const content = document.getElementById('donor-detail-content');
    modal.style.display = 'block';
    
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*), messages(*)').eq('id', id).single();
    const isAlsatia = currentUser.portal === 'Institut Alsatia';

    content.innerHTML = `
        <div class="grid-2">
            <div>
                <h3>Fiche Identité ${isAlsatia ? '(Édition Admin)' : ''}</h3>
                <input type="text" id="edit-lname" value="${d.last_name}" class="luxe-input" ${!isAlsatia ? 'readonly' : ''} placeholder="Nom">
                <input type="text" id="edit-fname" value="${d.first_name || ''}" class="luxe-input" ${!isAlsatia ? 'readonly' : ''} placeholder="Prénom">
                <input type="text" id="edit-email" value="${d.email || ''}" class="luxe-input" ${!isAlsatia ? 'readonly' : ''} placeholder="Email">
                <input type="text" id="edit-phone" value="${d.phone || ''}" class="luxe-input" ${!isAlsatia ? 'readonly' : ''} placeholder="Téléphone">
                <input type="text" id="edit-entities" value="${d.entities || ''}" class="luxe-input" ${!isAlsatia ? 'readonly' : ''} placeholder="Entités">
                ${isAlsatia ? `<button onclick="updateDonorInfo('${d.id}')" class="btn-primary" style="width:100%">Mettre à jour la fiche</button>` : ''}
                
                <h3 style="margin-top:20px;">Historique des Dons</h3>
                <div style="max-height:200px; overflow-y:auto; border:1px solid #eee; padding:10px;">
                    ${d.donations.map(don => `
                        <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:0.8rem; border-bottom:1px solid #f1f1f1; padding-bottom:5px;">
                            <span>${don.date} : <strong>${don.amount}€</strong></span>
                            <div style="display:flex; gap:5px;">
                                <input type="text" placeholder="N° Reçu" id="receipt-${don.id}" value="${don.tax_receipt_id || ''}" style="width:80px; font-size:0.7rem;">
                                <button onclick="updateTaxReceipt('${don.id}', '${d.id}')" style="font-size:0.6rem;">💾</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div>
                <h3>Nouveau Don</h3>
                <div class="card" style="margin-bottom:20px;">
                    <input type="number" id="new-don-amt" class="luxe-input" placeholder="Montant €">
                    <button onclick="addDonation('${d.id}')" class="btn-primary" style="width:100%">Enregistrer le don</button>
                </div>
                <h3>Notes de suivi</h3>
                <div id="donor-notes" style="height:200px; overflow-y:auto; background:#f9f9f9; padding:10px; margin-bottom:10px;">
                    ${d.messages?.map(m => `<p style="font-size:0.8rem; border-bottom:1px solid #eee; margin-bottom:5px;"><strong>${m.author_name}:</strong> ${m.content}</p>`).join('')}
                </div>
                <input type="text" id="donor-note-input" class="luxe-input" placeholder="Ajouter une note...">
                <button onclick="sendDonorMessage('${d.id}')" class="btn-primary" style="width:100%">Ajouter Note</button>
            </div>
        </div>
    `;
}

// ACTIONS DE MISE À JOUR
async function updateDonorInfo(id) {
    const upd = {
        last_name: document.getElementById('edit-lname').value,
        first_name: document.getElementById('edit-fname').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        entities: document.getElementById('edit-entities').value
    };
    await supabaseClient.from('donors').update(upd).eq('id', id);
    showToast("Fiche mise à jour");
    loadDonors();
}

async function updateTaxReceipt(donId, donorId) {
    const val = document.getElementById(`receipt-${donId}`).value;
    await supabaseClient.from('donations').update({ tax_receipt_id: val, thank_you_status: 'Effectué' }).eq('id', donId);
    showToast("N° Reçu enregistré");
    openDonorFile(donorId);
}

async function addDonation(id) {
    const amt = document.getElementById('new-don-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt }]);
    openDonorFile(id);
    loadAllData();
}

// DASHBOARD & UTILS
async function loadDashboard() {
    const { data } = await supabaseClient.from('donations').select('*, donors(last_name)').is('tax_receipt_id', null).limit(5);
    const feed = document.getElementById('urgent-donations-feed');
    if(feed) feed.innerHTML = data?.map(d => `<div class="donation-item">${d.donors?.last_name} : ${d.amount}€ <button onclick="openDonorFile('${d.donor_id}')" style="font-size:0.6rem;">Émettre</button></div>`).join('') || "Tout est à jour !";
}

function openNewDonorModal() {
    const modal = document.getElementById('donor-modal');
    modal.style.display = 'block';
    document.getElementById('donor-detail-content').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <input type="text" id="n-lname" placeholder="Nom / Raison Sociale" class="luxe-input">
        <input type="text" id="n-entities" placeholder="Entités" class="luxe-input" value="${currentUser.portal}">
        <button onclick="handleNewDonor()" class="btn-primary" style="width:100%">Créer le dossier</button>
    `;
}

async function handleNewDonor() {
    const ln = document.getElementById('n-lname').value;
    const ent = document.getElementById('n-entities').value;
    await supabaseClient.from('donors').insert([{ last_name: ln, entities: ent }]);
    closeModal('donor-modal');
    loadDonors();
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function showToast(m) { const t = document.getElementById('toast-notification'); t.innerText = m; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2000); }
window.onload = init;
