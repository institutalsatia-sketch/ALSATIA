// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};

// ==========================================
// FONCTIONS GLOBALES (CRITIQUE POUR LES ERREURS ONCLICK)
// ==========================================
window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    document.getElementById('custom-modal').style.display = 'none'; 
};

window.showNotice = (title, message) => {
    // Version simple en attendant un toast CSS
    alert(`${title}\n${message}`); 
};

// ==========================================
// INITIALISATION & INTERFACE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    initInterface();
    // Charger le chat par défaut si nécessaire
    if(typeof loadChatMessages === "function") loadChatMessages(); 
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    // Sidebar
    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    
    document.getElementById('user-name-display').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('current-portal-display').innerText = portal;

    // Accueil (Logo Géant)
    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) bigLogo.innerHTML = `<img src="${logoSrc}" style="width:250px; filter:drop-shadow(0 20px 30px rgba(0,0,0,0.15));">`;
    
    document.getElementById('welcome-full-name').innerText = `${currentUser.first_name} ${currentUser.last_name}`;
    document.getElementById('welcome-portal-label').innerText = `Portail Officiel — ${portal}`;

    // GESTION DYNAMIQUE DU MENU
    // On affiche l'onglet donateurs seulement pour l'Institut
    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    lucide.createIcons();
}

// Fonction de changement d'onglet
window.switchTab = (id) => {
    // 1. Gérer les classes actives sur les menus
    document.querySelectorAll('.side-nav li').forEach(li => li.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${id}`);
    if (activeNav) activeNav.classList.add('active');

    // 2. Gérer l'affichage des sections
    document.querySelectorAll('.page-content').forEach(section => section.classList.remove('active'));
    const targetSection = document.getElementById(`tab-${id}`);
    if (targetSection) {
        targetSection.classList.add('active');
        // Reset du scroll pour ne pas rester en bas de page
        targetSection.scrollTop = 0; 
    }

    // 3. Chargements spécifiques
    if (id === 'contacts') loadContacts();
    if (id === 'chat' && typeof loadChatMessages === 'function') loadChatMessages();
    if (id === 'donors' && typeof loadDonors === 'function') loadDonors();
    if (id === 'events' && typeof loadEvents === 'function') loadEvents();

    lucide.createIcons();
};

// ==========================================
// FONCTION ANNUAIRE (CONTACTS)
// ==========================================
async function loadContacts() {
    const list = document.getElementById('contacts-list');
    if(!list) return;
    
    list.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Chargement de l'annuaire...</p>`;

    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true });

    if (error) return list.innerHTML = "Erreur de chargement.";

    list.innerHTML = users.map(u => `
        <div class="contact-card" style="background:white; padding:20px; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; justify-content:space-between; min-height:180px;">
            <div>
                <span style="font-size:0.65rem; font-weight:800; color:#d4af37; letter-spacing:1px; text-transform:uppercase;">${u.portal}</span>
                <h3 style="margin:5px 0; font-size:1.1rem; color:#1e293b;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                <p style="font-size:0.85rem; color:#64748b;">${u.job_title || 'Collaborateur'}</p>
            </div>
            <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <a href="mailto:${u.email}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:8px; border-radius:6px; font-size:0.75rem; border:1px solid #eee;">Mail</a>
                ${u.phone ? `<a href="tel:${u.phone}" style="flex:1; text-align:center; text-decoration:none; color:#1e293b; background:#f8fafc; padding:8px; border-radius:6px; font-size:0.75rem; border:1px solid #eee;">Appeler</a>` : ''}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// ==========================================
// GESTION DU PROFIL UTILISATEUR & SÉCURITÉ
// ==========================================

window.openProfileModal = async () => {
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (error || !profile) {
        console.error("Erreur profil:", error);
        return window.showNotice("Erreur", "Impossible de charger votre profil.");
    }

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid #d4af37; padding-bottom:10px; margin-bottom:20px;">
            <h3 style="margin:0; color:#1e293b;"><i data-lucide="settings" style="width:20px; vertical-align:middle; margin-right:8px;"></i>PARAMÈTRES DU PROFIL</h3>
            <button onclick="closeCustomModal()" class="btn-gold" style="padding: 2px 8px; border:none; background:none; font-weight:bold; cursor:pointer;">X</button>
        </div>

        <h4 style="font-size:0.75rem; color:#d4af37; letter-spacing:1px; margin-bottom:15px; text-transform:uppercase;">Informations Personnelles</h4>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <label class="mini-label">PRÉNOM</label>
                <input type="text" id="prof-first" class="luxe-input" value="${profile.first_name || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
            <div>
                <label class="mini-label">NOM</label>
                <input type="text" id="prof-last" class="luxe-input" value="${profile.last_name || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
        </div>

        <div style="margin-top:15px;">
            <label class="mini-label">FONCTION DANS L'ENTITÉ</label>
            <input type="text" id="prof-job" class="luxe-input" value="${profile.job_title || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
            <div>
                <label class="mini-label">TÉLÉPHONE</label>
                <input type="tel" id="prof-phone" class="luxe-input" value="${profile.phone || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
            <div>
                <label class="mini-label">MAIL</label>
                <input type="email" id="prof-email" class="luxe-input" value="${profile.email || ''}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
            </div>
        </div>

        <button onclick="window.saveMyProfile()" class="btn-gold" style="width:100%; margin-top:15px; padding:12px; background:#1e293b; color:#d4af37; font-weight:bold; border:1px solid #d4af37; border-radius:8px; cursor:pointer;">
            METTRE À JOUR LE PROFIL
        </button>

        <hr style="border:0; border-top:1px solid #eee; margin:25px 0;">

        <h4 style="font-size:0.75rem; color:#d4af37; letter-spacing:1px; margin-bottom:15px; text-transform:uppercase;">Sécurité & Accès</h4>
        
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
            <div style="margin-bottom:10px; font-size:0.8rem; color:#64748b;">
                Portail actuel : <strong style="color:#1e293b;">${profile.portal}</strong>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div>
                    <label class="mini-label">NOUVEAU PIN</label>
                    <input type="password" id="prof-pin" class="luxe-input" placeholder="****" maxlength="6" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
                </div>
                <div>
                    <label class="mini-label">CONFIRMATION</label>
                    <input type="password" id="prof-pin-confirm" class="luxe-input" placeholder="****" maxlength="6" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ddd;">
                </div>
            </div>
            <button onclick="window.updateSecurityPin()" class="btn-gold" style="width:100%; margin-top:15px; padding:10px; background:#fff; color:#1e293b; font-size:0.75rem; border:1px solid #ddd; border-radius:6px; cursor:pointer;">
                MODIFIER MON CODE PIN
            </button>
        </div>
    `;
    lucide.createIcons();
};

