// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 
let selectedFile = null; // Pour la gestion des pièces jointes dans la messagerie

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// FONCTIONS GLOBALES (SÉCURITÉ ET INTERFACE)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const modal = document.getElementById('custom-modal');
    if(modal) modal.style.display = 'none'; 
};

// Fonction critique pour éviter les injections et bugs d'affichage dans le chat
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// Fonction pour centraliser l'affichage des notifications
window.showNotice = (title, message) => {
    alert(`${title}\n${message}`); 
};

// Helper pour l'affichage des Modals Luxe
function showCustomModal(html) {
    const m = document.getElementById('custom-modal');
    const b = document.getElementById('modal-body');
    if(m && b) { 
        b.innerHTML = html; 
        m.style.display = 'flex'; 
        if(window.lucide) lucide.createIcons();
    }
}

// ==========================================
// FONCTIONS GLOBALES (CRITIQUE POUR LES ERREURS ONCLICK)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const modal = document.getElementById('custom-modal');
    if(modal) modal.style.display = 'none'; 
};

// Ta fonction personnalisée pour les messages d'information
window.showNotice = (title, message) => {
    alert(`${title}\n${message}`); 
};

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    initInterface();
    
    // Services Messagerie (Ajoutés pour la nouvelle version)
    await loadUsersForMentions();
    await loadSubjects();
    setupMentionLogic();
    subscribeToChat();
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = portal;

    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) bigLogo.innerHTML = `<img src="${logoSrc}" style="width:250px; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.15));">`;
    
    document.getElementById('welcome-full-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('welcome-portal-label').innerText = `Portail Officiel — ${portal}`;

    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    lucide.createIcons();
}

// ==========================================
// GESTION DE LA NAVIGATION (ONGLETS)
// ==========================================
window.switchTab = (id) => {
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${id}`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(`tab-${id}`);
    if (targetSection) {
        targetSection.classList.add('active');
        targetSection.scrollTop = 0; 
    }

    if (id === 'contacts') loadContacts();
    if (id === 'chat') loadChatMessages();
    if (id === 'donors') loadDonors();
    if (id === 'events') loadEvents();

    lucide.createIcons();
};

// ==========================================
// SECTION ANNUAIRE (CONTACTS)
// ==========================================
async function loadContacts() {
    const list = document.getElementById('contacts-list');
    if(!list) return;
    
    // Message d'attente identique à ton original
    list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px; color: #64748b; font-family: 'Inter', sans-serif;">Chargement de l'annuaire de l'Alsatia...</p>`;
    
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true })
        .order('last_name', { ascending: true });

    if (error) {
        list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 20px;">Erreur lors du chargement des contacts.</p>`;
        return;
    }

    // Rendu strict sans aucune simplification des styles inline
    list.innerHTML = users.map(u => `
        <div class="contact-card" style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:space-between; min-height:180px; transition: transform 0.2s ease, box-shadow 0.2s ease;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <span style="font-size:0.65rem; font-weight:800; color:#d4af37; letter-spacing:1px; text-transform:uppercase; font-family: 'Montserrat', sans-serif;">${u.portal}</span>
                    <i data-lucide="shield-check" style="width:14px; height:14px; color:#d4af37; opacity:0.5;"></i>
                </div>
                <h3 style="margin:8px 0 5px 0; font-size:1.1rem; color:#1e293b; font-family: 'Playfair Display', serif; font-weight: 700;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                <p style="font-size:0.85rem; color:#64748b; font-weight: 500;">${u.job_title || 'Collaborateur Alsatia'}</p>
            </div>
            <div style="display:flex; gap:10px; margin-top:20px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <a href="mailto:${u.email}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:10px; border-radius:8px; font-size:0.75rem; border:1px solid #e2e8f0; font-weight:700; transition: background 0.2s;">
                    <i data-lucide="mail" style="width:12px; height:12px; vertical-align:middle; margin-right:5px;"></i>EMAIL
                </a>
                ${u.phone ? `
                <a href="tel:${u.phone}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:10px; border-radius:8px; font-size:0.75rem; border:1px solid #e2e8f0; font-weight:700; transition: background 0.2s;">
                    <i data-lucide="phone" style="width:12px; height:12px; vertical-align:middle; margin-right:5px;"></i>APPEL
                </a>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    lucide.createIcons();
}

