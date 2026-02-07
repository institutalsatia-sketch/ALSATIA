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
// MOTEUR DE DIALOGUE DE LUXE (INDISPENSABLE)
// ==========================================
window.alsatiaConfirm = (title, text, callback, isDanger = false) => {
    // Vérifie si la fonction showCustomModal existe pour éviter un autre crash
    if (typeof showCustomModal !== 'function') {
        console.error("Erreur : showCustomModal n'est pas définie dans votre script principal.");
        return;
    }

    showCustomModal(`
        <div class="confirm-box" style="text-align:center; padding:10px;">
            <h3 class="luxe-title" style="${isDanger ? 'color:var(--danger)' : ''}; margin-bottom:15px;">${title}</h3>
            <p style="margin-bottom:25px; color:var(--text-main); font-size:0.95rem;">${text}</p>
            <div class="confirm-actions" style="display:flex; gap:12px; justify-content:center;">
                <button onclick="closeCustomModal()" class="btn-gold" style="background:var(--border); color:var(--text-main); border:none; padding:10px 20px; border-radius:12px; cursor:pointer;">ANNULER</button>
                <button id="modal-confirm-action" class="btn-gold" style="${isDanger ? 'background:var(--danger)' : ''}; border:none; padding:10px 20px; border-radius:12px; cursor:pointer; color:white;">CONFIRMER</button>
            </div>
        </div>
    `);

    // On lie l'action au bouton de confirmation
    const confirmBtn = document.getElementById('modal-confirm-action');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            callback();
            closeCustomModal();
        };
    }
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
window.switchTab = (tabId) => { // <-- Assure-toi que tabId est bien ici
    console.log("Changement d'onglet vers :", tabId);

    // 1. Gère l'affichage visuel des onglets
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById(tabId);
    if (targetPage) targetPage.classList.add('active');
    
    // On cherche l'élément de menu correspondant pour mettre l'icône en doré
    const menuIcon = document.querySelector(`li[onclick*="${tabId}"]`);
    if (menuIcon) menuIcon.classList.add('active');

    // 2. CHARGEMENT DES DONNÉES SPÉCIFIQUES
    if (tabId === 'donors') loadDonors();
    if (tabId === 'events') loadEvents();
    
    // Activation de la Messagerie que nous venons de créer
    if (tabId === 'chat') {
        window.loadChatSubjects();
        window.loadChatMessages();
        window.subscribeToChat();
    }
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
// CRM ALSATIA - VERSION INTÉGRALE DÉFINITIVE
// ==========================================

// Sécurité pour la variable globale
if (typeof window.allDonorsData === 'undefined') {
    window.allDonorsData = [];
}

/**
 * 1. CHARGEMENT DES DONNÉES
 */
async function loadDonors() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) {
        console.error("Erreur de chargement CRM:", error);
        return;
    }
    window.allDonorsData = data || [];
    window.filterDonors();
}

/**
 * 2. SYSTÈME DE FILTRAGE
 */
window.filterDonors = () => {
    const searchVal = document.getElementById('search-donor')?.value.toLowerCase().trim() || "";
    const entityVal = document.getElementById('filter-entity')?.value || "ALL";

    const filtered = window.allDonorsData.filter(d => {
        const matchesSearch = 
            (d.last_name || "").toLowerCase().includes(searchVal) || 
            (d.first_name || "").toLowerCase().includes(searchVal) ||
            (d.company_name || "").toLowerCase().includes(searchVal) ||
            (d.city || "").toLowerCase().includes(searchVal) ||
            (d.email || "").toLowerCase().includes(searchVal);

        const matchesEntity = (entityVal === "ALL" || d.entity === entityVal);
        return matchesSearch && matchesEntity;
    });
    renderDonors(filtered);
};

/**
 * 3. AFFICHAGE DE LA LISTE PRINCIPALE
 */
function renderDonors(data) {
    const list = document.getElementById('donors-list');
    if (!list) return;
    
    list.innerHTML = data.map(d => {
        const dons = d.donations || [];
        const total = dons.reduce((acc, cur) => acc + Number(cur.amount), 0);
        const hasUnthanked = dons.some(don => don.thanked === false);
        const blinkClass = hasUnthanked ? 'blink-warning' : '';

        const displayName = d.company_name 
            ? `<b>${d.company_name.toUpperCase()}</b> <span style="font-size:0.7rem; color:#64748b;">(${d.last_name})</span>` 
            : `<b>${d.last_name.toUpperCase()}</b> ${d.first_name || ''}`;
            
        return `
            <tr class="${blinkClass}">
                <td>
                    ${displayName}
                    ${hasUnthanked ? '<br><span class="badge-error">REMERCIEMENT DÛ</span>' : ''}
                </td>
                <td><span class="origin-tag">${d.entity || '-'}</span></td>
                <td style="font-weight:800; color:var(--primary); font-family:monospace; font-size:1rem;">
                    ${total.toLocaleString('fr-FR')} €
                </td>
                <td style="text-align:right;">
                    <button onclick="window.openDonorFile('${d.id}')" class="btn-gold" style="padding:6px 14px;">DOSSIER</button>
                </td>
            </tr>`;
    }).join('');
}