window.saveMyProfile = async () => {
    const updates = {
        first_name: document.getElementById('prof-first').value.trim(),
        last_name: document.getElementById('prof-last').value.trim(),
        job_title: document.getElementById('prof-job').value.trim(),
        phone: document.getElementById('prof-phone').value.trim(),
        email: document.getElementById('prof-email').value.trim()
    };

    if (!updates.first_name || !updates.last_name) {
        return window.showNotice("Champs requis", "Le nom et le prénom sont obligatoires.");
    }

    const { error } = await supabaseClient.from('profiles').update(updates).eq('id', currentUser.id);

    if (!error) {
        window.showNotice("Succès", "Informations enregistrées.");
        currentUser.first_name = updates.first_name;
        currentUser.last_name = updates.last_name;
        localStorage.setItem('alsatia_user', JSON.stringify(currentUser));
        document.getElementById('user-name-display').innerText = `${updates.first_name} ${updates.last_name}`;
        closeCustomModal();
    } else {
        window.showNotice("Erreur", "Sauvegarde impossible.");
    }
};

window.updateSecurityPin = async () => {
    const pin = document.getElementById('prof-pin').value;
    const confirm = document.getElementById('prof-pin-confirm').value;

    if (!pin || pin.length < 4) {
        return window.showNotice("Sécurité", "Le PIN doit faire au moins 4 chiffres.");
    }
    if (pin !== confirm) {
        return window.showNotice("Erreur", "Les codes PIN ne correspondent pas.");
    }

    const { error } = await supabaseClient
        .from('profiles')
        .update({ pin: pin })
        .eq('id', currentUser.id);

    if (!error) {
        window.showNotice("Sécurité", "Code PIN modifié avec succès.");
        document.getElementById('prof-pin').value = "";
        document.getElementById('prof-pin-confirm').value = "";
    } else {
        window.showNotice("Erreur", "Échec de la modification du PIN.");
    }
};

// ==========================================
// MESSAGERIE & MENTIONS @ (VERSION PRO FINALE)
// ==========================================
/**
 * Active l'écoute en temps réel des nouveaux messages sur Supabase
 */
function subscribeToChat() {
    supabaseClient
        .channel('public:chat_global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, (payload) => {
            const currentSubj = document.getElementById('chat-subject-filter')?.value;
            // On rafraîchit si c'est un nouveau message dans le salon actuel 
            // ou si un message a été supprimé/modifié
            if (!currentSubj || (payload.new && payload.new.subject === currentSubj) || payload.eventType === 'DELETE') {
                loadChatMessages();
            }
        })
        .subscribe();
}

/**
 * Charge les noms des utilisateurs pour le système de @mentions
 */
async function loadUsersForMentions() {
    try {
        const { data } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
        const entities = ["Institut Alsatia", "Academia Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin"];
        
        if (data) {
            const users = data.map(u => `${u.first_name} ${u.last_name} (${u.portal})`);
            allUsersForMentions = [...entities, ...users];
        } else {
            allUsersForMentions = entities;
        }
    } catch (err) {
        console.error("Erreur lors du chargement des membres pour mentions:", err);
    }
}
// Initialisation des variables globales si non définies
if (typeof allUsersForMentions === 'undefined') { var allUsersForMentions = []; }
if (typeof selectedFile === 'undefined') { var selectedFile = null; }

/**
 * 1. CHARGEMENT DES DONNÉES DE RÉFÉRENCE
 */
async function loadUsersForMentions() {
    try {
        const { data } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
        const entities = ["Institut Alsatia", "Academia Alsatia", "Cours Herrade de Landsberg", "Collège Saints Louis et Zélie Martin"];
        if (data) {
            const users = data.map(u => `${u.first_name} ${u.last_name} (${u.portal})`);
            allUsersForMentions = [...entities, ...users];
        } else {
            allUsersForMentions = entities;
        }
    } catch (err) { console.error("Erreur mentions:", err); }
}

async function loadSubjects() {
    const { data } = await supabaseClient.from('chat_subjects').select('*').order('name');
    const select = document.getElementById('chat-subject-filter');
    if(!select) return;
    
    const mySubjects = (data || []).filter(s => s.entity === "Tous" || s.entity === currentUser.portal || !s.entity);
    
    select.innerHTML = mySubjects.map(s => {
        const icon = (s.entity === "Tous") ? "🌍" : "🔒";
        return `<option value="${s.name}">${icon} # ${s.name}</option>`;
    }).join('');
    
    select.onchange = () => loadChatMessages();
    loadChatMessages();
}

/**
 * 2. LOGIQUE DES MESSAGES (AFFICHAGE ET ENVOI)
 */