// ==========================================
// SECTION MON PROFIL (VERSION COMPLÈTE + EMAIL & PIN)
// ==========================================
window.openProfileModal = async () => {
    // On force la récupération pour avoir les données les plus récentes
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile) return window.showNotice("Erreur Profil", "Impossible de récupérer vos informations.", "error");

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid var(--gold); padding-bottom:15px; margin-bottom:25px;">
            <h3 style="margin:0; color:var(--primary); font-family: 'Playfair Display', serif; letter-spacing:1px;">
                <i data-lucide="user-cog" style="width:22px; height:22px; vertical-align:middle; margin-right:10px; color:var(--gold);"></i>GESTION DU COMPTE
            </h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; font-size:1.5rem; cursor:pointer; color:#94a3b8;">&times;</button>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="form-group">
                <label class="mini-label">PRÉNOM</label>
                <input type="text" id="prof-first" class="luxe-input" value="${profile.first_name || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">NOM</label>
                <input type="text" id="prof-last" class="luxe-input" value="${profile.last_name || ''}">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
            <div class="form-group">
                <label class="mini-label">ADRESSE EMAIL (IDENTIFIANT)</label>
                <input type="email" id="prof-email" class="luxe-input" value="${profile.email || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">NOUVEAU CODE PIN (4 CHIFFRES)</label>
                <input type="password" id="prof-pin" class="luxe-input" maxlength="4" placeholder="••••" value="${profile.pin || ''}">
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top:20px;">
            <div class="form-group">
                <label class="mini-label">FONCTION ACTUELLE</label>
                <input type="text" id="prof-job" class="luxe-input" value="${profile.job_title || ''}">
            </div>
            <div class="form-group">
                <label class="mini-label">TÉLÉPHONE DIRECT</label>
                <input type="text" id="prof-phone" class="luxe-input" value="${profile.phone || ''}">
            </div>
        </div>

        <div style="background: rgba(197, 160, 89, 0.05); padding: 15px; border-radius: 12px; margin-top: 25px; border: 1px dashed var(--gold); display:flex; gap:12px; align-items:center;">
            <i data-lucide="shield-check" style="color:var(--gold); width:24px; height:24px; flex-shrink:0;"></i>
            <p style="margin:0; font-size:0.75rem; color:var(--primary); line-height:1.4;">
                Compte rattaché au portail <strong>${profile.portal}</strong>.<br>
                <span style="opacity:0.7;">Toute modification de l'email ou du PIN sera effective dès la prochaine connexion.</span>
            </p>
        </div>

        <button onclick="window.saveMyProfile()" class="btn-gold" style="width:100%; margin-top:30px; height:50px; font-weight:800; letter-spacing:1px;">
            SAUVEGARDER LES MODIFICATIONS
        </button>
    `;
    lucide.createIcons();
};

window.saveMyProfile = async () => {
    const emailVal = document.getElementById('prof-email').value.trim();
    const pinVal = document.getElementById('prof-pin').value.trim();

    const updates = {
        first_name: document.getElementById('prof-first').value.trim(),
        last_name: document.getElementById('prof-last').value.trim(),
        email: emailVal,
        pin: pinVal,
        job_title: document.getElementById('prof-job').value.trim(),
        phone: document.getElementById('prof-phone').value.trim()
    };

    // VALIDATIONS SÉCURITÉ
    if (!updates.first_name || !updates.last_name || !updates.email || !updates.pin) {
        return window.showNotice("Champs obligatoires", "Prénom, Nom, Email et PIN sont requis.", "error");
    }

    if (updates.pin.length !== 4 || isNaN(updates.pin)) {
        return window.showNotice("Format PIN", "Le code PIN doit être composé de 4 chiffres.", "error");
    }

    const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);

    if (error) {
        console.error("Update Error:", error);
        return window.showNotice("Erreur SQL", "Impossible de sauvegarder : l'email est peut-être déjà utilisé.", "error");
    }

    // MISE À JOUR DE LA SESSION LOCALE
    currentUser = { ...currentUser, ...updates };
    localStorage.setItem('alsatia_user', JSON.stringify(currentUser));

    // REFRESH INTERFACE & FEEDBACK
    initInterface(); 
    closeCustomModal();
    window.showNotice("Profil mis à jour", "Vos informations de compte ont été synchronisées avec succès.");
};

// ==========================================
// 1. SERVICES DE MESSAGERIE (INIT & MENTIONS)
// ==========================================
async function loadUsersForMentions() {
    try {
        const { data } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
        const entities = ["Institut Alsatia", "Academia Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin"];
        if (data) {
            allUsersForMentions = [...entities, ...data.map(u => `${u.first_name} ${u.last_name} (${u.portal})`)];
        } else {
            allUsersForMentions = entities;
        }
    } catch (err) { console.error("Err mentions:", err); }
}

function setupMentionLogic() {
    const input = document.getElementById('chat-input');
    if(!input) return;
    let suggestList = document.getElementById('mention-suggestions') || document.createElement('div');
    suggestList.id = "mention-suggestions"; 
    suggestList.className = "mention-suggestions-box";
    if (!document.getElementById('mention-suggestions')) input.parentNode.appendChild(suggestList);

    input.addEventListener('input', () => {
        const val = input.value.substring(0, input.selectionStart);
        const word = val.split(/\s/).pop();
        if (word.startsWith('@')) {
            const matches = allUsersForMentions.filter(s => s.toLowerCase().includes(word.substring(1).toLowerCase()));
            suggestList.innerHTML = matches.map(m => `<div class="suggest-item" onclick="window.insertMention('${m.replace(/'/g, "\\'")}')">${m}</div>`).join('');
            suggestList.style.display = matches.length ? 'block' : 'none';
        } else suggestList.style.display = 'none';
    });
}

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    const words = input.value.split(/\s/);
    words[words.length - 1] = `@${name} `;
    input.value = words.join(' ');
    document.getElementById('mention-suggestions').style.display = 'none';
    input.focus();
};