/**
 * 4. CRÉATION D'UNE FICHE
 */
window.showAddDonorModal = () => {
    const userPortal = currentUser.portal;
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">NOUVEAU CONTACT CRM</h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p class="mini-label">AFFECTATION ÉCOLE *</p>
            <select id="n-d-entity" class="luxe-input" style="border:1px solid var(--gold); margin-bottom:15px;">
                <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
            </select>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">NOM *</p><input type="text" id="n-d-last" class="luxe-input"></div>
                <div><p class="mini-label">PRÉNOM</p><input type="text" id="n-d-first" class="luxe-input"></div>
            </div>
            <p class="mini-label">ENTREPRISE (Optionnel)</p>
            <input type="text" id="n-d-company" class="luxe-input" style="margin-bottom:15px;">
            <p class="mini-label">COORDONNÉES</p>
            <input type="email" id="n-d-email" class="luxe-input" placeholder="Email" style="margin-bottom:8px;">
            <input type="text" id="n-d-phone" class="luxe-input" placeholder="Téléphone" style="margin-bottom:15px;">
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">CP</p><input type="text" id="n-d-zip" class="luxe-input"></div>
                <div><p class="mini-label">VILLE</p><input type="text" id="n-d-city" class="luxe-input"></div>
            </div>
            <p class="mini-label">NOTES / ORIGINE (ex: Gala 2025)</p>
            <textarea id="n-d-notes" class="luxe-input" style="height:60px;"></textarea>
            <button onclick="window.execCreateDonor()" class="btn-gold-fill" style="width:100%; margin-top:20px;">CRÉER LE CONTACT</button>
        </div>
    `);
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-d-last').value.trim();
    const ent = document.getElementById('n-d-entity').value;
    if(!last || !ent) return window.showNotice("Erreur", "Le Nom et l'Entité sont obligatoires.");

    const { error } = await supabaseClient.from('donors').insert([{
        last_name: last.toUpperCase(),
        first_name: document.getElementById('n-d-first').value.trim(),
        company_name: document.getElementById('n-d-company').value.trim(),
        entity: ent,
        email: document.getElementById('n-d-email').value,
        phone: document.getElementById('n-d-phone').value,
        zip_code: document.getElementById('n-d-zip').value,
        city: document.getElementById('n-d-city').value,
        notes: document.getElementById('n-d-notes').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if(error) return window.showNotice("Erreur", error.message);
    window.showNotice("Succès", "Donateur enregistré.");
    closeCustomModal();
    loadDonors();
};

/**
 * 5. DOSSIER DONATEUR (INTERFACE COMPLÈTE)
 */
window.openDonorFile = async (id) => {
    const donor = window.allDonorsData.find(d => d.id === id);
    if (!donor) return;
    const dons = donor.donations || [];
    
    document.getElementById('custom-modal').style.display = 'flex';
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
            <div>
                <p class="mini-label">ÉCOLE / ENTITÉ</p>
                <select id="edit-entity" class="luxe-input" style="margin-top:5px; border:1px solid var(--gold);">
                    <option ${donor.entity === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                    <option ${donor.entity === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                    <option ${donor.entity === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                    <option ${donor.entity === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
                </select>
            </div>
            <div style="display:flex; gap:10px;">
                <button onclick="window.exportDonorToExcel('${donor.id}')" class="btn-gold" style="font-size:0.65rem; padding:5px 10px;">EXCEL</button>
                <button onclick="window.askDeleteDonor('${donor.id}', '${donor.last_name.replace(/'/g, "\\'")}')" style="background:#fee2e2; color:#ef4444; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.65rem;">SUPPRIMER</button>
                <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
            </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div>
                <p class="mini-label">COORDONNÉES</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <input type="text" id="edit-last" class="luxe-input" value="${donor.last_name || ''}" placeholder="NOM">
                    <input type="text" id="edit-first" class="luxe-input" value="${donor.first_name || ''}" placeholder="PRÉNOM">
                </div>
                <input type="text" id="edit-company" class="luxe-input" value="${donor.company_name || ''}" placeholder="Entreprise" style="margin-bottom:8px;">
                <input type="email" id="edit-email" class="luxe-input" value="${donor.email || ''}" placeholder="Email" style="margin-bottom:8px;">
                <input type="text" id="edit-phone" class="luxe-input" value="${donor.phone || ''}" placeholder="Tél" style="margin-bottom:8px;">
                <div style="display:grid; grid-template-columns:1fr 2fr; gap:8px;">
                    <input type="text" id="edit-zip" class="luxe-input" value="${donor.zip_code || ''}" placeholder="CP">
                    <input type="text" id="edit-city" class="luxe-input" value="${donor.city || ''}" placeholder="VILLE">
                </div>
            </div>
            <div>
                <p class="mini-label">SUIVI CRM</p>
                <input type="text" id="edit-origin" class="luxe-input" value="${donor.origin || ''}" placeholder="Origine" style="margin-bottom:8px;">
                <textarea id="edit-notes" class="luxe-input" style="height:110px; margin-bottom:10px;">${donor.notes || ''}</textarea>
                <button onclick="window.updateDonorFields('${donor.id}')" class="btn-gold" style="width:100%; height:40px;">ENREGISTRER</button>
            </div>
        </div>

        <div style="margin-top:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <p class="mini-label">HISTORIQUE DES DONS</p>
                <button onclick="window.addDonationPrompt('${id}')" class="btn-gold" style="padding:4px 10px; font-size:0.65rem;">+ AJOUTER UN DON</button>
            </div>
            <div style="max-height:180px; overflow-y:auto; border:1px solid #eee; margin-top:10px; border-radius:8px;">
                <table class="luxe-table">
                    <thead><tr><th>DATE</th><th>MONTANT</th><th>REMERCIÉ ?</th><th style="text-align:right;">ACTION</th></tr></thead>
                    <tbody>
                        ${dons.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:15px; color:#999;">Aucun don enregistré</td></tr>' : ''}
                        ${dons.map(don => `
                            <tr style="${!don.thanked ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                <td>${new Date(don.date).toLocaleDateString()}</td>
                                <td style="font-weight:700;">${don.amount}€</td>
                                <td style="text-align:center;">
                                    <input type="checkbox" ${don.thanked ? 'checked' : ''} onchange="window.toggleThanked('${don.id}', this.checked)">
                                </td>
                                <td style="text-align:right;">
                                    <i data-lucide="trash-2" style="width:14px; color:#ef4444; cursor:pointer;" onclick="window.askDeleteDonation('${don.id}')"></i>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    lucide.createIcons();
};

