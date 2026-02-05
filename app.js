/**
 * CRM & CHAT PRO ALSATIA - V17 FINAL
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];
const METHODS = ["Virement", "Chèque", "Espèces", "CB", "Prélèvement"];

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'chat') loadChatMessages();
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
};
window.closeModal = () => document.getElementById('donor-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    setupChatMentions();
    loadDonors();
    listenChat();
});

// ========================== CHAT PRO & MENTIONS ==========================
function setupChatMentions() {
    const input = document.getElementById('chat-input');
    const suggest = document.getElementById('mention-suggestions');
    if(!input) return;

    input.addEventListener('input', (e) => {
        const val = e.target.value;
        const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === val.length - 1) {
            const list = ENTITIES.map(e => `<div class="mention-item" onclick="insertMention('${e.split(' ')[0]}')">@${e}</div>`).join('');
            suggest.innerHTML = list;
            suggest.style.display = 'block';
        } else if (!val.includes('@')) {
            suggest.style.display = 'none';
        }
    });
}

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    input.value += name + " ";
    document.getElementById('mention-suggestions').style.display = 'none';
    input.focus();
};

async function loadChatMessages() {
    const { data } = await supabaseClient.from('chat_global').select('*').order('created_at', { ascending: true });
    const box = document.getElementById('chat-box');
    if (!box || !data) return;

    const filtered = data.filter(m => {
        if (m.portal === "Institut Alsatia") return true;
        if (m.author_name === currentUser.first_name && m.author_last_name === currentUser.last_name) return true;
        if (m.recipients && m.recipients.includes(currentUser.portal)) return true;
        if (m.portal === currentUser.portal && (!m.recipients || m.recipients.length === 0)) return true;
        return false;
    });

    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name && m.author_last_name === currentUser.last_name;
        const content = m.content.replace(/@\w+/g, '<span style="color:var(--gold); font-weight:bold;">$&</span>');
        return `<div class="message ${isMe ? 'my-msg' : ''}" style="${m.portal === 'Institut Alsatia' && !isMe ? 'border-left:4px solid var(--gold)' : ''}">
            <small><strong>${m.author_name} ${m.author_last_name || ''}</strong> (${m.portal})</small>
            <p style="margin:5px 0 0 0;">${content}</p>
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;

    let recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
    // Auto-detection mentions
    ENTITIES.forEach(ent => { if(input.value.includes('@' + ent.split(' ')[0])) recips.push(ent); });

    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, 
        author_name: currentUser.first_name, 
        author_last_name: currentUser.last_name,
        portal: currentUser.portal,
        recipients: recips.length > 0 ? [...new Set(recips)] : null
    }]);
    input.value = '';
    document.querySelectorAll('.target-check').forEach(c => c.checked = false);
    loadChatMessages();
};

function listenChat() { supabaseClient.channel('chat_updates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, () => { loadChatMessages(); }).subscribe(); }

// ========================== CRM (BASE DONATEURS) ==========================
async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonorsTable(allDonorsData);
    if(currentUser.portal === "Institut Alsatia") {
        const pending = allDonorsData.filter(d => (d.donations || []).some(don => !don.thanked)).length;
        document.getElementById('pending-thanks-alert').innerHTML = pending > 0 ? `<div class="thanks-pending">⚠️ ${pending} donateur(s) en attente de remerciement.</div>` : "";
    }
}

function renderDonorsTable(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        const hasPending = (d.donations || []).some(don => !don.thanked);
        const identity = d.company_name ? `🏢 <strong>${d.company_name}</strong><br><small>${d.last_name} ${d.first_name || ''}</small>` : `<strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}`;
        return `<tr class="${hasPending ? 'blink-warning' : ''}">
            <td style="padding:15px;">${identity}</td>
            <td><span class="btn-sm">${d.entities || 'Alsatia'}</span></td>
            <td style="color:var(--gold);"><strong>${total} €</strong></td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    renderDonorsTable(allDonorsData.filter(d => (d.last_name||"").toLowerCase().includes(v) || (d.company_name||"").toLowerCase().includes(v)));
};

window.openNewDonorModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h2>⚜️ Nouveau Donateur</h2>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <input type="text" id="n-comp" class="luxe-input" placeholder="Entreprise (Optionnel)">
                <input type="text" id="n-lname" class="luxe-input" placeholder="Nom *">
                <input type="text" id="n-fname" class="luxe-input" placeholder="Prénom">
                <select id="n-ent" class="luxe-input">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
            </div>
            <button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:20px; background:var(--gold);">Créer la fiche</button>
        </div>`;
};

window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim();
    if(!ln) return;
    await supabaseClient.from('donors').insert([{ last_name: ln, first_name: document.getElementById('n-fname').value, company_name: document.getElementById('n-comp').value, entities: document.getElementById('n-ent').value, last_modified_by: currentUser.last_name }]);
    closeModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <header style="display:flex; justify-content:space-between; margin-bottom:20px;">
                <h3>${d.company_name || d.last_name.toUpperCase()}</h3>
                <button onclick="closeModal()" class="btn-sm">Fermer</button>
            </header>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; background:#f8fafc; padding:15px; border-radius:10px;">
                <div><label>Email</label><input type="text" id="e-mail" value="${d.email||''}" class="luxe-input"></div>
                <div><label>Adresse</label><input type="text" id="e-addr" value="${d.address||''}" class="luxe-input"></div>
            </div>
            <div style="margin-top:20px;">
                <h4 style="color:var(--gold);">Dons reçus</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; margin-bottom:15px;">
                    <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
                    <input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input">
                    <input type="text" id="d-tax" placeholder="N° Reçu" class="luxe-input">
                    <button onclick="addDonation('${d.id}')" class="btn-save" style="background:var(--gold);">+</button>
                </div>
                <table style="width:100%; font-size:0.8rem;">
                    ${(d.donations || []).map(don => `
                        <tr style="background:${!don.thanked?'#fff5f5':'none'}; border-bottom:1px solid #eee;">
                            <td>${don.date}</td><td>${don.amount}€</td><td>Reçu: ${don.fiscal_receipt_id||'-'}</td>
                            <td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateDonation('${don.id}','${d.id}','thanked',this.checked)"> Merci</td>
                            <td><button onclick="deleteDonation('${don.id}','${d.id}')" style="border:none; color:red; cursor:pointer;">🗑️</button></td>
                        </tr>`).join('')}
                </table>
            </div>
            <button onclick="saveDonor('${d.id}')" class="btn-save" style="width:100%; margin-top:20px; background:var(--primary);">Sauvegarder</button>
        </div>`;
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt, date: document.getElementById('d-date').value, fiscal_receipt_id: document.getElementById('d-tax').value, thanked: false }]);
    openDonorFile(id); loadDonors();
};

window.updateDonation = async (donId, donorId, field, value) => {
    const upd = {}; upd[field] = value;
    await supabaseClient.from('donations').update(upd).eq('id', donId);
    loadDonors();
};

window.deleteDonation = async (donId, donorId) => {
    if(confirm("Supprimer ce don ?")) { await supabaseClient.from('donations').delete().eq('id', donId); openDonorFile(donorId); loadDonors(); }
};

window.saveDonor = async (id) => {
    await supabaseClient.from('donors').update({ email: document.getElementById('e-mail').value, address: document.getElementById('e-addr').value }).eq('id', id);
    closeModal(); loadDonors();
};

// ========================== CAMPAGNES & ÉVÉNEMENTS ==========================
async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*').order('created_at', { ascending: false });
    document.getElementById('campaigns-list').innerHTML = (data || []).map(c => `
        <div class="event-card">
            <small>${c.target_entity}</small><h3>${c.name}</h3>
            <p>Objectif: <strong>${c.goal_amount}€</strong></p>
        </div>`).join('');
}

window.openNewCampaignModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche">
            <h2>Nouvelle Campagne</h2>
            <input type="text" id="c-name" class="luxe-input" placeholder="Nom">
            <select id="c-ent" class="luxe-input" style="margin:10px 0;">${ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('')}</select>
            <input type="number" id="c-goal" class="luxe-input" placeholder="Objectif €">
            <button onclick="handleNewCampaign()" class="btn-save" style="width:100%; margin-top:15px; background:var(--gold);">Lancer</button>
        </div>`;
};

window.handleNewCampaign = async () => {
    await supabaseClient.from('campaigns').insert([{ name: document.getElementById('c-name').value, target_entity: document.getElementById('c-ent').value, goal_amount: document.getElementById('c-goal').value }]);
    closeModal(); loadCampaigns();
};

window.loadEvents = async () => {
    const { data } = await supabaseClient.from('events').select('*').order('start_date');
    document.getElementById('events-grid').innerHTML = (data || []).map(ev => `<div class="event-card">📅 ${ev.start_date}<h3>${ev.title}</h3><p>📍 ${ev.location}</p></div>`).join('');
};

window.openNewEventModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `
        <div class="pro-fiche"><h2>Nouvel Événement</h2><input type="text" id="ev-title" class="luxe-input"><input type="date" id="ev-date" class="luxe-input" style="margin:10px 0;"><button onclick="handleNewEvent()" class="btn-save">Publier</button></div>`;
};

window.handleNewEvent = async () => {
    await supabaseClient.from('events').insert([{ title: document.getElementById('ev-title').value, start_date: document.getElementById('ev-date').value, organizer_entity: currentUser.portal }]);
    closeModal(); loadEvents();
};