// ==========================================
// 2. GESTION DES SUJETS (SALONS)
// ==========================================
async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    if(!select) return;
    const mySubjects = (data || []).filter(s => s.entity === "Tous" || s.entity === currentUser.portal || !s.entity);
    select.innerHTML = mySubjects.map(s => `<option value="${s.name}">${s.entity === "Tous" ? '🌍' : '🔒'} # ${s.name}</option>`).join('');
    select.onchange = () => loadChatMessages();
    loadChatMessages();
}

window.showNewSubjectModal = () => {
    showCustomModal(`
        <h3 class="luxe-title">NOUVEAU SALON</h3>
        <input type="text" id="n-subject-name" class="luxe-input" placeholder="Nom du salon (ex: logistique)">
        <select id="n-subject-entity" class="luxe-input" style="width:100%; margin-top:10px;">
            <option value="Tous">🌍 Public</option>
            <option value="${currentUser.portal}">🔒 Privé</option>
        </select>
        <button onclick="window.execCreateSubject()" class="btn-gold" style="width:100%; margin-top:15px;">CRÉER</button>
    `);
};

window.execCreateSubject = async () => {
    const rawName = document.getElementById('n-subject-name').value.trim();
    // REPRISE DE TA LOGIQUE : Nettoyage strict du nom
    const name = rawName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    if(name) {
        await supabaseClient.from('chat_subjects').insert([{ name, entity: document.getElementById('n-subject-entity').value }]);
        closeCustomModal(); loadSubjects();
    }
};