/**
 * 6. LOGIQUE DES DONS
 */
window.toggleThanked = async (donId, isChecked) => {
    await supabaseClient.from('donations').update({ thanked: isChecked }).eq('id', donId);
    loadDonors(); 
};

window.addDonationPrompt = (donorId) => {
    showCustomModal(`
        <h3 class="luxe-title">ENREGISTRER UN DON</h3>
        <p class="mini-label">MONTANT (€)</p>
        <input type="number" id="don-amt" class="luxe-input" placeholder="0.00">
        <p class="mini-label" style="margin-top:10px;">DATE DU DON</p>
        <input type="date" id="don-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
        <p class="mini-label" style="margin-top:10px;">MODE DE PAIEMENT</p>
        <select id="don-method" class="luxe-input">
            <option>Virement</option><option>Chèque</option><option>Espèces</option><option>CB</option><option>Autre</option>
        </select>
        <button onclick="window.execAddDonation('${donorId}')" class="btn-gold-fill" style="width:100%; margin-top:20px;">VALIDER LE PAIEMENT</button>
    `);
};

window.execAddDonation = async (donorId) => {
    const amt = document.getElementById('don-amt').value;
    const dat = document.getElementById('don-date').value;
    if (!amt || amt <= 0) return window.showNotice("Erreur", "Montant invalide.");

    await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amt),
        date: dat,
        payment_mode: document.getElementById('don-method').value,
        thanked: false
    }]);

    window.showNotice("Bravo !", "Don enregistré.");
    if(typeof loadDashboardData === 'function') loadDashboardData(); 
    closeCustomModal();
    loadDonors();
};

window.updateDonorFields = async (id) => {
    const payload = {
        entity: document.getElementById('edit-entity').value,
        last_name: document.getElementById('edit-last').value.toUpperCase(),
        first_name: document.getElementById('edit-first').value,
        company_name: document.getElementById('edit-company').value,
        email: document.getElementById('edit-email').value,
        phone: document.getElementById('edit-phone').value,
        zip_code: document.getElementById('edit-zip').value,
        city: document.getElementById('edit-city').value,
        origin: document.getElementById('edit-origin').value,
        notes: document.getElementById('edit-notes').value,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };
    const { error } = await supabaseClient.from('donors').update(payload).eq('id', id);
    if(error) return window.showNotice("Erreur", error.message);
    window.showNotice("Succès", "Fiche mise à jour.");
    loadDonors();
};

/**
 * 7. EXPORTS EXCEL
 */