async function loadChatMessages() {
    const filter = document.getElementById('chat-subject-filter');
    if(!filter) return;
    const subj = filter.value;
    if(!subj) return;
    
    const { data } = await supabaseClient.from('chat_global').select('*').eq('subject', subj).order('created_at');
    const box = document.getElementById('chat-box');
    if(!box) return;

    box.innerHTML = (data || []).map(m => {
        const isMe = m.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
        let contentHtml = escapeHTML(m.content);
        contentHtml = contentHtml.replace(/@([\wÀ-ÿ-\s()]+)/g, '<span class="mention-badge">@$1</span>');
        
        return `
            <div class="message ${isMe ? 'my-msg' : ''}" style="margin-bottom:15px; display:flex; flex-direction:column; align-items:${isMe ? 'flex-end' : 'flex-start'};">
                <div class="msg-meta" style="font-size:0.7rem; margin-bottom:4px; opacity:0.7;">
                    <b style="color:var(--gold);">${m.author_full_name}</b> • ${m.portal}
                </div>
                <div class="msg-bubble" style="${isMe ? 'background:var(--primary); color:white;' : 'background:#f1f5f9; color:var(--primary);'} border-radius:12px; padding:10px; max-width:80%;">
                    <div class="msg-body" style="font-size:0.9rem; cursor:${isMe ? 'pointer' : 'default'};" onclick="${isMe ? `askEditMsg('${m.id}','${m.content.replace(/'/g, "\\'")}')` : ''}">
                        ${contentHtml}
                    </div>
                    ${m.file_url ? `<a href="${m.file_url}" target="_blank" style="display:block; margin-top:8px; font-size:0.7rem; color:var(--gold); border-top:1px solid rgba(180,145,87,0.2); padding-top:5px; text-decoration:none;">📄 Document joint</a>` : ''}
                </div>
                ${isMe ? `<div class="msg-actions" style="margin-top:3px;"><span onclick="askDeleteMsg('${m.id}')" style="font-size:0.6rem; color:#ef4444; cursor:pointer; opacity:0.8;">SUPPRIMER</span></div>` : ''}
            </div>
        `;
    }).join('');
    
    if(window.lucide) lucide.createIcons();
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const subj = document.getElementById('chat-subject-filter').value;
    const content = input.value.trim();
    if(!content && !selectedFile) return;

    let fUrl = null;
    if (selectedFile) {
        const path = `chat/${Date.now()}_${selectedFile.name}`;
        const { data } = await supabaseClient.storage.from('documents').upload(path, selectedFile);
        if (data) fUrl = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabaseClient.from('chat_global').insert([{ 
        content, author_name: currentUser.first_name, 
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        portal: currentUser.portal, subject: subj, file_url: fUrl 
    }]);

    if(!error) {
        input.value = ''; selectedFile = null;
        if(document.getElementById('file-preview')) document.getElementById('file-preview').innerHTML = "";
        loadChatMessages();
    }
};

/**
 * 3. SYNC EN TEMPS RÉEL (REALTIME)
 */
function subscribeToChat() {
    supabaseClient.channel('chat-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, (payload) => {
            const currentSubj = document.getElementById('chat-subject-filter').value;
            if (payload.new && payload.new.subject === currentSubj || payload.old) {
                loadChatMessages();
            }
        }).subscribe();
}

/**
 * 4. LOGIQUE DES MENTIONS @
 */
function setupMentionLogic() {
    const input = document.getElementById('chat-input');
    const container = document.querySelector('.chat-input-area');
    if(!input || !container) return;

    let suggestList = document.getElementById('mention-suggestions') || document.createElement('div');
    suggestList.id = "mention-suggestions";
    suggestList.className = "mention-suggestions-box";
    if(!document.getElementById('mention-suggestions')) container.appendChild(suggestList);

    input.addEventListener('input', () => {
        const pos = input.selectionStart;
        const lastWord = input.value.substring(0, pos).split(/\s/).pop();

        if (lastWord.startsWith('@')) {
            const query = lastWord.substring(1).toLowerCase();
            const matches = allUsersForMentions.filter(s => s.toLowerCase().includes(query));
            if (matches.length > 0) {
                suggestList.innerHTML = matches.map(m => `<div class="suggest-item">${m}</div>`).join('');
                suggestList.style.display = 'block';
                document.querySelectorAll('.suggest-item').forEach(item => {
                    item.onclick = () => {
                        const before = input.value.substring(0, pos - lastWord.length);
                        const after = input.value.substring(pos);
                        input.value = before + `@${item.innerText} ` + after;
                        suggestList.style.display = 'none';
                        input.focus();
                    };
                });
            } else { suggestList.style.display = 'none'; }
        } else { suggestList.style.display = 'none'; }
    });
}

/**
 * 5. GESTION DES SALONS (CREATE/DELETE)
 */
window.showNewSubjectModal = () => {
    showCustomModal(`
        <h3 class="luxe-title">Nouveau Salon</h3>
        <label class="mini-label">NOM</label>
        <input type="text" id="n-subject-name" class="luxe-input">
        <label class="mini-label" style="margin-top:10px; display:block;">VISIBILITÉ</label>
        <select id="n-subject-entity" class="luxe-input" style="width:100%;">
            <option value="Tous">🌍 Public</option>
            <option value="${currentUser.portal}">🔒 Privé (${currentUser.portal})</option>
        </select>
        <button onclick="execCreateSubject()" class="btn-gold" style="width:100%; margin-top:20px;">CRÉER</button>
    `);
};

window.execCreateSubject = async () => {
    const name = document.getElementById('n-subject-name').value.trim();
    const entity = document.getElementById('n-subject-entity').value;
    if(name) {
        await supabaseClient.from('chat_subjects').insert([{ name, entity }]);
        closeCustomModal(); loadSubjects();
    }
};

window.askDeleteSubject = () => {
    const subj = document.getElementById('chat-subject-filter').value;
    if (subj === "Général") return alert("Action impossible.");
    showCustomModal(`
        <h3 style="color:var(--danger);">Supprimer #${subj} ?</h3>
        <p style="font-size:0.8rem; margin:10px 0;">Tous les messages associés seront perdus.</p>
        <button onclick="execDeleteSubject('${subj}')" class="btn-danger" style="width:100%;">CONFIRMER</button>
    `);
};

window.execDeleteSubject = async (name) => {
    await supabaseClient.from('chat_global').delete().eq('subject', name);
    await supabaseClient.from('chat_subjects').delete().eq('name', name);
    closeCustomModal(); loadSubjects();
};

/**
 * 6. ACTIONS SUR LES MESSAGES (EDIT/DELETE)
 */
window.askEditMsg = (id, old) => {
    showCustomModal(`
        <h3 class="luxe-title">Modifier</h3>
        <textarea id="edit-area" class="luxe-input" style="height:100px; width:100%;">${old}</textarea>
        <button onclick="execEditMsg('${id}')" class="btn-gold" style="width:100%; margin-top:10px;">SAUVEGARDER</button>
    `);
};

window.execEditMsg = async (id) => {
    const val = document.getElementById('edit-area').value;
    await supabaseClient.from('chat_global').update({ content: val }).eq('id', id);
    closeCustomModal(); loadChatMessages();
};

window.askDeleteMsg = (id) => {
    showCustomModal(`
        <h3 style="color:var(--danger);">Supprimer ?</h3>
        <button onclick="execDeleteMsg('${id}')" class="btn-danger" style="width:100%; margin-top:10px;">CONFIRMER</button>
    `);
};

window.execDeleteMsg = async (id) => {
    await supabaseClient.from('chat_global').delete().eq('id', id);
    closeCustomModal(); loadChatMessages();
};

// Utils
function escapeHTML(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

function showCustomModal(html) {
    const m = document.getElementById('custom-modal');
    const b = document.getElementById('modal-body');
    if(m && b) { b.innerHTML = html; m.style.display = 'flex'; }
}

// ==========================================
// CRM COMPLET (DONATEURS)
// ==========================================

async function loadDonors() {
    const { data } = await supabaseClient.from('donors').select('*, donations(*)').order('last_name');
    allDonorsData = data || [];
    renderDonors(allDonorsData);
}

function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if(!list) return;
    list.innerHTML = data.map(d => {
        const total = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const needsThanks = d.donations?.some(don => !don.thanked);
        const name = d.company_name ? `<b>${d.company_name}</b><br><small>${d.last_name}</small>` : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
        
        return `<tr class="${needsThanks ? 'blink-warning' : ''}">
            <td>${name}</td>
            <td>${d.origin || d.entities || '-'}</td>
            <td><small>${d.notes ? d.notes.substring(0,25) : '-'}</small></td>
            <td style="color:var(--gold); font-weight:bold;">${total}€</td>
            <td><button onclick="openDonorFile('${d.id}')" class="btn-gold">Gérer</button></td>
        </tr>`;
    }).join('');
}

window.openDonorFile = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px; margin-bottom:15px;">
            <h3 style="margin:0; font-family:'Playfair Display', serif; color:var(--primary);">Fiche : ${d.company_name || d.last_name}</h3>
            <button onclick="closeCustomModal()" class="btn-gold" style="padding:5px 12px; height:auto;">
                <i data-lucide="x" style="width:16px; height:16px;"></i>
            </button>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; max-height:65vh; overflow-y:auto; padding-right:5px;">
            <div class="col">
                <label class="mini-label">SOCIÉTÉ</label>
                <input type="text" id="e-company" value="${d.company_name || ''}" class="luxe-input">
                
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label class="mini-label">NOM *</label>
                        <input type="text" id="e-last" value="${d.last_name || ''}" class="luxe-input">
                    </div>
                    <div style="flex:1;">
                        <label class="mini-label">PRÉNOM</label>
                        <input type="text" id="e-first" value="${d.first_name || ''}" class="luxe-input">
                    </div>
                </div>

                <label class="mini-label">EMAIL</label>
                <input type="email" id="e-email" value="${d.email || ''}" class="luxe-input">
                
                <label class="mini-label">TÉLÉPHONE</label>
                <input type="text" id="e-phone" value="${d.phone || ''}" class="luxe-input">

                <label class="mini-label">ORIGINE / ENTITÉ</label>
                <input type="text" id="e-origin" value="${d.origin || d.entities || ''}" class="luxe-input">
            </div>

            <div class="col">
                <label class="mini-label">ADRESSE</label>
                <input type="text" id="e-address" value="${d.address || ''}" class="luxe-input">
                
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label class="mini-label">CODE POSTAL</label>
                        <input type="text" id="e-zip" value="${d.zip_code || ''}" class="luxe-input">
                    </div>
                    <div style="flex:2;">
                        <label class="mini-label">VILLE</label>
                        <input type="text" id="e-city" value="${d.city || ''}" class="luxe-input">
                    </div>
                </div>

                <label class="mini-label">PROCHAINE ACTION</label>
                <input type="text" id="e-next" value="${d.next_action || ''}" class="luxe-input">

                <label class="mini-label">NOTES</label>
                <textarea id="e-notes" class="luxe-input" style="height:72px;">${d.notes || ''}</textarea>
            </div>

            <div style="grid-column: 1 / span 2; background:rgba(248, 250, 252, 0.5); padding:15px; border-radius:12px; border:1px solid #e2e8f0; margin-top:10px;">
                <h4 style="margin:0 0 10px 0; font-size:0.8rem; color:var(--primary); display:flex; align-items:center; gap:8px;">
                    <i data-lucide="heart" style="width:14px; color:var(--gold);"></i> GESTION DES DONS
                </h4>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                    <input type="number" id="d-amt" placeholder="Montant €" class="luxe-input">
                    <input type="date" id="d-date" value="${today}" class="luxe-input">
                    <input type="text" id="d-tax" placeholder="N° Reçu Fiscal" class="luxe-input">
                </div>
                <button onclick="addDonation('${d.id}')" class="btn-gold" style="width:100%; margin-top:10px; height:40px;">
                    AJOUTER LE DON
                </button>
                
                <div style="margin-top:15px; max-height:150px; overflow-y:auto; border-top:1px solid #e2e8f0; padding-top:10px;">
                    ${(d.donations || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #f1f5f9; font-size:0.8rem;">
                            <span style="flex:1;">${don.date} : <strong>${don.amount}€</strong> <small style="opacity:0.6;">${don.tax_receipt_number ? `(RF: ${don.tax_receipt_number})` : ''}</small></span>
                            <div style="display:flex; align-items:center; gap:15px;">
                                <label style="display:flex; align-items:center; gap:5px; cursor:pointer; font-size:0.7rem;">
                                    <input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="updateThanks('${don.id}','${d.id}',this.checked)"> Merci
                                </label>
                                <button onclick="askEditDonation('${don.id}', '${don.amount}', '${don.date}', '${don.tax_receipt_number || ''}', '${d.id}')" style="background:none; border:none; color:var(--primary); cursor:pointer; padding:5px;" title="Modifier">
                                    <i data-lucide="edit-3" style="width:14px; height:14px;"></i>
                                </button>
                                <button onclick="askDeleteDonation('${don.id}', '${d.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:5px;" title="Supprimer">
                                    <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div style="margin-top:20px; border-top:1px solid #e2e8f0; padding-top:15px; display:flex; justify-content:space-between; align-items:center;">
             <div style="display:flex; gap:10px;">
                <button onclick="askDeleteDonor('${d.id}', '${(d.company_name || d.last_name).replace(/'/g, "\\'")}')" class="btn-danger" style="padding:10px 20px;">
                    SUPPRIMER LA FICHE
                </button>
                <button onclick="exportDonorToExcel('${d.id}')" class="btn-gold" style="background:#64748b; color:white; border:none; padding:10px 15px;">
                    <i data-lucide="file-spreadsheet" style="width:14px; margin-right:5px; vertical-align:middle;"></i> EXPORT EXCEL
                </button>
             </div>

             <div style="text-align:right; display:flex; flex-direction:column; gap:5px;">
                 <small style="opacity:0.5; font-size:0.65rem;">Dernière modif : ${d.last_modified_by || 'N/A'}</small>
                 <button onclick="saveDonor('${d.id}')" class="btn-gold" style="padding:10px 40px; font-weight:bold;">
                     ENREGISTRER LA FICHE
                 </button>
             </div>
        </div>
    `;
    lucide.createIcons();
};

window.exportDonorToExcel = async (id) => {
    const { data: d } = await supabaseClient.from('donors').select('*, donations(*)').eq('id', id).single();
    const profileData = [
        ["CHAMP", "VALEUR"],
        ["NOM", d.last_name?.toUpperCase()],
        ["PRÉNOM", d.first_name || ""],
        ["SOCIÉTÉ", d.company_name || "-"],
        ["EMAIL", d.email || "-"],
        ["TÉLÉPHONE", d.phone || "-"],
        ["ADRESSE", d.address || "-"],
        ["CODE POSTAL", d.zip_code || "-"],
        ["VILLE", d.city || "-"],
        ["ENTITÉ", d.origin || d.entities || "-"],
        ["PROCHAINE ACTION", d.next_action || "-"],
        ["NOTES", d.notes || ""],
        ["DATE EXPORT", new Date().toLocaleDateString()]
    ];
    const donationsData = (d.donations || []).sort((a,b) => new Date(b.date) - new Date(a.date)).map(don => ({
        "Date": don.date,
        "Montant (€)": don.amount,
        "N° Reçu Fiscal": don.tax_receipt_number || "-",
        "Remercié": don.thanked ? "OUI" : "NON"
    }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(profileData);
    XLSX.utils.book_append_sheet(wb, ws1, "Profil Donateur");
    if (donationsData.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(donationsData);
        XLSX.utils.book_append_sheet(wb, ws2, "Historique Dons");
    }
    XLSX.writeFile(wb, `FICHE_${d.last_name.replace(/\s/g, '_')}.xlsx`);
};

window.addDonation = async (id) => {
    const amt = document.getElementById('d-amt').value;
    const date = document.getElementById('d-date').value;
    const tax = document.getElementById('d-tax').value;
    if(!amt || !date) return alert("Champs obligatoires.");
    await supabaseClient.from('donations').insert([{ donor_id: id, amount: parseFloat(amt), date, tax_receipt_number: tax, thanked: false }]);
    openDonorFile(id); loadDonors();
};

window.askEditDonation = (donId, amt, date, tax, donorId) => {
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Modifier le don</h3>
        <div style="padding:15px 0;">
            <label class="mini-label">MONTANT (€)</label>
            <input type="number" id="edit-d-amt" value="${amt}" class="luxe-input">
            <label class="mini-label">DATE</label>
            <input type="date" id="edit-d-date" value="${date}" class="luxe-input">
            <label class="mini-label">N° REÇU FISCAL</label>
            <input type="text" id="edit-d-tax" value="${tax}" class="luxe-input">
            
            <div style="margin-top:20px; display:flex; gap:10px;">
                <button onclick="execEditDonation('${donId}', '${donorId}')" class="btn-gold" style="flex:2; background:var(--primary);">ENREGISTRER</button>
                <button onclick="openDonorFile('${donorId}')" class="btn-gold" style="flex:1; background:#64748b;">ANNULER</button>
            </div>
        </div>`;
};

window.execEditDonation = async (donId, donorId) => {
    const amount = document.getElementById('edit-d-amt').value;
    const date = document.getElementById('edit-d-date').value;
    const tax = document.getElementById('edit-d-tax').value;
    await supabaseClient.from('donations').update({ amount: parseFloat(amount), date, tax_receipt_number: tax }).eq('id', donId);
    openDonorFile(donorId); loadDonors();
};

window.askDeleteDonation = (donId, donorId) => {
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center; padding:20px;">
            <h3 style="color:var(--danger);">Supprimer ce don ?</h3>
            <p>Voulez-vous vraiment retirer ce don de l'historique ?</p>
            <div style="margin-top:25px; display:flex; gap:10px;">
                <button onclick="execDeleteDonation('${donId}', '${donorId}')" class="btn-danger" style="flex:1;">OUI, SUPPRIMER</button>
                <button onclick="openDonorFile('${donorId}')" class="btn-gold" style="background:#64748b; flex:1;">ANNULER</button>
            </div>
        </div>`;
};

window.execDeleteDonation = async (donId, donorId) => {
    await supabaseClient.from('donations').delete().eq('id', donId);
    openDonorFile(donorId); loadDonors();
};

window.updateThanks = async (donId, donorId, val) => {
    await supabaseClient.from('donations').update({ thanked: val }).eq('id', donId);
    loadDonors();
};

window.saveDonor = async (id) => {
    const upd = {
        company_name: document.getElementById('e-company').value,
        last_name: document.getElementById('e-last').value,
        first_name: document.getElementById('e-first').value,
        email: document.getElementById('e-email').value,
        phone: document.getElementById('e-phone').value,
        address: document.getElementById('e-address').value,
        zip_code: document.getElementById('e-zip').value,
        city: document.getElementById('e-city').value,
        origin: document.getElementById('e-origin').value,
        notes: document.getElementById('e-notes').value,
        next_action: document.getElementById('e-next').value,
        last_modified_by: currentUser.first_name + " " + currentUser.last_name 
    };
    const { error } = await supabaseClient.from('donors').update(upd).eq('id', id);
    if (!error) { closeCustomModal(); loadDonors(); } 
    else { alert("Erreur lors de la sauvegarde."); }
};

window.filterDonors = () => {
    const search = document.getElementById('search-donor').value.toLowerCase();
    const entity = document.getElementById('filter-entity').value;
    const filtered = allDonorsData.filter(d => {
        const matchS = (d.last_name||'').toLowerCase().includes(search) || (d.company_name||'').toLowerCase().includes(search);
        const matchE = entity === "ALL" || d.origin === entity;
        return matchS && matchE;
    });
    renderDonors(filtered);
};

window.openNewDonorModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px; margin-bottom:20px;">
            <h3 style="margin:0; font-family:'Playfair Display', serif; color:var(--primary);">Nouveau Donateur</h3>
            <button onclick="closeCustomModal()" class="btn-gold" style="padding:5px 12px; height:auto;">
                <i data-lucide="x" style="width:16px; height:16px;"></i>
            </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:15px;">
            <div>
                <label class="mini-label">ENTREPRISE / SOCIÉTÉ</label>
                <input type="text" id="n-company" placeholder="Ex: Cabinet Durant" class="luxe-input">
            </div>
            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <label class="mini-label">PRÉNOM</label>
                    <input type="text" id="n-first" placeholder="Jean" class="luxe-input">
                </div>
                <div style="flex:1;">
                    <label class="mini-label">NOM *</label>
                    <input type="text" id="n-last" placeholder="Dupont" class="luxe-input">
                </div>
            </div>
            <div>
                <label class="mini-label">ENTITÉ RATTACHÉE (ORIGINE)</label>
                <select id="n-origin" class="luxe-input" style="width:100%; cursor:pointer;">
                    <option value="Institut Alsatia">Institut Alsatia</option>
                    <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
                    <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
                    <option value="Academia Alsatia">Academia Alsatia</option>
                </select>
            </div>
            <div style="margin-top:10px; padding-top:15px; border-top:1px solid #e2e8f0; display:flex; gap:10px;">
                <button onclick="execCreateDonor()" class="btn-gold" style="flex:2; height:45px; font-weight:bold; font-size:0.9rem;">
                    <i data-lucide="user-plus" style="width:18px; vertical-align:middle; margin-right:8px;"></i> CRÉER LA FICHE
                </button>
                <button onclick="closeCustomModal()" class="btn-gold" style="flex:1; background:#64748b; color:white; border:none;">
                    ANNULER
                </button>
            </div>
        </div>
    `;
    lucide.createIcons();
};

window.execCreateDonor = async () => {
    const lastName = document.getElementById('n-last').value.trim();
    if (!lastName) {
        alert("Le nom de famille est obligatoire.");
        return;
    }
    const { error } = await supabaseClient.from('donors').insert([{ 
        last_name: lastName, 
        first_name: document.getElementById('n-first').value.trim(),
        company_name: document.getElementById('n-company').value.trim(), 
        origin: document.getElementById('n-origin').value,
        last_modified_by: currentUser.first_name + " " + currentUser.last_name 
    }]);
    if (!error) {
        closeCustomModal();
        loadDonors();
        if(window.showNotice) window.showNotice("Fiche créée", "Le donateur a été ajouté.");
    } else {
        alert("Erreur lors de la création.");
    }
};

window.exportAllDonors = () => {
    const dataToExport = allDonorsData.map(d => {
        const totalAmount = d.donations?.reduce((s, n) => s + Number(n.amount), 0) || 0;
        const countDons = d.donations?.length || 0;
        const needsThanks = d.donations?.some(don => !don.thanked) ? "OUI" : "Non";
        const sortedDons = [...(d.donations || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastDonDate = sortedDons.length > 0 ? sortedDons[0].date : "-";
        return {
            "SOCIÉTÉ": d.company_name || "-",
            "NOM": d.last_name?.toUpperCase(),
            "PRÉNOM": d.first_name || "",
            "EMAIL": d.email || "-",
            "TÉLÉPHONE": d.phone || "-",
            "VILLE": d.city || "-",
            "ENTITÉ": d.origin || d.entities || "-",
            "TOTAL CUMULÉ (€)": totalAmount,
            "NB DE DONS": countDons,
            "DATE DERNIER DON": lastDonDate,
            "À REMERCIER ?": needsThanks,
            "PROCHAINE ACTION": d.next_action || "-",
            "NOTES": d.notes || ""
        };
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wscols = [
        {wch:20}, {wch:15}, {wch:15}, {wch:25}, {wch:15}, 
        {wch:15}, {wch:20}, {wch:15}, {wch:10}, {wch:15}, 
        {wch:12}, {wch:25}, {wch:30}
    ];
    ws['!cols'] = wscols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base Donateurs");
    const dateFile = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `EXPORT_CRM_ALSATIA_${dateFile}.xlsx`);
};

window.askDeleteDonor = (id, name) => {
    if (currentUser.portal !== "Institut Alsatia") return alert("Action réservée à l'administrateur.");
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center; padding:20px;">
            <h3 style="color:var(--danger); margin-bottom:15px;">Supprimer définitivement ?</h3>
            <p>Voulez-vous vraiment supprimer la fiche de :<br><b>${name}</b> ?</p>
            <div style="margin-top:25px; display:flex; gap:10px;">
                <button onclick="execDeleteDonor('${id}')" class="btn-danger" style="flex:2;">OUI, SUPPRIMER</button>
                <button onclick="closeCustomModal()" class="btn-gold" style="background:#64748b; flex:1;">ANNULER</button>
            </div>
        </div>`;
};

window.execDeleteDonor = async (id) => {
    await supabaseClient.from('donations').delete().eq('donor_id', id);
    await supabaseClient.from('donors').delete().eq('id', id);
    closeCustomModal(); loadDonors();
};

// ==========================================
// TEMPS RÉEL & FICHIERS
// ==========================================

function listenRealtime() {
    supabaseClient.channel('alsatia-final').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        loadChatMessages();
        if(currentUser.portal === "Institut Alsatia") loadDonors();
    }).subscribe();
}