// ==========================================
// 3. AFFICHAGE DES MESSAGES
// ==========================================
async function loadChatMessages() {
    const subj = document.getElementById('chat-subject-filter')?.value;
    if(!subj) return;
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at');
    const box = document.getElementById('chat-box');
    if(!box) return;

    box.innerHTML = (data || []).map(m => {
        const isMe = m.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
        // REPRISE DE TA LOGIQUE : escape + rendu des mentions + conservation des sauts de ligne
        let body = escapeHTML(m.content)
            .replace(/@([\wÀ-ÿ-\s()]+)/g, '<span class="mention-badge">@$1</span>')
            .replace(/\n/g, '<br>');

        return `
            <div class="message ${isMe ? 'my-msg' : ''}" style="margin-bottom:15px; display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div style="font-size:0.7rem; opacity:0.7;"><b style="color:var(--gold);">${m.author_full_name}</b> • ${m.portal}</div>
                <div style="${isMe ? 'background:var(--primary); color:white;' : 'background:#f1f5f9; color:var(--primary);'} border-radius:12px; padding:10px; max-width:80%;">
                    <div style="font-size:0.9rem;" onclick="${isMe ? `window.askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'").replace(/\n/g, "\\n")}')` : ''}">${body}</div>
                    ${m.file_url ? `<a href="${m.file_url}" target="_blank" style="display:block; margin-top:5px; font-size:0.7rem; color:var(--gold); border-top:1px solid rgba(180,145,87,0.2); padding-top:5px;">📄 Fichier joint</a>` : ''}
                </div>
                ${isMe ? `<span onclick="window.askDeleteMsg('${m.id}')" style="font-size:0.6rem; color:#ef4444; cursor:pointer; margin-top:3px;">SUPPRIMER</span>` : ''}
            </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

// ==========================================
// 4. ACTIONS MESSAGES
// ==========================================
window.handleFileUpload = (input) => { 
    if(input.files[0]) { 
        selectedFile = input.files[0]; 
        const prev = document.getElementById('file-preview');
        if(prev) prev.innerHTML = `<span style="color:var(--gold); font-size:0.8rem;">📎 ${selectedFile.name}</span>`; 
    } 
};

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

    await supabaseClient.from('chat_global').insert([{ 
        content: input.value, author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        portal: currentUser.portal, subject: subj, file_url: fUrl 
    }]);
    input.value = ''; selectedFile = null;
    if(document.getElementById('file-preview')) document.getElementById('file-preview').innerHTML = "";
    loadChatMessages();
};

window.askEditMsg = (id, old) => {
    showCustomModal(`
        <h3 class="luxe-title">MODIFIER</h3>
        <textarea id="edit-area" class="luxe-input" style="height:100px; width:100%;">${old}</textarea>
        <button onclick="window.execEditMsg('${id}')" class="btn-gold" style="width:100%; margin-top:10px;">ENREGISTRER</button>
    `);
};

window.execEditMsg = async (id) => {
    const content = document.getElementById('edit-area').value;
    await supabaseClient.from('chat_global').update({ content }).eq('id', id);
    closeCustomModal(); loadChatMessages();
};

window.askDeleteMsg = (id) => {
    if(confirm("Supprimer ce message ?")) {
        supabaseClient.from('chat_global').delete().eq('id', id).then(() => loadChatMessages());
    }
};

function subscribeToChat() {
    supabaseClient.channel('chat-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, () => loadChatMessages()).subscribe();
}

// ==========================================
// 1. CHARGEMENT ET FILTRAGE DYNAMIQUE
// ==========================================
async function loadDonors() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) {
        console.error("Erreur Supabase:", error);
        return;
    }
    allDonorsData = data;
    renderDonors(data);
}

window.filterDonors = () => {
    const searchInput = document.getElementById('search-donor');
    const entitySelect = document.getElementById('filter-entity');
    
    // Sécurité : on vérifie que les éléments existent
    const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
    const entityVal = entitySelect ? entitySelect.value : "";

    const filtered = allDonorsData.filter(d => {
        const matchesSearch = 
            (d.last_name || "").toLowerCase().includes(searchVal) || 
            (d.first_name || "").toLowerCase().includes(searchVal) ||
            (d.company_name || "").toLowerCase().includes(searchVal) ||
            (d.origin || "").toLowerCase().includes(searchVal);

        const matchesEntity = (entityVal === "" || d.entity === entityVal);

        return matchesSearch && matchesEntity;
    });
    
    renderDonors(filtered);
};

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;

    if (data.length === 0) {
        list.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; opacity:0.5;">Aucun résultat trouvé</td></tr>`;
        return;
    }

    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((acc, cur) => acc + Number(cur.amount), 0) || 0;
        const displayName = d.company_name ? `<b>${d.company_name}</b> <span style="font-size:0.75rem;">(${d.last_name})</span>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
        
        return `
            <tr>
                <td>${displayName}</td>
                <td><span class="origin-tag">${d.origin || '-'}</span></td>
                <td style="font-weight:800; color:var(--primary);">${total} €</td>
                <td style="text-align:right;">
                    <button onclick="window.openDonorFile('${d.id}')" class="btn-gold" style="padding:5px 12px; font-size:0.7rem;">DOSSIER</button>
                </td>
            </tr>`;
    }).join('');
}

// ==========================================
// 2. CRÉATION (ALIGNÉE SUR TABLE SQL DONORS)
// ==========================================
window.showAddDonorModal = () => {
    showCustomModal(`
        <h3 class="luxe-title">NOUVEAU CONTACT CRM</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <input type="text" id="n-d-last" class="luxe-input" placeholder="NOM *">
            <input type="text" id="n-d-first" class="luxe-input" placeholder="PRÉNOM">
        </div>
        <input type="text" id="n-d-company" class="luxe-input" placeholder="NOM DE L'ENTREPRISE" style="margin-top:10px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <input type="email" id="n-d-email" class="luxe-input" placeholder="EMAIL">
            <input type="text" id="n-d-phone" class="luxe-input" placeholder="TÉLÉPHONE">
        </div>
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px; margin-top:10px;">
            <input type="text" id="n-d-zip" class="luxe-input" placeholder="CP">
            <input type="text" id="n-d-city" class="luxe-input" placeholder="VILLE">
        </div>
        <input type="text" id="n-d-origin" class="luxe-input" placeholder="ORIGINE (Gala, Site, etc.)" style="margin-top:10px;">
        <textarea id="n-d-notes" class="luxe-input" placeholder="Notes..." style="margin-top:10px; height:50px;"></textarea>
        <button onclick="window.execCreateDonor()" class="btn-gold" style="width:100%; margin-top:15px;">CRÉER LA FICHE</button>
    `);
};

window.execCreateDonor = async () => {
    const lastNameField = document.getElementById('n-d-last');
    const last_name = lastNameField ? lastNameField.value.toUpperCase() : "";
    
    if(!last_name) return window.showNotice("Erreur", "Le nom est obligatoire.", "error");

    const payload = {
        last_name,
        first_name: document.getElementById('n-d-first').value,
        company_name: document.getElementById('n-d-company').value,
        email: document.getElementById('n-d-email').value,
        phone: document.getElementById('n-d-phone').value,
        zip_code: document.getElementById('n-d-zip').value,
        city: document.getElementById('n-d-city').value,
        origin: document.getElementById('n-d-origin').value,
        notes: document.getElementById('n-d-notes').value,
        entity: currentUser.portal, 
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('donors').insert([payload]);
    if(error) return window.showNotice("Erreur", error.message, "error");
    
    closeCustomModal();
    loadDonors();
};

// ==========================================
// 3. DOSSIER DÉTAILLÉ & ACTIONS CRM
// ==========================================
window.openDonorFile = async (id) => {
    const donor = allDonorsData.find(d => d.id === id);
    if (!donor) return;
    const dons = donor.donations || [];
    
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
            <div>
                <span class="mini-label">ID: ${donor.id.substring(0,8)}...</span>
                <h3 style="margin:0; color:var(--primary); font-family:'Playfair Display', serif;">ÉDITION DU DOSSIER</h3>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.exportDonorToExcel('${donor.id}')" class="btn-gold" style="padding:5px 10px; font-size:0.7rem;">EXCEL</button>
                <button onclick="window.askDeleteDonor('${donor.id}', '${donor.last_name.replace(/'/g, "\\'")}')" style="background:#fee2e2; color:#ef4444; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.7rem; font-weight:bold;">SUPPRIMER</button>
                <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.2rem;">&times;</button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
                <p class="mini-label">COORDONNÉES ÉDITABLES</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <input type="text" id="edit-last" class="luxe-input" value="${donor.last_name || ''}" placeholder="NOM *">
                    <input type="text" id="edit-first" class="luxe-input" value="${donor.first_name || ''}" placeholder="PRÉNOM">
                </div>
                <input type="text" id="edit-company" class="luxe-input" value="${donor.company_name || ''}" placeholder="ENTREPRISE" style="margin-bottom:8px;">
                <input type="email" id="edit-email" class="luxe-input" value="${donor.email || ''}" placeholder="EMAIL" style="margin-bottom:8px;">
                <input type="text" id="edit-phone" class="luxe-input" value="${donor.phone || ''}" placeholder="TÉLÉPHONE" style="margin-bottom:8px;">
                <input type="text" id="edit-address" class="luxe-input" value="${donor.address || ''}" placeholder="ADRESSE" style="margin-bottom:8px;">
                <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px;">
                    <input type="text" id="edit-zip" class="luxe-input" value="${donor.zip_code || ''}" placeholder="CP">
                    <input type="text" id="edit-city" class="luxe-input" value="${donor.city || ''}" placeholder="VILLE">
                </div>
            </div>

            <div>
                <p class="mini-label">SUIVI CRM</p>
                <input type="text" id="edit-origin" class="luxe-input" value="${donor.origin || ''}" placeholder="Origine" style="margin-bottom:8px;">
                <input type="text" id="edit-next" class="luxe-input" value="${donor.next_action || ''}" placeholder="Prochaine action" style="margin-bottom:8px;">
                <textarea id="edit-notes" class="luxe-input" style="height:115px; margin-bottom:10px;" placeholder="Notes...">${donor.notes || ''}</textarea>
                
                <button onclick="window.updateDonorFields('${donor.id}')" class="btn-gold" style="width:100%; height:40px; font-weight:800; margin-bottom:8px;">ENREGISTRER LES MODIFICATIONS</button>
                <button onclick="window.addDonationPrompt('${id}')" style="width:100%; background:var(--primary); color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-size:0.7rem;">+ AJOUTER UN DON</button>
            </div>
        </div>

        <div style="margin-top:20px; max-height:180px; overflow-y:auto; border-top:1px solid #eee;">
            <table class="luxe-table">
                <thead><tr><th>DATE</th><th>MONTANT</th><th>MODE</th><th>REÇU FISCAL</th><th style="text-align:right;">ACTIONS</th></tr></thead>
                <tbody>
                    ${dons.length > 0 ? dons.map(don => `
                        <tr>
                            <td>${new Date(don.date).toLocaleDateString()}</td>
                            <td style="font-weight:700;">${don.amount}€</td>
                            <td>${don.payment_mode || '-'}</td>
                            <td>${don.fiscal_receipt_id || '-'}</td>
                            <td style="text-align:right;">
                                <i data-lucide="file-text" style="width:14px; color:var(--gold); cursor:pointer; margin-right:10px;" onclick="window.generateReceipt('${don.id}')"></i>
                                <i data-lucide="trash-2" style="width:14px; color:#ef4444; cursor:pointer;" onclick="window.askDeleteDonation('${don.id}')"></i>
                            </td>
                        </tr>`).join('') : '<tr><td colspan="5" style="text-align:center; opacity:0.5;">Aucun don enregistré</td></tr>'}
                </tbody>
            </table>
        </div>`;
    lucide.createIcons();
};