window.exportAllDonors = () => {
    if (!window.allDonorsData.length) return window.showNotice("Erreur", "Aucune donnée.");
    const yearFilter = document.getElementById('export-year')?.value;
    const wb = XLSX.utils.book_new();
    
    const contactsSheet = XLSX.utils.json_to_sheet(window.allDonorsData.map(({donations, ...d}) => d));
    XLSX.utils.book_append_sheet(wb, contactsSheet, "Répertoire");
    
    const dons = [];
    window.allDonorsData.forEach(d => {
        (d.donations || []).forEach(don => {
            const donYear = new Date(don.date).getFullYear().toString();
            if (!yearFilter || donYear === yearFilter) {
                dons.push({
                    NOM: d.last_name, PRÉNOM: d.first_name, ÉCOLE: d.entity,
                    MONTANT: don.amount, DATE: don.date, MODE: don.payment_mode,
                    REMERCIÉ: don.thanked ? 'OUI' : 'NON'
                });
            }
        });
    });
    
    const donsSheet = XLSX.utils.json_to_sheet(dons);
    XLSX.utils.book_append_sheet(wb, donsSheet, "Journal des Dons");
    XLSX.writeFile(wb, `ALSATIA_CRM_Export_${yearFilter || 'GLOBAL'}.xlsx`);
};

window.exportDonorToExcel = (id) => {
    const d = window.allDonorsData.find(x => x.id === id);
    const wb = XLSX.utils.book_new();
    const info = [{ NOM: d.last_name, PRÉNOM: d.first_name, ÉCOLE: d.entity, EMAIL: d.email, TÉL: d.phone }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "Identité");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.donations || []), "Historique Dons");
    XLSX.writeFile(wb, `Fiche_${d.last_name}.xlsx`);
};

/**
 * 8. SUPPRESSIONS (INTERFACE LUXE)
 */
window.askDeleteDonation = (donId) => {
    window.alsatiaConfirm(
        "SUPPRIMER CE DON", 
        "Voulez-vous supprimer ce don définitivement ?",
        async () => {
            await supabaseClient.from('donations').delete().eq('id', donId);
            window.showNotice("Supprimé", "Don effacé.");
            loadDonors();
            closeCustomModal();
        },
        true
    );
};

window.askDeleteDonor = (id, name) => {
    window.alsatiaConfirm(
        "SUPPRESSION DÉFINITIVE", 
        `ATTENTION : Voulez-vous vraiment supprimer <b>${name}</b> et l'intégralité de ses dons ?`,
        async () => {
            await Promise.all([
                supabaseClient.from('donations').delete().eq('donor_id', id),
                supabaseClient.from('donors').delete().eq('id', id)
            ]);
            window.showNotice("Supprimé", "Contact effacé.");
            loadDonors();
            closeCustomModal();
        },
        true
    );
};

function loadUsersForMentions() { console.log("Module CRM Alsatia v1.0 chargé."); }

// ==========================================
// GESTION DES ÉVÉNEMENTS - SYSTÈME COMPLET & RÉSEAUX
// ==========================================

