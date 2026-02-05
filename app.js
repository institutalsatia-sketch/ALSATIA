/**
 * CRM & CHAT PRO ALSATIA - V19 (SUJETS DYNAMIQUES)
 */
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
const ENTITIES = ["Institut Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin", "Academia Alsatia"];

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'chat') { loadSubjects(); loadChatMessages(); }
    if(id === 'donors') loadDonors();
    if(id === 'campaigns') loadCampaigns();
    if(id === 'events') loadEvents();
};
window.closeModal = () => document.getElementById('donor-modal').style.display = 'none';
window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;
    setupChatMentions(); loadDonors(); listenChat();
    if(document.getElementById('tab-chat').classList.contains('active')) loadSubjects();
});

// ========================== CHAT PRO (MODIF/SUPPR/SUJETS DYNAMIQUES) ==========================
async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    const currentVal = select.value || 'Général';
    select.innerHTML = (data || []).map(s => `<option value="${s.name}" ${s.name === currentVal ? 'selected' : ''}># ${s.name}</option>`).join('');
}

window.createNewSubject = async () => {
    const name = prompt("Nom du nouveau sujet :");
    if (name) {
        await supabaseClient.from('chat_subjects').insert([{ name: name.trim() }]);
        loadSubjects();
    }
};

function setupChatMentions() {
    const input = document.getElementById('chat-input');
    const suggest = document.getElementById('mention-suggestions');
    if(!input) return;
    input.addEventListener('input', (e) => {
        const val = e.target.value; const lastAt = val.lastIndexOf('@');
        if (lastAt !== -1 && lastAt === val.length - 1) {
            suggest.innerHTML = ENTITIES.map(e => `<div class="mention-item" onclick="insertMention('${e.split(' ')[0]}')">@${e}</div>`).join('');
            suggest.style.display = 'block';
        } else if (!val.includes('@')) { suggest.style.display = 'none'; }
    });
}
window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    input.value += name + " "; document.getElementById('mention-suggestions').style.display = 'none'; input.focus();
};

async function loadChatMessages() {
    const subject = document.getElementById('chat-subject-filter').value;
    if(!subject) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subject).order('created_at', { ascending: true });
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
        return `<div class="message ${isMe ? 'my-msg' : ''}" id="msg-${m.id}">
            <small><strong>${m.author_name} ${m.author_last_name || ''}</strong> (${m.portal})</small>
            <p id="txt-${m.id}" style="margin:5px 0 0 0;">${content}</p>
            ${isMe ? `<div class="msg-actions">
                <span onclick="editMessage('${m.id}', '${m.content.replace(/'/g, "\\'")}')">Modifier</span>
                <span onclick="deleteMessage('${m.id}')" style="color:#ef4444;">Supprimer</span>
            </div>` : ''}
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const editId = document.getElementById('editing-msg-id').value;
    const subject = document.getElementById('chat-subject-filter').value;
    if (!input.value.trim()) return;

    if (editId) {
        await supabaseClient.from('chat_global').update({ content: input.value }).eq('id', editId);
        document.getElementById('editing-msg-id').value = "";
        document.getElementById('btn-chat-send').innerText = "Envoyer";
    } else {
        let recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
        ENTITIES.forEach(ent => { if(input.value.includes('@' + ent.split(' ')[0])) recips.push(ent); });
        await supabaseClient.from('chat_global').insert([{ 
            content: input.value, author_name: currentUser.first_name, author_last_name: currentUser.last_name,
            portal: currentUser.portal, recipients: recips.length > 0 ? [...new Set(recips)] : null, subject: subject
        }]);
    }
    input.value = '';
    document.querySelectorAll('.target-check').forEach(c => c.checked = false);
    loadChatMessages();
};

window.deleteMessage = async (id) => {
    if(confirm("Supprimer ce message pour tout le monde ?")) {
        await supabaseClient.from('chat_global').delete().eq('id', id);
        loadChatMessages();
    }
};

window.editMessage = (id, oldContent) => {
    document.getElementById('chat-input').value = oldContent;
    document.getElementById('editing-msg-id').value = id;
    document.getElementById('btn-chat-send').innerText = "Mettre à jour";
    document.getElementById('chat-input').focus();
};

function listenChat() { supabaseClient.channel('chat_updates').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, () => { loadChatMessages(); }).subscribe(); }

// ========================== CRM & AUTRES (INCHANGÉ) ==========================
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
    const list = document.getElementById('donors-list'); if (!list) return;
    list.innerHTML = data.map(d => {
        const total = (d.donations || []).reduce((s, n) => s + Number(n.amount || 0), 0);
        const hasP = (d.donations || []).some(don => !don.thanked);
        const identity = d.company_name ? `🏢 <strong>${d.company_name}</strong><br><small>${d.last_name} ${d.first_name||''}</small>` : `<strong>${d.last_name.toUpperCase()}</strong> ${d.first_name || ''}`;
        return `<tr class="${hasP ? 'blink-warning' : ''}"><td style="padding:15px;">${identity}</td><td>${d.entities}</td><td style="color:var(--gold);"><strong>${total}€</strong></td><td><button onclick="openDonorFile('${d.id}')" class="btn-sm">Ouvrir</button></td></tr>`;
    }).join('');
}
window.filterDonors = () => {
    const v = document.getElementById('search-donor').value.toLowerCase();
    renderDonorsTable(allDonorsData.filter(d => (d.last_name||"").toLowerCase().includes(v) || (d.company_name||"").toLowerCase().includes(v)));
};
window.openNewDonorModal = () => {
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `<h2>⚜️ Nouveau Donateur</h2><input type="text" id="n-comp" class="luxe-input" placeholder="Entreprise"><input type="text" id="n-lname" class="luxe-input" placeholder="Nom *"><input type="text" id="n-fname" class="luxe-input" placeholder="Prénom"><button onclick="handleNewDonor()" class="btn-save" style="width:100%; margin-top:15px; background:var(--gold);">Créer</button>`;
};
window.handleNewDonor = async () => {
    const ln = document.getElementById('n-lname').value.trim(); if(!ln) return;
    await supabaseClient.from('donors').insert([{ last_name: ln, first_name: document.getElementById('n-fname').value, company_name: document.getElementById('n-comp').value, entities: currentUser.portal }]);
    closeModal(); loadDonors();
};
window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    document.getElementById('donor-modal').style.display = 'flex';
    document.getElementById('donor-detail-content').innerHTML = `<h3>${d.last_name}</h3><div style="margin-top:20px;"><input type="number" id="d-amt" placeholder="Montant" class="luxe-input"><button onclick="addDonation('${d.id}')" class="btn-save">+ Ajouter don</button></div>`;
};
window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value; if(!amt) return;
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: amt, date: new Date().toISOString().split('T')[0], thanked: false }]);
    openDonorFile(id); loadDonors();
};
async function loadCampaigns() {
    const { data } = await supabaseClient.from('campaigns').select('*');
    document.getElementById('campaigns-list').innerHTML = (data || []).map(c => `<div class="event-card"><h3>${c.name}</h3><p>${c.goal_amount}€</p></div>`).join('');
}
window.loadEvents = async () => {
    const { data } = await supabaseClient.from('events').select('*');
    document.getElementById('events-grid').innerHTML = (data || []).map(ev => `<div class="event-card"><h3>${ev.title}</h3></div>`).join('');
}