window.updateDonorFields = async (id) => {
    const payload = {
        last_name: document.getElementById('edit-last').value.toUpperCase(),
        first_name: document.getElementById('edit-first').value,
        company_name: document.getElementById('edit-company').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        address: document.getElementById('edit-address').value,
        zip_code: document.getElementById('edit-zip').value,
        city: document.getElementById('edit-city').value,
        origin: document.getElementById('edit-origin').value,
        next_action: document.getElementById('edit-next').value,
        notes: document.getElementById('edit-notes').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('donors').update(payload).eq('id', id);
    if (error) return window.showNotice("Erreur", error.message, "error");
    
    window.showNotice("Mise à jour", "Fiche synchronisée avec succès.");
    loadDonors();
};

// ==========================================
// 4. GESTION FINANCIÈRE ET EXPORTS
// ==========================================
window.addDonationPrompt = (donorId) => {
    showCustomModal(`
        <h3 class="luxe-title">NOUVEAU DON</h3>
        <input type="number" id="don-amt" class="luxe-input" placeholder="MONTANT (€) *">
        <input type="date" id="don-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}" style="margin-top:10px;">
        <input type="text" id="don-fiscal" class="luxe-input" placeholder="N° REÇU FISCAL" style="margin-top:10px;">
        <select id="don-method" class="luxe-input" style="margin-top:10px;">
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
            <option value="Espèces">Espèces</option>
            <option value="CB">CB</option>
        </select>
        <button onclick="window.execAddDonation('${donorId}')" class="btn-gold" style="width:100%; margin-top:20px;">VALIDER</button>
    `);
};

window.execAddDonation = async (donorId) => {
    const amount = document.getElementById('don-amt').value;
    const date = document.getElementById('don-date').value;
    if (!amount || !date) return window.showNotice("Champs requis", "Montant et date obligatoires.", "error");

    const { error } = await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amount),
        date: date,
        payment_mode: document.getElementById('don-method').value,
        fiscal_receipt_id: document.getElementById('don-fiscal').value,
        thanked: false
    }]);

    if (error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Succès", "Don enregistré.");
    closeCustomModal();
    loadDonors();
};