// 1. DASHBOARD : LISTE GLOBALE AVEC INDICATEUR DE STATUT
async function loadEvents() {
    const { data, error } = await supabaseClient
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

    const container = document.getElementById('events-container');
    if (!container || error) return;

    if (data.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:40px; opacity:0.6;">Aucun événement planifié.</p>`;
        return;
    }

    container.innerHTML = data.map(ev => {
        // Un événement est prêt si marqué "Complet" OU si les 3 champs clés sont remplis
        const isReady = ev.status === 'Complet' || (ev.event_time && ev.location && ev.description && ev.description.length > 10);
        return `
            <div class="event-card" onclick="window.openEventDetails('${ev.id}')" 
                 style="background:white; border-radius:12px; border:1px solid #e2e8f0; border-left: 6px solid ${isReady ? '#22c55e' : '#f59e0b'}; cursor:pointer; padding:15px; transition:all 0.3s ease;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                    <span class="mini-label" style="color:var(--gold);">${ev.entity}</span>
                    <span style="font-size:0.6rem; font-weight:800; color:${isReady ? '#166534' : '#9a3412'}; background:${isReady ? '#f0fdf4' : '#fff7ed'}; padding:2px 6px; border-radius:4px;">
                        ${isReady ? '✅ PRÊT' : '⏳ EN COURS'}
                    </span>
                </div>
                <h3 style="margin:5px 0; font-family:'Playfair Display'; font-size:1.1rem; color:#1e293b;">${ev.title}</h3>
                <div style="font-size:0.8rem; color:#64748b;">
                    <i data-lucide="calendar" style="width:12px; vertical-align:middle;"></i> ${new Date(ev.event_date).toLocaleDateString()}
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

// 2. CRÉATION (ÉTAPE 1)
window.showAddEventModal = () => {
    const userPortal = currentUser.portal;
    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 class="luxe-title" style="margin:0;">PLANIFIER UN ÉVÉNEMENT</h3>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem; color:#94a3b8;">&times;</button>
        </div>
        <p class="mini-label">TITRE DE L'ÉVÉNEMENT *</p>
        <input type="text" id="ev-title" class="luxe-input" placeholder="Ex: Gala de Charité...">
        <p class="mini-label" style="margin-top:15px;">ENTITÉ CONCERNÉE *</p>
        <select id="ev-entity" class="luxe-input" style="width:100%;">
            <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
            <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
            <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
            <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
        </select>
        <p class="mini-label" style="margin-top:15px;">DATE PRÉVUE *</p>
        <input type="date" id="ev-date" class="luxe-input">
        <button onclick="window.execCreateEvent()" class="btn-gold" style="width:100%; margin-top:25px; height:45px; font-weight:bold;">CRÉER ET ATTENDRE LES INFOS</button>
    `);
};

window.execCreateEvent = async () => {
    const title = document.getElementById('ev-title').value.trim();
    const event_date = document.getElementById('ev-date').value;
    const entity = document.getElementById('ev-entity').value;
    if(!title || !event_date) return window.showNotice("Champs requis", "Titre et Date obligatoires.");

    const { error } = await supabaseClient.from('events').insert([{
        title, event_date, entity,
        status: 'En cours',
        created_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if(error) return window.showNotice("Erreur", error.message);
    closeCustomModal();
    loadEvents();
};

// 3. DOSSIER LOGISTIQUE & ACTIONS RÉSEAUX (ÉTAPE 2 & 3)
window.openEventDetails = async (id) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', id).single();
    if(!ev) return;

    const isReady = ev.status === 'Complet' || (ev.event_time && ev.location && ev.description);

    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 class="luxe-title" style="margin:0;">${ev.title}</h2>
            <button onclick="closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
        </div>

        <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:25px;">
            <div>
                <p class="mini-label" style="color:var(--primary); font-weight:800; border-bottom:1px solid #eee; padding-bottom:5px;">1. LOGISTIQUE & MÉDIAS</p>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:15px;">
                    <input type="time" class="luxe-input" value="${ev.event_time || ''}" onchange="window.updateEventField('${ev.id}', 'event_time', this.value)">
                    <input type="text" class="luxe-input" placeholder="Lieu..." value="${ev.location || ''}" onblur="window.updateEventField('${ev.id}', 'location', this.value)">
                </div>
                <textarea class="luxe-input" style="height:100px; margin-top:10px;" placeholder="Texte réseaux..." onblur="window.updateEventField('${ev.id}', 'description', this.value)">${ev.description || ''}</textarea>
                
                <div style="margin-top:20px; padding:15px; background:#f8fafc; border-radius:12px; border:1px dashed #cbd5e1;">
                    <p class="mini-label">PHOTOS DE L'ÉVÉNEMENT (events_media)</p>
                    <div id="event-gallery" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin:15px 0; max-height:200px; overflow-y:auto;"></div>
                    <input type="file" id="ev-upload-multi" style="display:none;" multiple onchange="window.uploadMultipleMedia('${ev.id}', this.files)">
                    <button onclick="document.getElementById('ev-upload-multi').click()" class="btn-gold" style="width:100%; font-size:0.75rem;">+ AJOUTER FICHIERS</button>
                </div>
            </div>

            <div style="background:#f8fafc; padding:20px; border-radius:12px; border:1px solid #e2e8f0; align-self: start;">
                <p class="mini-label" style="color:var(--primary); font-weight:800;">2. ACTIONS RÉSEAUX</p>
                
                ${!isReady ? `
                    <div id="alert-incomplete" style="background:#fff7ed; border:1px solid #ffedd5; padding:12px; border-radius:8px; margin:15px 0; position:relative; display:flex; gap:10px; align-items:center;">
                        <i data-lucide="alert-circle" style="color:#f59e0b; width:20px;"></i>
                        <p style="font-size:0.7rem; color:#9a3412; margin:0; padding-right:20px;"><b>Dossier incomplet.</b><br>Vérifiez l'heure, le lieu et le texte.</p>
                        <button onclick="document.getElementById('alert-incomplete').style.display='none'" style="position:absolute; top:5px; right:5px; background:none; border:none; cursor:pointer; color:#9a3412; font-size:1.2rem;">&times;</button>
                    </div>
                ` : `<p style="font-size:0.75rem; color:#166534; margin:15px 0;">✨ Dossier complet.</p>`}

                <button onclick="window.copyToClipboard('${(ev.description || "").replace(/'/g, "\\'")}')" class="btn-gold" style="width:100%; background:#22c55e; border:none; margin-bottom:10px; height:45px; font-weight:bold;">COPIER LE TEXTE</button>
                <button onclick="window.downloadAllMedia('${ev.id}')" class="btn-gold" style="width:100%; background:#1e293b; border:none; margin-bottom:10px; height:45px; font-weight:bold;">TOUT TÉLÉCHARGER</button>
                
                <button onclick="window.toggleEventStatus('${ev.id}', '${ev.status}')" class="btn-gold" style="width:100%; background:white; color:${ev.status === 'Complet' ? '#ef4444' : '#22c55e'}; border:1px solid ${ev.status === 'Complet' ? '#ef4444' : '#22c55e'}; height:40px; font-size:0.7rem;">
                    <i data-lucide="${ev.status === 'Complet' ? 'rotate-ccw' : 'check-circle'}" style="width:14px; margin-right:8px; vertical-align:middle;"></i>
                    ${ev.status === 'Complet' ? 'REPASSER EN COURS' : 'MARQUER COMME TERMINÉ'}
                </button>
            </div>
        </div>
        <div style="margin-top:20px; text-align:right;">
             <button onclick="window.askDeleteEvent('${ev.id}', '${ev.title.replace(/'/g, "\\'")}')" style="color:#ef4444; background:none; border:none; font-size:0.65rem; cursor:pointer;">SUPPRIMER L'ÉVÉNEMENT</button>
        </div>
    `);
    lucide.createIcons();
    window.refreshGallery(id);
};

// 4. STORAGE (UPLOAD / LISTE / DELETE)
window.uploadMultipleMedia = async (eventId, files) => {
    if(!files.length) return;
    for(let file of files) {
        const path = `events_media/${eventId}/${Date.now()}_${file.name}`;
        await supabaseClient.storage.from('documents').upload(path, file);
    }
    window.refreshGallery(eventId);
};

window.refreshGallery = async (eventId) => {
    const { data } = await supabaseClient.storage.from('documents').list(`events_media/${eventId}`);
    const gallery = document.getElementById('event-gallery');
    if(!gallery) return;
    if(!data || data.length === 0) {
        gallery.innerHTML = `<p style="font-size:0.6rem; color:#94a3b8; grid-column:span 3; text-align:center;">Aucun média.</p>`;
        return;
    }
    gallery.innerHTML = data.map(file => {
        const { data: { publicUrl } } = supabaseClient.storage.from('documents').getPublicUrl(`events_media/${eventId}/${file.name}`);
        const isImg = file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i);
        return `
            <div style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:1px solid #e2e8f0; background:#f8fafc;">
                ${isImg ? `<img src="${publicUrl}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="display:flex; align-items:center; justify-content:center; height:100%; font-size:0.5rem; text-align:center;">DOC</div>`}
                <button onclick="window.deleteMedia('${eventId}', '${file.name}')" style="position:absolute; top:2px; right:2px; background:#ef4444; color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer; font-size:10px;">&times;</button>
            </div>
        `;
    }).join('');
};

window.deleteMedia = async (eventId, fileName) => {
    if(confirm("Supprimer ce fichier ?")) {
        await supabaseClient.storage.from('documents').remove([`events_media/${eventId}/${fileName}`]);
        window.refreshGallery(eventId);
    }
};

window.downloadAllMedia = async (eventId) => {
    const { data } = await supabaseClient.storage.from('documents').list(`events_media/${eventId}`);
    if(data) data.forEach(f => {
        const { data: { publicUrl } } = supabaseClient.storage.from('documents').getPublicUrl(`events_media/${eventId}/${f.name}`);
        window.open(publicUrl, '_blank');
    });
};

// 5. MISES À JOUR & ACTIONS
window.toggleEventStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Complet' ? 'En cours' : 'Complet';
    await supabaseClient.from('events').update({ status: newStatus }).eq('id', id);
    window.showNotice("Statut", `Événement marqué comme : ${newStatus}`);
    closeCustomModal();
    loadEvents();
};

window.updateEventField = async (id, field, value) => {
    console.log(`Tentative de sauvegarde : ${field} = ${value} pour l'ID ${id}`);

    const { error } = await supabaseClient
        .from('events')
        .update({ [field]: value })
        .eq('id', id);

    if (error) {
        console.error("Erreur de sauvegarde:", error.message);
        window.showNotice("Erreur", "Impossible d'enregistrer la modification.");
    } else {
        // Optionnel : un petit indicateur discret dans la console
        console.log("Enregistrement réussi !");
        
        // On rafraîchit la liste en fond pour que le dashboard soit à jour
        loadEvents(); 
    }
};

window.copyToClipboard = (text) => {
    if(!text) return window.showNotice("Vide", "Aucun texte à copier.");
    navigator.clipboard.writeText(text).then(() => window.showNotice("Copié !", "Texte prêt pour les réseaux."));
};

window.askDeleteEvent = (id, title) => {
    if(confirm(`Supprimer "${title}" ?`)) {
        supabaseClient.from('events').delete().eq('id', id).then(() => { closeCustomModal(); loadEvents(); });
    }
};

// ==========================================
// MOTEUR DE DISCUSSION ALSATIA V2 - COMPLET
// ==========================================

let currentChatSubject = 'Général';
let selectedChatFile = null;

/**
 * 1. INITIALISATION & TEMPS RÉEL
 */
window.subscribeToChat = () => {
    // On ferme l'ancien canal s'il existe pour éviter les doublons
    if (window.chatChannel) window.chatChannel.unsubscribe();

    window.chatChannel = supabaseClient
        .channel('chat-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_global' }, payload => {
            if (payload.eventType === 'INSERT') {
                if (payload.new.subject === currentChatSubject) {
                    appendSingleMessage(payload.new);
                }
            } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                // Rafraîchissement complet pour les réactions et suppressions
                window.loadChatMessages();
            }
        })
        .subscribe();
};

