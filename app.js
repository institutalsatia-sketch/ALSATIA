const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let selectedFile = null;

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { window.location.href = 'login.html'; return; }
    document.getElementById('entity-logo-container').innerHTML = `<img src="${LOGOS[currentUser.portal] || 'logo_alsatia.png'}" class="entity-logo">`;
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = currentUser.portal;

    if (currentUser.portal === "Institut Alsatia") {
        const nav = document.getElementById('main-nav');
        if (!document.getElementById('nav-donors')) {
            const li = document.createElement('li');
            li.id = "nav-donors"; li.innerHTML = `<i data-lucide="users"></i> Base Donateurs`;
            li.onclick = () => switchTab('donors');
            nav.insertBefore(li, nav.children[1]);
        }
    }
    lucide.createIcons();
    listenRealtime();
    loadSubjects();
});

window.switchTab = (id) => {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(`tab-${id}`).classList.add('active');
    if(document.getElementById(`nav-${id}`)) document.getElementById(`nav-${id}`).classList.add('active');
    if(id === 'donors') loadDonors();
    if(id === 'chat') loadChatMessages();
    lucide.createIcons();
};

window.logout = () => { localStorage.clear(); window.location.href = 'login.html'; };
window.closeCustomModal = () => { document.getElementById('custom-modal').style.display = 'none'; };