window.exportDonorToExcel = (donorId) => {
    const donor = allDonorsData.find(d => d.id === donorId);
    if (!donor) return;
    const wb = XLSX.utils.book_new();
    const wsInfo = XLSX.utils.json_to_sheet([donor]);
    const wsDons = XLSX.utils.json_to_sheet(donor.donations || []);
    XLSX.utils.book_append_sheet(wb, wsInfo, "COORDONNÉES");
    XLSX.utils.book_append_sheet(wb, wsDons, "DONS");
    XLSX.writeFile(wb, `Fiche_${donor.last_name}.xlsx`);
};

// ==========================================
// 5. SÉCURITÉ ET MAINTENANCE
// ==========================================
window.askDeleteDonation = (donationId) => {
    window.askConfirmation("SUPPRIMER DON ?", "Effacer cette transaction ?", async () => {
        await supabaseClient.from('donations').delete().eq('id', donationId);
        window.showNotice("Supprimé", "Don effacé.");
        closeCustomModal(); 
        loadDonors();
    });
};

window.askDeleteDonor = (id, name) => {
    window.askConfirmation("SUPPRESSION TOTALE", `Supprimer la fiche de ${name} ?`, async () => {
        await supabaseClient.from('donations').delete().eq('donor_id', id);
        await supabaseClient.from('donors').delete().eq('id', id);
        window.showNotice("CRM", "Fiche supprimée.");
        closeCustomModal(); 
        loadDonors();
    });
};