/**
 * 2. GESTION DES SUJETS (DROITS & FILTRAGE)
 */
window.loadChatSubjects = async () => {
    const { data: subjects, error } = await supabaseClient.from('chat_subjects').select('*').order('name');
    if (error) return;

    const container = document.getElementById('chat-subjects-list');
    if (!container) return;

    const filtered = subjects.filter(s => {
        if (currentUser.portal === 'Institut Alsatia') return true;
        return !s.entity || s.entity === currentUser.portal;
    });

    container.innerHTML = filtered.map(s => `
        <div class="suggest-item ${currentChatSubject === s.name ? 'active-chat-tab' : ''}" 
             style="display:flex; justify-content:space-between; align-items:center; border-radius:8px; margin-bottom:2px; padding:10px; cursor:pointer;"
             onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}')">
            <span># ${s.name}</span>
            ${(currentUser.portal === 'Institut Alsatia' || s.entity === currentUser.portal) ? 
                `<i data-lucide="trash-2" style="width:12px; color:var(--danger); opacity:0.5;" onclick="event.stopPropagation(); window.deleteSubject('${s.id}', '${s.name}')"></i>` : ''}
        </div>
    `).join('');
    lucide.createIcons();
};

window.switchChatSubject = (subjectName) => {
    currentChatSubject = subjectName;
    const titleEl = document.getElementById('chat-current-title');
    if(titleEl) titleEl.innerText = `# ${subjectName}`;
    window.loadChatSubjects(); 
    window.loadChatMessages();
};