// ========================== CRM & EXPORTS EXCEL ==========================

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name', { ascending: true });
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        const displayName = d.company_name ? `<b>${d.company_name}</b> <br><small>${d.last_name}</small>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td>${displayName}</td>
            <td><span class="portal-tag" style="background:#eee; color:#333; opacity:1;">${d.origin || '-'}</span></td>
            <td><small>${d.notes ? d.notes.substring(0,30) + '...' : '-'}</small></td>
            <td style="color:var(--gold); font-weight:800;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold" style="padding:6px 12px; font-size:0.8rem;">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.filterDonors = () => {
    const search = document.getElementById('search-donor').value.toLowerCase();
    const entity = document.getElementById('filter-entity').value;
    const filtered = allDonorsData.filter(d => {
        const matchesSearch = (d.last_name||'').toLowerCase().includes(search) || (d.city||'').toLowerCase().includes(search) || (d.company_name||'').toLowerCase().includes(search);
        const matchesEntity = (entity === "ALL" || d.entities === entity || d.origin === entity);
        return matchesSearch && matchesEntity;
    });
    renderDonors(filtered);
};

// FONCTIONS EXPORT EXCEL
window.exportAllDonors = () => {
    const exportData = allDonorsData.map(d => ({
        "Entreprise": d.company_name || "",
        "Nom": d.last_name,
        "Prénom": d.first_name || "",
        "Email": d.email || "",
        "Téléphone": d.phone || "",
        "Adresse": d.address || "",
        "CP": d.zip_code || "",
        "Ville": d.city || "",
        "Origine/Entité": d.origin || d.entities || "",
        "Total Dons": d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0,
        "Notes": d.notes || ""
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Donateurs");
    XLSX.writeFile(wb, "Base_Donateurs_Alsatia.xlsx");
};

window.exportFilteredDonors = () => {
    const entity = document.getElementById('filter-entity').value;
    const search = document.getElementById('search-donor').value.toLowerCase();
    const data = allDonorsData.filter(d => (entity === "ALL" || d.origin === entity) && (d.last_name||'').toLowerCase().includes(search));
    const exportData = data.map(d => ({ "Nom": d.last_name, "Prénom": d.first_name, "Ville": d.city, "Total": d.donations?.reduce((s, n) => s + Number(n.amount), 0) }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Filtre");
    XLSX.writeFile(wb, `Export_${entity}.xlsx`);
};

window.exportSingleDonor = (id) => {
    const d = allDonorsData.find(x => x.id === id);
    if(!d) return;
    const exportData = d.donations.map(don => ({
        "Date": don.date,
        "Montant (€)": don.amount,
        "Mode": don.payment_mode,
        "Remercié": don.thanked ? "OUI" : "NON"
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique_Dons");
    XLSX.writeFile(wb, `Dons_${d.last_name}.xlsx`);
};

// ========================== GESTION FICHE & DONS ==========================

window.openNewDonorModal = () => {
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h2 style="color:var(--primary);">Nouveau Donateur</h2>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:20px;">
            <input type="text" id="n-company" class="luxe-input" placeholder="Nom Entreprise" style="grid-column: span 2;">
            <input type="text" id="n-last" class="luxe-input" placeholder="Nom de famille *">
            <input type="text" id="n-first" class="luxe-input" placeholder="Prénom">
            <input type="text" id="n-origin" class="luxe-input" placeholder="Lien/Origine" style="grid-column: span 2;">
        </div>
        <button onclick="execCreateDonor()" class="btn-gold" style="width:100%; margin-top:20px; justify-content:center;">Enregistrer</button>
    `;
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-last').value;
    if(!last) return;
    await supabaseClient.from('donors').insert([{ last_name: last, first_name: document.getElementById('n-first').value, company_name: document.getElementById('n-company').value, origin: document.getElementById('n-origin').value }]);
    closeCustomModal(); loadDonors();
};

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const modal = document.getElementById('custom-modal');
    modal.style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:15px;">
            <h2>${d.company_name || d.last_name}</h2>
            <div style="display:flex; gap:10px;">
                <button onclick="exportSingleDonor('${d.id}')" class="btn-gold" style="background:#107c10; font-size:0.7rem;"><i data-lucide="download"></i> Excel</button>
                <button onclick="closeCustomModal()" class="btn-gold">Fermer</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-top:20px;">
            <div>
                <label class="mini-label">Entreprise</label><input type="text" id="e-company" value="${d.company_name||''}" class="luxe-input">
                <label class="mini-label">Nom / Prénom</label>
                <div style="display:flex; gap:5px;"><input type="text" id="e-last" value="${d.last_name||''}" class="luxe-input"><input type="text" id="e-first" value="${d.first_name||''}" class="luxe-input"></div>
                <label class="mini-label">Email</label><input type="text" id="e-email" value="${d.email||''}" class="luxe-input">
            </div>
            <div>
                <label class="mini-label">Adresse</label><input type="text" id="e-addr" value="${d.address||''}" class="luxe-input">
                <div style="display:flex; gap:5px;"><input type="text" id="e-cp" placeholder="CP" value="${d.zip_code||''}" class="luxe-input" style="width:80px;"><input type="text" id="e-ville" placeholder="Ville" value="${d.city||''}" class="luxe-input"></div>
                <label class="mini-label">Notes</label><textarea id="e-notes" class="luxe-input" style="height:60px;">${d.notes||''}</textarea>
            </div>
        </div>
        <h3 style="color:var(--gold); margin-top:15px;">Saisir un Don</h3>
        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap:8px; background:#f1f5f9; padding:10px; border-radius:10px;">
            <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input" style="margin:0"><input type="date" id="d-date" value="${new Date().toISOString().split('T')[0]}" class="luxe-input" style="margin:0"><select id="d-mode" class="luxe-input" style="margin:0"><option>Virement</option><option>Chèque</option></select><button onclick="addDonation('${d.id}')" class="btn-gold">+</button>
        </div>
        <div style="margin-top:10px; max-height:120px; overflow-y:auto; border:1px solid #eee;">
            <table style="width:100%; font-size:0.8rem;">
                ${(d.donations||[]).map(don => `<tr><td>${don.date}</td><td><b>${don.amount}€</b></td><td><input type="checkbox" ${don.thanked?'checked':''} onchange="updateThanks('${don.id}','${d.id}',this.checked)"> Merci</td><td><button onclick="askDeleteDonation('${don.id}','${d.id}')" style="color:red; border:none; background:none; cursor:pointer;">🗑️</button></td></tr>`).join('')}
            </table>
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px;">
            <button onclick="saveDonor('${d.id}')" class="btn-gold" style="justify-content:center; background:var(--primary);">Sauvegarder</button>
            <button onclick="askDeleteDonor('${d.id}')" class="btn-danger">Supprimer Donateur</button>
        </div>
    `;
    lucide.createIcons();
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    if(!amt) return;
    const { data } = await supabaseClient.from('donations').insert([{ donor_id: id, amount: parseFloat(amt), date: document.getElementById('d-date').value, payment_mode: document.getElementById('d-mode').value, thanked: false }]).select();
    if(data) { openDonorFile(id); loadDonors(); }
};

window.updateThanks = async (donId, donorId, val) => {
    await supabaseClient.from('donations').update({ thanked: val }).eq('id', donId);
    loadDonors();
};

window.saveDonor = async (id) => {
    const updateData = { company_name: document.getElementById('e-company').value, last_name: document.getElementById('e-last').value, first_name: document.getElementById('e-first').value, email: document.getElementById('e-email').value, address: document.getElementById('e-addr').value, zip_code: document.getElementById('e-cp').value, city: document.getElementById('e-ville').value, notes: document.getElementById('e-notes').value };
    await supabaseClient.from('donors').update(updateData).eq('id', id);
    closeCustomModal(); loadDonors();
};

// ========================== MESSAGERIE ==========================

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name', { ascending: true });
    const select = document.getElementById('chat-subject-filter');
    const old = select.value;
    select.innerHTML = (data || []).map(s => `<option value="${s.name}" ${s.name === old ? 'selected' : ''}># ${s.name}</option>`).join('');
    loadChatMessages();
}