window.askConfirmation = (title, message, onConfirm) => {
    showCustomModal(`
        <div style="text-align:center;">
            <h3 style="color:var(--primary); font-family:'Playfair Display', serif;">${title}</h3>
            <p style="font-size:0.9rem; margin-bottom:20px;">${message}</p>
            <div style="display:flex; gap:10px;">
                <button onclick="closeCustomModal()" class="luxe-input" style="flex:1;">NON</button>
                <button id="btn-confirm" class="btn-gold" style="flex:1; background:#ef4444; border:none;">OUI</button>
            </div>
        </div>
    `);
    document.getElementById('btn-confirm').onclick = onConfirm;
};

window.generateReceipt = (id) => { window.showNotice("PDF", "Génération du reçu fiscal CERFA..."); };

// INITIALISATION AU DÉMARRAGE
document.addEventListener('DOMContentLoaded', loadDonors);

// ==========================================
// 1. CHARGEMENT ET RENDU DES ÉVÉNEMENTS
// ==========================================
async function loadEvents() {
    const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    const container = document.getElementById('events-container');
    if (!container) return;

    if (error || !data || data.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px; color:#64748b;">Aucun événement planifié pour le moment.</p>`;
        return;
    }

    container.innerHTML = data.map(ev => `
        <div class="event-card" onclick="window.openEventDetails('${ev.id}')" style="background:white; border-radius:12px; border:1px solid #e2e8f0; overflow:hidden; cursor:pointer; transition:all 0.3s ease;">
            <div style="height:8px; background:${ev.status === 'Confirmé' ? '#22c55e' : ev.status === 'Terminé' ? '#64748b' : '#f59e0b'};"></div>
            <div style="padding:20px;">
                <span style="font-size:0.65rem; font-weight:800; color:#d4af37; text-transform:uppercase;">${ev.status}</span>
                <h3 style="margin:8px 0; font-family:'Playfair Display'; color:#1e293b;">${ev.title}</h3>
                <div style="font-size:0.8rem; color:#64748b; display:flex; flex-direction:column; gap:5px;">
                    <span><i data-lucide="calendar" style="width:12px; vertical-align:middle;"></i> ${new Date(ev.event_date).toLocaleDateString()}</span>
                    <span><i data-lucide="map-pin" style="width:12px; vertical-align:middle;"></i> ${ev.location || 'Lieu à définir'}</span>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// ==========================================
// 2. CRÉATION D'ÉVÉNEMENT
// ==========================================
window.showAddEventModal = () => {
    showCustomModal(`
        <h3 class="luxe-title">PLANIFIER UN ÉVÉNEMENT</h3>
        <input type="text" id="ev-title" class="luxe-input" placeholder="NOM DE L'ÉVÉNEMENT *">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <input type="date" id="ev-date" class="luxe-input">
            <input type="text" id="ev-loc" class="luxe-input" placeholder="LIEU">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
            <input type="number" id="ev-budget" class="luxe-input" placeholder="BUDGET ESTIMÉ (€)">
            <select id="ev-status" class="luxe-input">
                <option>Brouillon</option>
                <option>Confirmé</option>
            </select>
        </div>
        <button onclick="window.execCreateEvent()" class="btn-gold" style="width:100%; margin-top:15px; height:45px;">CRÉER L'ÉVÉNEMENT</button>
    `);
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value.trim();
    const event_date = document.getElementById('ev-date').value;
    if(!title || !event_date) return alert("Le titre et la date sont obligatoires.");

    const payload = {
        title, event_date,
        location: document.getElementById('ev-loc').value,
        budget_estimated: document.getElementById('ev-budget').value || 0,
        status: document.getElementById('ev-status').value,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`
    };

    const { error } = await supabaseClient.from('events').insert([payload]);
    if(error) return window.showNotice("Erreur", error.message);
    
    closeCustomModal();
    loadEvents();
};