window.promptCreateSubject = () => {
    const isInstitut = currentUser.portal === 'Institut Alsatia';
    showCustomModal(`
        <h3 class="luxe-title">NOUVEAU CANAL</h3>
        <p class="mini-label">NOM DU SUJET</p>
        <input type="text" id="new-sub-name" class="luxe-input" placeholder="ex: Travaux Été">
        <p class="mini-label" style="margin-top:15px;">AFFECTATION ÉCOLE</p>
        <select id="new-sub-entity" class="luxe-input">
            <option value="">Visible par tous (Général)</option>
            <option value="Institut Alsatia" ${!isInstitut ? 'disabled' : ''}>Institut Alsatia Uniquement</option>
            <option value="Academia Alsatia">Academia Alsatia</option>
            <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
            <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
        </select>
        <button onclick="window.execCreateSubject()" class="btn-gold" style="width:100%; margin-top:20px;">CRÉER LE SUJET</button>
    `);
};

window.execCreateSubject = async () => {
    const name = document.getElementById('new-sub-name').value.trim();
    const entity = document.getElementById('new-sub-entity').value;
    if(!name) return;

    await supabaseClient.from('chat_subjects').insert([{ name, entity }]);
    window.showNotice("Succès", "Canal de discussion créé.");
    closeCustomModal();
    window.loadChatSubjects();
};

/**
 * 3. LOGIQUE DES MESSAGES
 */
window.loadChatMessages = async () => {
    const { data, error } = await supabaseClient.from('chat_global')
        .select('*').eq('subject', currentChatSubject).order('created_at', { ascending: true });
    
    if (error) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.innerHTML = data.map(msg => renderSingleMessage(msg)).join('');
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
};