async function loadChatMessages() {
    const subj = document.getElementById('chat-subject-filter').value;
    if(!subj) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at', { ascending: true });
    const box = document.getElementById('chat-box');
    const filtered = (data || []).filter(m => currentUser.portal === "Institut Alsatia" || m.author_name === currentUser.first_name || (m.recipients && m.recipients.includes(currentUser.portal)) || (m.portal === currentUser.portal && !m.recipients));
    box.innerHTML = filtered.map(m => {
        const isMe = m.author_name === currentUser.first_name;
        return `<div class="message ${isMe ? 'my-msg' : ''}"><div style="font-size:0.6rem; opacity:0.7; margin-bottom:4px;"><b>${m.author_name}</b> • ${m.portal}</div><div onclick="${isMe ? `askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">${m.content}</div>${m.file_url ? `<a href="${m.file_url}" target="_blank" style="color:var(--gold); display:block; margin-top:5px; font-size:0.8rem;">📄 Document</a>` : ''}${isMe ? `<div style="text-align:right"><span onclick="askDeleteMsg('${m.id}')" style="cursor:pointer; font-size:0.6rem; opacity:0.5;">Supprimer</span></div>` : ''}</div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subj = document.getElementById('chat-subject-filter').value;
    if(!input.value.trim() && !selectedFile) return;
    let fUrl = null;
    if (selectedFile) {
        const path = `chat/${Date.now()}_${selectedFile.name}`;
        const { data } = await supabaseClient.storage.from('documents').upload(path, selectedFile);
        if (data) fUrl = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
    }
    const recips = Array.from(document.querySelectorAll('.target-check:checked')).map(c => c.value);
    const { data } = await supabaseClient.from('chat_global').insert([{ content: input.value, author_name: currentUser.first_name, portal: currentUser.portal, recipients: recips.length > 0 ? recips : null, subject: subj, file_url: fUrl }]).select();
    if(data) { input.value = ''; selectedFile = null; document.getElementById('file-preview').innerText = ""; loadChatMessages(); }
};

// ========================== DIALOGUES ==========================

window.askDeleteDonor = (id) => {
    document.getElementById('modal-body').innerHTML = `<h3>Supprimer ce donateur ?</h3><p>Action irréversible.</p><div style="display:flex; gap:10px; margin-top:20px;"><button onclick="execDeleteDonor('${id}')" class="btn-danger" style="flex:1">Confirmer</button><button onclick="openDonorFile('${id}')" class="btn-gold" style="flex:1">Annuler</button></div>`;
};
window.execDeleteDonor = async (id) => { await supabaseClient.from('donors').delete().eq('id', id); closeCustomModal(); loadDonors(); };

window.askDeleteDonation = (id, donorId) => {
    document.getElementById('modal-body').innerHTML = `<h3>Supprimer ce don ?</h3><div style="display:flex; gap:10px; margin-top:20px;"><button onclick="execDeleteDonation('${id}','${donorId}')" class="btn-danger" style="flex:1">Supprimer</button><button onclick="openDonorFile('${donorId}')" class="btn-gold" style="flex:1">Annuler</button></div>`;
};
window.execDeleteDonation = async (id, donorId) => { await supabaseClient.from('donations').delete().eq('id', id); openDonorFile(donorId); loadDonors(); };

window.askDeleteMsg = (id) => {
    document.getElementById('modal-body').innerHTML = `<h3>Supprimer le message ?</h3><div style="display:flex; gap:10px; margin-top:20px;"><button onclick="execDeleteMsg('${id}')" class="btn-danger" style="flex:1">Supprimer</button><button onclick="closeCustomModal()" class="btn-gold" style="flex:1">Annuler</button></div>`;
    document.getElementById('custom-modal').style.display = 'flex';
};
window.execDeleteMsg = async (id) => { await supabaseClient.from('chat_global').delete().eq('id', id); closeCustomModal(); loadChatMessages(); };

window.askEditMsg = (id, old) => {
    document.getElementById('modal-body').innerHTML = `<h3>Modifier</h3><textarea id="edit-msg-area" class="luxe-input" style="height:100px;">${old}</textarea><div style="display:flex; gap:10px; margin-top:10px;"><button onclick="execEditMsg('${id}')" class="btn-gold" style="flex:1">Sauver</button><button onclick="closeCustomModal()" class="btn-danger" style="background:#666; flex:1">Annuler</button></div>`;
    document.getElementById('custom-modal').style.display = 'flex';
};
window.execEditMsg = async (id) => { await supabaseClient.from('chat_global').update({ content: document.getElementById('edit-msg-area').value }).eq('id', id); closeCustomModal(); loadChatMessages(); };

function listenRealtime() {
    supabaseClient.channel('alsatia-v36').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadChatMessages();
        if(currentUser && currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

window.handleFileUpload = (input) => { if(input.files[0]) { selectedFile = input.files[0]; document.getElementById('file-preview').innerText = "📎 " + selectedFile.name; } };

// ========================== GESTION DES SUJETS (CHANNELS) ==========================

window.showNewSubjectModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary);">Créer un nouveau sujet</h3>
        <p style="font-size:0.8rem; margin-bottom:15px;">Exemple : #Gala2024, #Travaux, #Direction</p>
        <input type="text" id="n-subject-name" placeholder="Nom du sujet (sans espaces)" class="luxe-input">
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button onclick="execCreateSubject()" class="btn-gold" style="flex:1; justify-content:center;">Créer</button>
            <button onclick="closeCustomModal()" class="btn-danger" style="flex:1; background:#666;">Annuler</button>
        </div>
    `;
};

window.execCreateSubject = async () => {
    const name = document.getElementById('n-subject-name').value.trim().replace(/\s+/g, '-');
    if(!name) return;

    const { error } = await supabaseClient
        .from('chat_subjects')
        .insert([{ name: name }]);

    if(error) {
        console.error("Erreur création sujet:", error);
        alert("Ce sujet existe déjà ou une erreur est survenue.");
    } else {
        closeCustomModal();
        loadSubjects(); // Recharge la liste déroulante
    }
};

window.askDeleteSubject = () => {
    const subj = document.getElementById('chat-subject-filter').value;
    if(!subj) return;

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--danger);">Supprimer le sujet #${subj} ?</h3>
        <p style="font-size:0.8rem;">Attention : Cela ne supprimera pas les messages, mais le canal ne sera plus visible.</p>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button onclick="execDeleteSubject('${subj}')" class="btn-danger" style="flex:1; justify-content:center;">Confirmer</button>
            <button onclick="closeCustomModal()" class="btn-gold" style="flex:1;">Annuler</button>
        </div>
    `;
};

window.execDeleteSubject = async (name) => {
    const { error } = await supabaseClient
        .from('chat_subjects')
        .delete()
        .eq('name', name);

    if(!error) {
        closeCustomModal();
        loadSubjects();
    }
};