// ==========================================
// 3. DOSSIER LOGISTIQUE (DÉTAILS & ONGLETS)
// ==========================================
window.openEventDetails = async (id) => {
    const { data: ev, error } = await supabaseClient.from('events').select('*').eq('id', id).single();
    if(error || !ev) return;

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <h2 style="margin:0; font-family:'Playfair Display';">${ev.title}</h2>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.2rem;">&times;</button>
        </div>

        <div style="display:flex; gap:15px; border-bottom:1px solid #eee; margin-bottom:20px;">
            <button onclick="window.switchEventTab('infos', '${ev.id}')" class="event-tab-btn active" id="etab-infos">INFOS</button>
            <button onclick="window.switchEventTab('guests', '${ev.id}')" class="event-tab-btn" id="etab-guests">INVITÉS</button>
            <button onclick="window.switchEventTab('media', '${ev.id}')" class="event-tab-btn" id="etab-media">RESSOURCES</button>
        </div>

        <div id="event-tab-content">
            </div>
        
        <div style="margin-top:30px; padding-top:15px; border-top:1px dashed #eee; display:flex; justify-content:space-between;">
            <button onclick="window.askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" style="color:#ef4444; background:none; border:none; font-size:0.7rem; cursor:pointer; font-weight:bold;">SUPPRIMER L'ÉVÉNEMENT</button>
            <span style="font-size:0.6rem; color:#94a3b8;">Créé par ${ev.created_by || 'Système'}</span>
        </div>
    `;
    window.switchEventTab('infos', ev.id);
};

window.switchEventTab = async (tab, eventId) => {
    // Gestion du style des boutons
    document.querySelectorAll('.event-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`etab-${tab}`).classList.add('active');

    const content = document.getElementById('event-tab-content');
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', eventId).single();

    if(tab === 'infos') {
        content.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                <div>
                    <label class="mini-label">LOGISTIQUE</label>
                    <p style="font-size:0.85rem;">📅 Date : ${new Date(ev.event_date).toLocaleDateString()}<br>📍 Lieu : ${ev.location || 'N/A'}</p>
                    <label class="mini-label">FINANCES</label>
                    <p style="font-size:0.85rem;">💰 Budget : ${ev.budget_estimated} €<br>📉 Réel : ${ev.budget_actual || 0} €</p>
                </div>
                <div>
                    <label class="mini-label">STATUT ACTUEL</label>
                    <select onchange="window.updateEventStatus('${ev.id}', this.value)" class="luxe-input" style="width:100%;">
                        <option ${ev.status === 'Brouillon' ? 'selected' : ''}>Brouillon</option>
                        <option ${ev.status === 'Confirmé' ? 'selected' : ''}>Confirmé</option>
                        <option ${ev.status === 'Terminé' ? 'selected' : ''}>Terminé</option>
                    </select>
                    <label class="mini-label" style="margin-top:15px; display:block;">NOTES LOGISTIQUES</label>
                    <textarea class="luxe-input" style="height:60px; font-size:0.8rem;" onblur="window.updateEventNotes('${ev.id}', this.value)">${ev.description || ''}</textarea>
                </div>
            </div>
        `;
    } 
    else if(tab === 'guests') {
        content.innerHTML = `<p style="font-size:0.75rem; color:#64748b; text-align:center;">Synchronisation avec la base CRM...</p>`;
        // Logique de chargement des invités liée à la table donors
        const { data: donors } = await supabaseClient.from('donors').select('first_name, last_name, company_name').limit(10);
        content.innerHTML = `
            <div style="max-height:200px; overflow-y:auto;">
                <table class="luxe-table">
                    ${donors.map(d => `<tr><td style="font-size:0.8rem;">${d.company_name || d.last_name}</td><td style="text-align:right;"><input type="checkbox"></td></tr>`).join('')}
                </table>
            </div>
            <button class="btn-gold" style="width:100%; margin-top:10px; font-size:0.7rem;">GÉRER LA LISTE COMPLÈTE</button>
        `;
    }
    else if(tab === 'media') {
        content.innerHTML = `
            <div style="border:2px dashed #e2e8f0; padding:20px; text-align:center; border-radius:8px;">
                <i data-lucide="upload-cloud" style="width:30px; color:#cbd5e1; margin-bottom:10px;"></i>
                <p style="font-size:0.75rem; color:#64748b;">Déposez vos plans de table, menus ou photos ici.</p>
                <input type="file" id="ev-file" style="display:none;" onchange="window.showNotice('Media', 'Téléchargement...')">
                <button onclick="document.getElementById('ev-file').click()" class="btn-gold" style="font-size:0.7rem; padding:5px 15px;">PARCOURIR</button>
            </div>
        `;
    }
    lucide.createIcons();
};

// ==========================================
// 4. MISES À JOUR ET SUPPRESSION
// ==========================================
window.updateEventStatus = async (id, status) => {
    await supabaseClient.from('events').update({ status }).eq('id', id);
    loadEvents();
};

window.updateEventNotes = async (id, description) => {
    await supabaseClient.from('events').update({ description }).eq('id', id);
};

window.askDeleteEvent = (id, title) => {
    if(confirm(`Supprimer l'événement "${title}" ? Cette action est irréversible.`)) {
        supabaseClient.from('events').delete().eq('id', id).then(() => {
            closeCustomModal();
            loadEvents();
        });
    }
};
