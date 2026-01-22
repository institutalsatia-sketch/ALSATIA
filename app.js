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

async function loadDashboard() {
    const feed = document.getElementById('urgent-feed');
    const { data } = await supabaseClient.from('comments').select('*, donors(last_name)').eq('is_urgent', true).eq('status', 'open');
    
    if (!data || data.length === 0) {
        feed.innerHTML = '<div class="urgent-card" style="border-left-color: #2ecc71"><h3>Aucune urgence</h3><p>Le réseau est calme.</p></div>';
        return;
    }
    feed.innerHTML = '';
    data.forEach(item => {
        feed.innerHTML += `<div class="urgent-card"><h3>${item.donors?.last_name || 'Donateur'}</h3><p>${item.content}</p><small>${item.entity}</small></div>`;
    });
}

async function loadDonors() {
    const { data: donors } = await supabaseClient.from('donors').select('*').order('last_name');
    const body = document.getElementById('donors-body');
    body.innerHTML = donors ? donors.map(d => `<tr><td>${d.last_name} ${d.first_name}</td><td>${d.entities || '-'}</td><td>${d.city || '-'}</td><td><button onclick="alert('ID: ${d.id}')">Détails</button></td></tr>`).join('') : '';
}

function showDonorModal() {
    document.getElementById('donor-modal').style.display = 'block';
    document.getElementById('modal-body').innerHTML = `
        <h3>Nouveau Donateur</h3>
        <form onsubmit="saveDonor(event)" class="luxe-form">
            <input type="text" id="nom" placeholder="Nom" required>
            <input type="text" id="prenom" placeholder="Prénom" required>
            <input type="text" id="ville" placeholder="Ville">
            <select id="ecole">
                <option value="Institut Alsatia">Institut Alsatia</option>
                <option value="Cours Herrade">Cours Herrade</option>
                <option value="Collège Martin">Collège Martin</option>
            </select>
            <button type="submit" class="btn-primary">Enregistrer</button>
        </form>`;
}

async function saveDonor(e) {
    e.preventDefault();
    const newDonor = {
        last_name: document.getElementById('nom').value,
        first_name: document.getElementById('prenom').value,
        city: document.getElementById('ville').value,
        entities: document.getElementById('ecole').value // On envoie juste la valeur texte
    };
    const { error } = await supabaseClient.from('donors').insert([newDonor]);
    if (error) {
        console.error("Erreur détaillée:", error);
        alert("Erreur d'enregistrement : " + error.message);
    } else { 
        closeModal(); 
        loadDonors(); 
    }
}

function closeModal() { document.getElementById('donor-modal').style.display = 'none'; }
async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }

window.onload = init;