function renderSingleMessage(msg) {
    const isMe = msg.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
    const isMentioned = msg.content.includes(`@${currentUser.last_name}`);
    const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const portalIcon = LOGOS[msg.portal] || 'logo_alsatia.png';

    return `
        <div class="message-wrapper ${isMe ? 'my-wrapper' : ''}">
            <div class="msg-header" style="display:flex; align-items:center; gap:5px; font-size:0.7rem; color:var(--text-muted); margin-bottom:2px;">
                <img src="${portalIcon}" style="width:14px; height:14px; object-fit:contain;">
                <span style="font-weight:700;">${msg.author_full_name}</span> • <span>${date}</span>
            </div>
            <div class="message ${isMe ? 'my-msg' : ''} ${isMentioned ? 'mentioned-luxe' : ''}" id="msg-${msg.id}" style="position:relative;">
                ${msg.content.replace(/@([\w\sàéèêîïôûù]+)/g, '<span class="mention-badge">@$1</span>')}
                ${msg.file_url ? `<div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.2); padding-top:5px;"><a href="${msg.file_url}" target="_blank" style="color:var(--gold); font-size:0.8rem; text-decoration:none;">📎 Document joint</a></div>` : ''}
                
                <div class="msg-actions">
                    <span onclick="window.reactToMessage('${msg.id}', '👍')">👍</span>
                    <span onclick="window.reactToMessage('${msg.id}', '❤️')">❤️</span>
                    ${isMe ? `<i data-lucide="trash-2" onclick="window.deleteMessage('${msg.id}')" style="width:12px; color:var(--danger); margin-left:8px;"></i>` : ''}
                </div>
            </div>
        </div>
    `;
}

function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', renderSingleMessage(msg));
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
}

/**
 * 4. MENTIONS & ENVOI
 */
window.handleChatKeyUp = (e) => {
    const input = e.target;
    const box = document.getElementById('mention-box');

    if (input.value.includes('@')) {
        const query = input.value.split('@').pop().toLowerCase();
        box.style.display = 'block';
        
        // Liste des entités et noms en ENTIER
        const suggestions = [
            'Institut Alsatia', 
            'Academia Alsatia', 
            'Cours Herrade de Landsberg', 
            'Collège Saints Louis et Zélie Martin',
            'Molin', 'Zeller'
        ];
        
        const filtered = suggestions.filter(s => s.toLowerCase().includes(query));
        
        box.innerHTML = filtered.map(s => `
            <div class="suggest-item" onclick="window.insertMention('${s}')" style="padding:10px; cursor:pointer; border-bottom:1px solid #eee;">@${s}</div>
        `).join('');
    } else {
        box.style.display = 'none';
    }
    
    if (e.key === 'Enter') window.sendChatMessage();
};

window.insertMention = (name) => {
    const input = document.getElementById('chat-input');
    const parts = input.value.split('@');
    parts.pop();
    input.value = parts.join('@') + '@' + name + ' ';
    document.getElementById('mention-box').style.display = 'none';
    input.focus();
};

window.handleChatFile = (input) => {
    selectedChatFile = input.files[0];
    if (selectedChatFile) {
        document.getElementById('file-preview-bar').style.display = 'block';
        document.getElementById('file-name-preview').innerText = selectedChatFile.name;
    }
};

window.clearChatFile = () => {
    selectedChatFile = null;
    document.getElementById('chat-file-input').value = "";
    document.getElementById('file-preview-bar').style.display = 'none';
};

window.sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if(!content && !selectedChatFile) return;

    let fileUrl = null;
    if (selectedChatFile) {
        const filePath = `chat/${Date.now()}_${selectedChatFile.name}`;
        const { error: uploadError } = await supabaseClient.storage.from('chat-attachments').upload(filePath, selectedChatFile);
        if (!uploadError) {
            const { data } = supabaseClient.storage.from('chat-attachments').getPublicUrl(filePath);
            fileUrl = data.publicUrl;
        }
    }

    await supabaseClient.from('chat_global').insert([{
        content,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        author_last_name: currentUser.last_name,
        portal: currentUser.portal,
        subject: currentChatSubject,
        file_url: fileUrl
    }]);

    input.value = '';
    window.clearChatFile();
};

window.deleteMessage = (id) => {
    window.alsatiaConfirm("SUPPRIMER", "Voulez-vous supprimer ce message ?", async () => {
        await supabaseClient.from('chat_global').delete().eq('id', id);
        window.showNotice("Effacé", "Message supprimé.");
    }, true);
};

window.deleteSubject = (id, name) => {
    window.alsatiaConfirm("SUPPRIMER CANAL", `Supprimer le sujet #${name} et tous ses messages ?`, async () => {
        await supabaseClient.from('chat_global').delete().eq('subject', name);
        await supabaseClient.from('chat_subjects').delete().eq('id', id);
        window.loadChatSubjects();
        window.switchChatSubject('Général');
    }, true);
};

window.reactToMessage = async (messageId, emoji) => {
    const { data: msg } = await supabaseClient.from('chat_global').select('content').eq('id', messageId).single();
    if (!msg) return;

    const newContent = msg.content + " " + emoji;
    
    const { error } = await supabaseClient
        .from('chat_global')
        .update({ content: newContent })
        .eq('id', messageId);

    if (error) console.error("Erreur réaction:", error);
};