let selectedFile = null;
window.handleFileUpload = (input) => { 
    if(input.files[0]) { 
        selectedFile = input.files[0]; 
        document.getElementById('file-preview').innerText = "📎 " + selectedFile.name; 
    } 
};

// ==========================================
// GESTION DES ÉVÉNEMENTS (VUE CHRONOLOGIQUE)
// ==========================================

window.loadEvents = async () => {
    const { data, error } = await supabaseClient
        .from('events')
        .select(`
            id, title, event_date, event_time, location, entity, description,
            event_resources(id, file_url, description)
        `)
        .order('event_date', { ascending: true });
    if (error) return console.error(error);
    renderEvents(data);
};

function renderEvents(events) {
    const container = document.getElementById('events-container'); 
    if (!container) return;
    if (!events || events.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.5;">Aucun événement programmé.</div>`;
        return;
    }

    const grouped = {};
    events.forEach(ev => {
        const monthYear = new Date(ev.event_date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
        if (!grouped[monthYear]) grouped[monthYear] = [];
        grouped[monthYear].push(ev);
    });

    let html = "";
    for (const [month, monthEvents] of Object.entries(grouped)) {
        html += `<div class="month-divider"><h2>${month}</h2></div><div class="kanban-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px; margin-bottom: 30px;">`;
        const cat = {
            todo: monthEvents.filter(ev => !isStarted(ev)),
            progress: monthEvents.filter(ev => isStarted(ev) && !isEventReady(ev)),
            ready: monthEvents.filter(ev => isEventReady(ev))
        };
        html += `
            <div class="kanban-column" style="background:#f8fafc; padding:12px; border-radius:10px; border:1px solid #e2e8f0;">
                <h3 style="font-size:0.7rem; color:#64748b; margin-bottom:12px; font-weight:800; border-bottom:1px solid #ddd; padding-bottom:5px;">À PLANIFIER (${cat.todo.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">${cat.todo.map(ev => renderMiniCard(ev)).join('')}</div>
            </div>
            <div class="kanban-column" style="background:#fff7ed; padding:12px; border-radius:10px; border:1px solid #ffedd5;">
                <h3 style="font-size:0.7rem; color:#b45309; margin-bottom:12px; font-weight:800; border-bottom:1px solid #fed7aa; padding-bottom:5px;">EN PRÉPARATION (${cat.progress.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">${cat.progress.map(ev => renderMiniCard(ev)).join('')}</div>
            </div>
            <div class="kanban-column" style="background:#f0fdf4; padding:12px; border-radius:10px; border:1px solid #dcfce7;">
                <h3 style="font-size:0.7rem; color:#166534; margin-bottom:12px; font-weight:800; border-bottom:1px solid #bbf7d0; padding-bottom:5px;">PRÊT COM (${cat.ready.length})</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">${cat.ready.map(ev => renderMiniCard(ev)).join('')}</div>
            </div></div>`;
    }
    container.style.display = "block"; container.innerHTML = html; lucide.createIcons();
}

function isStarted(ev) { return ev.event_resources?.some(r => (r.description && r.description.length > 5) || r.file_url); }
function isEventReady(ev) { return ev.event_resources?.some(r => r.description && r.description.length > 10) && ev.event_resources?.some(r => r.file_url); }

function renderMiniCard(ev) {
    const canManage = (currentUser.portal === "Institut Alsatia" || currentUser.portal === ev.entity);
    const dateFr = new Date(ev.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `
        <div class="event-card-mini" style="background:white; padding:10px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05); border-left: 4px solid ${getColorByEntity(ev.entity)};">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:5px;">
                <span style="font-size: 0.65rem; color: ${getColorByEntity(ev.entity)}; font-weight: bold; background:${getColorByEntity(ev.entity)}15; padding:2px 6px; border-radius:4px;">${ev.entity}</span>
                <span style="font-size:0.7rem; font-weight:700; color:#64748b;">${dateFr}</span>
            </div>
            <h4 style="margin: 5px 0 10px 0; font-size: 0.85rem; line-height:1.2; color:#1e293b;">${ev.title}</h4>
            <div style="display: flex; gap: 4px;">
                <button onclick="window.openEventMedia('${ev.id}')" class="btn-mini-gold" style="flex:2; font-size:0.7rem; padding:5px;"><i data-lucide="camera" style="width:12px;"></i> COM</button>
                <button onclick="window.openEventGuests('${ev.id}')" class="btn-mini-gold" style="flex:1; padding:5px; background:#f1f5f9; color:black; border:1px solid #ddd;"><i data-lucide="users" style="width:12px;"></i></button>
                ${canManage ? `<button onclick="window.askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" style="padding:5px; background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:14px;"></i></button>` : ''}
            </div>
        </div>`;
}

window.openEventMedia = async (eventId) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', eventId).single();
    const { data: res } = await supabaseClient.from('event_resources').select('*').eq('event_id', eventId);
    const textData = (res || []).find(r => !r.file_url);
    const photos = (res || []).filter(r => r.file_url);

    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;">
            <h3>Dossier Com' : ${ev.title}</h3>
            <button onclick="closeCustomModal()" class="btn-gold">X</button>
        </div>
        <div style="margin-top:15px; max-height:75vh; overflow-y:auto; padding-right:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label class="mini-label" style="margin:0;">LÉGENDE / POST RÉSEAUX</label>
                <button onclick="window.copyEventText()" class="btn-mini-gold" style="font-size:0.65rem; padding:2px 8px; background:#1e293b; color:white;"><i data-lucide="copy" style="width:10px;"></i> COPIER</button>
            </div>
            <textarea id="res-text" class="luxe-input" style="height:120px; font-size:0.9rem; margin-bottom:15px;" placeholder="Rédigez ici le post...">${textData ? textData.description : ''}</textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <label class="mini-label" style="margin:0;">PHOTOS & VISUELS</label>
                <input type="file" id="res-file" style="display:none;" onchange="window.uploadEventFile('${eventId}')" accept="image/*">
                <button onclick="document.getElementById('res-file').click()" class="btn-mini-gold" style="font-size:0.65rem;">+ AJOUTER PHOTO</button>
            </div>
            <div id="media-gallery" style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
                ${photos.map(r => `
                    <div class="gallery-item" style="position:relative; height:100px; border:1px solid #eee; border-radius:5px; overflow:hidden; background:#f8fafc;">
                        <img src="${r.file_url}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); display:flex; justify-content:space-around; padding:5px;">
                            <button onclick="window.downloadImage('${r.file_url}', 'photo_${eventId}')" style="background:none; border:none; color:white; cursor:pointer;"><i data-lucide="download" style="width:14px;"></i></button>
                            <button onclick="window.deleteResource('${r.id}', '${eventId}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer;"><i data-lucide="trash-2" style="width:14px;"></i></button>
                        </div>
                    </div>`).join('')}
            </div>
            <button onclick="window.saveEventContent('${eventId}')" class="btn-gold" style="width:100%; margin-top:20px; background:#107c10; border:none;">ENREGISTRER</button>
        </div>`;
    lucide.createIcons();
};

window.copyEventText = () => {
    const textArea = document.getElementById('res-text');
    if (!textArea || !textArea.value) return;
    navigator.clipboard.writeText(textArea.value);
    window.showNotice("Copié !", "Texte prêt à être collé.");
};

window.downloadImage = async (url, filename) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    link.click();
};

window.uploadEventFile = async (eventId) => {
    const file = document.getElementById('res-file').files[0];
    if(!file) return;
    const path = `events/${eventId}/${Date.now()}_${file.name}`;
    const { data } = await supabaseClient.storage.from('documents').upload(path, file);
    if (data) {
        const url = supabaseClient.storage.from('documents').getPublicUrl(path).data.publicUrl;
        await supabaseClient.from('event_resources').insert([{ event_id: eventId, file_url: url }]);
        window.openEventMedia(eventId); window.loadEvents();
    }
};

window.saveEventContent = async (eventId) => {
    const text = document.getElementById('res-text').value;
    const { data: res } = await supabaseClient.from('event_resources').select('*').eq('event_id', eventId);
    const existing = res?.find(r => !r.file_url);
    if(existing) await supabaseClient.from('event_resources').update({ description: text }).eq('id', existing.id);
    else await supabaseClient.from('event_resources').insert([{ event_id: eventId, description: text }]);
    window.showNotice("Succès", "Texte mis à jour."); window.loadEvents();
};

window.deleteResource = async (resId, eventId) => {
    await supabaseClient.from('event_resources').delete().eq('id', resId);
    window.openEventMedia(eventId); window.loadEvents();
};

window.openEventGuests = async (eventId) => {
    const { data: donors } = await supabaseClient.from('donors').select('id, last_name, first_name, company_name').order('last_name');
    const { data: guests } = await supabaseClient.from('event_guests').select('donor_id').eq('event_id', eventId);
    const guestIds = (guests || []).map(g => g.donor_id);
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; border-bottom:2px solid var(--gold); padding-bottom:10px;"><h3>Liste des Invités</h3><button onclick="closeCustomModal()" class="btn-gold">X</button></div>
        <div style="margin-top:15px; display:flex; flex-direction:column; gap:10px;">
            <input type="text" id="guest-search" class="luxe-input" placeholder="Rechercher..." oninput="window.filterGuestList()">
            <div id="guest-list-scroll" style="max-height:400px; overflow-y:auto; border:1px solid #eee; border-radius:8px;">
                ${donors.map(d => `
                    <label class="guest-item" data-name="${d.last_name} ${d.first_name}" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #f9f9f9; cursor:pointer;">
                        <input type="checkbox" ${guestIds.includes(d.id) ? 'checked' : ''} onchange="window.toggleGuest('${eventId}', '${d.id}', this.checked)" style="margin-right:12px; width:18px; height:18px;">
                        <div style="flex:1; font-size:0.85rem;"><strong>${d.last_name} ${d.first_name || ''}</strong><br><span style="color:gray; font-size:0.75rem;">${d.company_name || ''}</span></div>
                    </label>`).join('')}
            </div>
        </div>`;
};

window.filterGuestList = () => {
    const q = document.getElementById('guest-search').value.toLowerCase();
    document.querySelectorAll('.guest-item').forEach(item => { item.style.display = item.getAttribute('data-name').toLowerCase().includes(q) ? 'flex' : 'none'; });
};

window.toggleGuest = async (eventId, donorId, isChecked) => {
    if (isChecked) await supabaseClient.from('event_guests').insert([{ event_id: eventId, donor_id: donorId }]);
    else await supabaseClient.from('event_guests').delete().eq('event_id', eventId).eq('donor_id', donorId);
};

window.openNewEventModal = () => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <h3 style="color:var(--primary); border-bottom:1px solid var(--gold); padding-bottom:10px;">Nouvel Événement</h3>
        <label class="mini-label">TITRE</label><input type="text" id="ev-title" class="luxe-input">
        <div style="display:flex; gap:10px;">
            <div style="flex:1;"><label class="mini-label">DATE</label><input type="date" id="ev-date" class="luxe-input"></div>
            <div style="flex:1;"><label class="mini-label">HEURE</label><input type="time" id="ev-time" class="luxe-input"></div>
        </div>
        <label class="mini-label">ENTITÉ</label>
        <select id="ev-entity" class="luxe-input">
            <option value="Institut Alsatia">Institut Alsatia</option>
            <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
            <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
            <option value="Academia Alsatia">Academia Alsatia</option>
        </select>
        <label class="mini-label">LIEU</label><input type="text" id="ev-loc" class="luxe-input">
        <button onclick="window.execCreateEvent()" class="btn-gold" style="width:100%; margin-top:15px;">PUBLIER</button>`;
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    if (!title || !date) return alert("Titre et date requis.");
    await supabaseClient.from('events').insert([{
        title, event_date: date, event_time: document.getElementById('ev-time').value || null,
        location: document.getElementById('ev-loc').value || null, entity: document.getElementById('ev-entity').value,
        created_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);
    closeCustomModal(); window.loadEvents();
};

window.askDeleteEvent = (id, title) => {
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <div style="color:#ef4444; margin-bottom:15px;"><i data-lucide="alert-triangle" style="width:48px; height:48px; margin:0 auto;"></i></div>
            <h3>Supprimer l'événement ?</h3>
            <p style="color:#64748b; font-size:0.9rem; margin-bottom:20px;">Voulez-vous supprimer <strong>"${title}"</strong> ?</p>
            <div style="display:flex; gap:10px;">
                <button onclick="closeCustomModal()" class="btn-gold" style="flex:1; background:#f1f5f9; color:#1e293b; border:1px solid #cbd5e1;">ANNULER</button>
                <button onclick="window.execDeleteEvent('${id}')" style="flex:1; background:#fee2e2; color:#ef4444; border:1px solid #fecaca; border-radius:8px; font-weight:bold; cursor:pointer;">SUPPRIMER</button>
            </div>
        </div>`;
    lucide.createIcons();
};

window.execDeleteEvent = async (id) => {
    await supabaseClient.from('event_resources').delete().eq('event_id', id);
    await supabaseClient.from('event_guests').delete().eq('event_id', id);
    await supabaseClient.from('events').delete().eq('id', id);
    closeCustomModal(); window.loadEvents();
};

function getColorByEntity(ent) {
    const colors = {"Institut Alsatia":"#1e3a8a", "Cours Herrade de Landsberg":"#15803d", "Collège Saints Louis et Zélie Martin":"#b91c1c", "Academia Alsatia":"#b45309"};
    return colors[ent] || "#666";
}
