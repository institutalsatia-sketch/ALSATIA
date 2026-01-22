const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
    document.getElementById('user-name').innerText = profile ? `${profile.first_name} ${profile.last_name}` : session.user.email;
    
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
    const { data: donors } = await supabaseClient.from('donors').select('*').order('last_name');
    const body = document.getElementById('donors-body');
    body.innerHTML = '';
    
    if (donors) {
        donors.forEach(d => {
            body.innerHTML += `
                <tr>
                    <td>
                        <div style="font-weight:600;">${d.last_name.toUpperCase()} ${d.first_name}</div>
                        <span class="contact-sub">📧 ${d.email || '-'}</span>
                        <span class="contact-sub">📞 ${d.phone || '-'}</span>
                    </td>
                    <td>
                        <div style="font-size:0.9rem;">${d.address || '-'}</div>
                        <div style="font-size:0.85rem; color:#64748b;">${d.zip_code || ''} ${d.city || ''}</div>
                    </td>
                    <td><span class="badge-entity">${d.entities || '-'}</span></td>
                    <td><button class="btn-primary" style="padding:5px 10px; font-size:0.7rem;" onclick="alert('Détails: ${d.id}')">Dossier</button></td>
                </tr>`;
        });
    }
}

function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    document.getElementById('modal-body').innerHTML = `
        <h2 style="font-family:'Playfair Display'; margin-bottom:25px;">Nouveau Donateur</h2>
        <form onsubmit="saveDonor(event)" class="luxe-form">
            <div class="grid-2">
                <div><label>Nom</label><input type="text" id="nom" required></div>
                <div><label>Prénom</label><input type="text" id="prenom" required></div>
            </div>
            <div class="grid-2">
                <div><label>Email</label><input type="email" id="email"></div>
                <div><label>Téléphone</label><input type="text" id="phone"></div>
            </div>
            <label>Adresse Postale</label>
            <input type="text" id="adresse" placeholder="N° et nom de rue">
            <div class="grid-2">
                <div><label>Code Postal</label><input type="text" id="cp"></div>
                <div><label>Ville</label><input type="text" id="ville"></div>
            </div>
            <label>Établissement Principal</label>
            <select id="ecole">
                <option value="Institut Alsatia">Institut Alsatia</option>
                <option value="Cours Herrade">Cours Herrade de Landsberg</option>
                <option value="Collège Martin">Collège Martin</option>
                <option value="Academia">Academia Alsatia</option>
            </select>
            <button type="submit" class="btn-primary" style="width:100%; margin-top:10px;">Enregistrer le contact</button>
        </form>`;
}

async function saveDonor(e) {
    e.preventDefault();
    const newDonor = {
        last_name: document.getElementById('nom').value.trim(),
        first_name: document.getElementById('prenom').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        address: document.getElementById('adresse').value.trim(),
        zip_code: document.getElementById('cp').value.trim(),
        city: document.getElementById('ville').value.trim(),
        entities: document.getElementById('ecole').value
    };
    const { error } = await supabaseClient.from('donors').insert([newDonor]);
    if (error) alert("Erreur d'enregistrement : " + error.message);
    else { closeModal(); loadDonors(); }
}

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('comments').select('*, donors(last_name)').eq('is_urgent', true).eq('status', 'open');
    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="urgent-card" style="border-left-color: #2ecc71"><h3>Réseau Alsatia</h3><p>Aucune alerte prioritaire aujourd\'hui.</p></div>';
        return;
    }
    feed.innerHTML = data.map(item => `<div class="urgent-card"><h3>${item.donors?.last_name || 'Donateur'}</h3><p>${item.content}</p><small>${item.entity}</small></div>`).join('');
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }
window.onload = init;
