// ==========================================
// CONFIGURATION SUPABASE & ÉTAT GLOBAL
// ==========================================
console.log('🚀 APP.JS CHARGÉ - VERSION CORRIGÉE v2.0');

const supabaseUrl = 'https://ptiosrmpliffsjooedle.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0aW9zcm1wbGlmZnNqb29lZGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMzY0MzgsImV4cCI6MjA4MzkxMjQzOH0.SdTtCooQsDcCIQdGddnDz2-lMM_X6yfNpVmAW4C7j7o';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = JSON.parse(localStorage.getItem('alsatia_user'));
let allDonorsData = [];
let allUsersForMentions = []; 
let selectedChatFile = null; // Pour la gestion des pièces jointes dans la messagerie
let currentChatSubject = 'Général'; // Canal de discussion actif

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};
// FIX CHAT REALTIME
window.subscribeToChat = function() {
    if (window.chatChannel) window.chatChannel.unsubscribe();
    window.chatChannel = supabaseClient.channel('chat-' + Date.now()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global', filter: 'subject=eq.' + currentChatSubject }, function(p) { 
        if (p.new.author_full_name !== currentUser.first_name + ' ' + currentUser.last_name) { 
            var c = document.getElementById('chat-messages-container'); 
            if (c) { 
                c.insertAdjacentHTML('beforeend', renderSingleMessage(p.new)); 
                c.scrollTop = c.scrollHeight; 
                if(window.lucide) lucide.createIcons(); 
            }
        }
    }).subscribe();
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
window.confirmLogout = () => {
    window.alsatiaConfirm(
        "DÉCONNEXION",
        "Voulez-vous vraiment vous déconnecter ?",
        () => {
            localStorage.clear(); 
            window.location.href = 'login.html';
        },
        true
    );
};

window.logout = () => { 
    localStorage.clear(); 
    window.location.href = 'login.html'; 
};

window.closeCustomModal = () => { 
    const m = document.getElementById('custom-modal');
    if (m) {
        // Animation de fermeture
        m.style.opacity = '0';
        const card = m.querySelector('.modal-card');
        if (card) card.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            m.style.display = 'none';
        }, 300);
    }
};

// Fonction critique pour éviter les injections et bugs d'affichage dans le chat
function escapeHTML(str) {
    if (!str) return "";
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
}

// Fonction pour centraliser l'affichage des notifications
window.showNotice = (title, message, type = 'info') => {
    // Créer une notification élégante au lieu d'un alert natif
    const colors = {
        info: { bg: '#eff6ff', border: '#3b82f6', icon: 'info' },
        success: { bg: '#f0fdf4', border: '#22c55e', icon: 'check-circle' },
        error: { bg: '#fef2f2', border: '#ef4444', icon: 'alert-circle' },
        warning: { bg: '#fffbeb', border: '#f59e0b', icon: 'alert-triangle' }
    };
    
    const color = colors[type] || colors.info;
    
    const toastId = 'toast-' + Date.now();
    const toastHTML = `
        <div id="${toastId}" style="position:fixed; top:20px; right:20px; z-index:100000; background:${color.bg}; border:2px solid ${color.border}; border-radius:12px; padding:16px 20px; box-shadow:0 4px 20px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px; min-width:300px; max-width:500px; animation:slideInRight 0.3s ease;">
            <i data-lucide="${color.icon}" style="width:24px; height:24px; color:${color.border}; flex-shrink:0;"></i>
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.95rem; color:#1f2937; margin-bottom:4px;">${title}</div>
                <div style="font-size:0.85rem; color:#6b7280;">${message}</div>
            </div>
            <i data-lucide="x" onclick="document.getElementById('${toastId}').remove()" style="width:18px; height:18px; cursor:pointer; color:#9ca3af; flex-shrink:0;"></i>
        </div>
        <style>
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', toastHTML);
    if (window.lucide) lucide.createIcons();
    
    // Auto-suppression après 5 secondes
    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.transition = 'all 0.3s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
};

// Helper pour l'affichage des Modals Luxe
function showCustomModal(html) {
    const m = document.getElementById('custom-modal');
    const b = document.getElementById('modal-body');
    if(m && b) { 
        b.innerHTML = html; 
        m.style.display = 'flex';
        
        // Animation d'apparition
        setTimeout(() => {
            m.style.opacity = '1';
            const card = m.querySelector('.modal-card');
            if (card) card.style.transform = 'scale(1)';
        }, 10);
        
        // Fermer avec ESC
        const closeOnEsc = (e) => {
            if (e.key === 'Escape') {
                window.closeCustomModal();
                document.removeEventListener('keydown', closeOnEsc);
            }
        };
        document.addEventListener('keydown', closeOnEsc);
        
        // Fermer en cliquant sur l'overlay (pas sur la carte)
        m.onclick = (e) => {
            if (e.target === m) {
                window.closeCustomModal();
            }
        };
        
        if(window.lucide) lucide.createIcons();
    }
}

// ==========================================
// INITIALISATION AU CHARGEMENT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!currentUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    
    initInterface();
    
    // Chargement initial des données
    loadContacts();
    if(currentUser.portal === "Institut Alsatia") {
        window.loadDonors();
    }
    loadEvents();
    
    // Initialisation du chat avec Realtime
    window.loadChatSubjects();
    window.loadChatMessages();
    window.subscribeToChat();
    
    // Initialiser les icônes Lucide
    if(window.lucide) lucide.createIcons();
});

function initInterface() {
    const portal = currentUser.portal;
    const logoSrc = LOGOS[portal] || 'logo_alsatia.png';

    const sideLogo = document.getElementById('entity-logo-container');
    if(sideLogo) sideLogo.innerHTML = `<img src="${logoSrc}" class="entity-logo">`;
    
    // On ajoute des protections "if" pour éviter l'erreur "null"
    const nameDisplay = document.getElementById('user-name-display');
    if(nameDisplay) nameDisplay.innerText = `${currentUser.first_name} ${currentUser.last_name}`;

    const portalDisplay = document.getElementById('current-portal-display');
    if(portalDisplay) portalDisplay.innerText = portal;

    const bigLogo = document.getElementById('big-logo-display');
    if(bigLogo) {
        bigLogo.innerHTML = `
            <img src="${logoSrc}" 
                 style="width:220px; 
                        max-width:70vw;
                        filter:drop-shadow(0 10px 25px rgba(0,0,0,0.15)); 
                        animation:fadeInScale 0.6s ease-out;">
        `;
    }
    
    const welcomeName = document.getElementById('welcome-full-name');
    if(welcomeName) welcomeName.innerText = `${currentUser.first_name} ${currentUser.last_name}`;

    const welcomePortal = document.getElementById('welcome-portal-label');
    if(welcomePortal) welcomePortal.innerText = `Portail Officiel — ${portal}`;

    const navDonors = document.getElementById('nav-donors');
    if (navDonors) {
        navDonors.style.display = (portal === "Institut Alsatia") ? "flex" : "none";
    }

    // Charger les statistiques
    loadHomeStats();

    if(window.lucide) lucide.createIcons();
}

// Fonction pour charger les statistiques de la page d'accueil
async function loadHomeStats() {
    // Plus de statistiques à charger sur la page d'accueil
    // Cette fonction est conservée au cas où on veuille ajouter des stats plus tard
}

// ==========================================
// GESTION DE LA NAVIGATION (ONGLETS)
// ==========================================
window.switchTab = (tabId) => {
    console.log("Changement d'onglet vers :", tabId);

    // 1. Gère l'affichage visuel des onglets
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav li').forEach(l => l.classList.remove('active'));

    const targetPage = document.getElementById('tab-' + tabId);
    if (targetPage) targetPage.classList.add('active');
    
    // On cherche l'élément de menu correspondant pour mettre l'icône en doré
    const menuIcon = document.querySelector(`li[onclick*="${tabId}"]`);
    if (menuIcon) menuIcon.classList.add('active');

    // 2. CHARGEMENT DES DONNÉES SPÉCIFIQUES
    if (tabId === 'donors') window.loadDonors();
    if (tabId === 'events') loadEvents();
    
    // Activation de la Messagerie
    if (tabId === 'chat') {
        window.loadChatSubjects();
        window.loadChatMessages();
        window.subscribeToChat();
    }
    
    // Activation de Mon Compte
    if (tabId === 'account') {
        window.loadAccountPage();
    }
    
    // Retourner à l'accueil
    if (tabId === 'home') {
        loadHomeStats();
    }
};

// ==========================================
// SECTION ANNUAIRE (CONTACTS)
// ==========================================
// Sauvegarder tous les contacts pour le filtre
window.allContactsData = [];

async function loadContacts() {
    const grid = document.getElementById('contacts-grid');
    if(!grid) return;
    
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">Chargement de l'annuaire...</p>`;
    
    const { data: users, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('portal', { ascending: true })
        .order('last_name', { ascending: true});

    if (error) {
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 40px;">Erreur lors du chargement des contacts.</p>`;
        return;
    }

    window.allContactsData = users || [];
    renderContacts(users);
}

function renderContacts(users) {
    const grid = document.getElementById('contacts-grid');
    if(!grid) return;
    
    grid.innerHTML = users.map(u => {
        return `
            <div class="contact-card" style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.08); padding:24px; transition:all 0.3s; border:2px solid transparent;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.borderColor='transparent';">
                
                <!-- En-tête sans avatar -->
                <div style="margin-bottom:20px;">
                    <h3 style="margin:0 0 4px 0; font-size:1.1rem; font-weight:800; color:#1e293b;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                    <p style="margin:0; font-size:0.85rem; color:#64748b; font-weight:500;">${u.job_title || 'Collaborateur'}</p>
                </div>
                
                <!-- Entité -->
                <div style="display:inline-block; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px;">
                    ${u.portal}
                </div>
                
                <!-- Coordonnées -->
                ${u.email ? `
                <div style="margin-bottom:12px; display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; background:#f8fafc; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                        <i data-lucide="mail" style="width:14px; height:14px; vertical-align:middle; margin-right:6px; color:#64748b;"></i>${u.email}
                    </div>
                    <button onclick="window.copyToClipboard('${u.email}')" style="background:var(--gold); color:white; border:none; width:36px; height:36px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='var(--gold-light)'" onmouseout="this.style.background='var(--gold)'">
                        <i data-lucide="copy" style="width:16px; height:16px;"></i>
                    </button>
                </div>
                ` : ''}
                
                ${u.phone ? `
                <div style="margin-bottom:16px; display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; background:#f8fafc; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#475569;">
                        <i data-lucide="phone" style="width:14px; height:14px; vertical-align:middle; margin-right:6px; color:#64748b;"></i>${u.phone}
                    </div>
                    <button onclick="window.copyToClipboard('${u.phone}')" style="background:var(--gold); color:white; border:none; width:36px; height:36px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;" onmouseover="this.style.background='var(--gold-light)'" onmouseout="this.style.background='var(--gold)'">
                        <i data-lucide="copy" style="width:16px; height:16px;"></i>
                    </button>
                </div>
                ` : ''}
                
                <!-- Bouton message -->
                <button onclick="window.startPrivateChat('${u.id}', '${u.first_name}', '${u.last_name}')" class="btn-gold-fill" style="width:100%; height:42px; display:flex; align-items:center; justify-content:center; gap:8px; font-size:0.85rem;">
                    <i data-lucide="message-circle" style="width:18px; height:18px;"></i>
                    ENVOYER UN MESSAGE
                </button>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
}

// Fonction pour filtrer les contacts
window.filterContacts = () => {
    const searchVal = document.getElementById('contact-search')?.value.toLowerCase().trim() || "";
    
    const filtered = window.allContactsData.filter(u => {
        return (u.first_name || "").toLowerCase().includes(searchVal) ||
               (u.last_name || "").toLowerCase().includes(searchVal) ||
               (u.email || "").toLowerCase().includes(searchVal) ||
               (u.portal || "").toLowerCase().includes(searchVal) ||
               (u.job_title || "").toLowerCase().includes(searchVal);
    });
    
    renderContacts(filtered);
};

// Fonction pour copier dans le presse-papier
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        window.showNotice("Copié !", `${text} copié dans le presse-papier`, "success");
    });
};

// Fonction pour démarrer une discussion privée
window.startPrivateChat = async (userId, firstName, lastName) => {
    // Créer ou trouver le canal privé
    const myName = `${currentUser.first_name} ${currentUser.last_name}`;
    const theirName = `${firstName} ${lastName}`;
    
    // Format du nom de canal : toujours par ordre alphabétique pour cohérence
    const names = [myName, theirName].sort();
    const channelName = `${names[0]} ↔ ${names[1]}`;
    
    // Vérifier si le canal existe déjà
    const { data: existing } = await supabaseClient
        .from('chat_subjects')
        .select('*')
        .eq('name', channelName)
        .single();
    
    if (!existing) {
        // Créer le canal privé
        const { error } = await supabaseClient
            .from('chat_subjects')
            .insert([{
                name: channelName,
                entity: 'Privé'
            }]);
        
        if (error) {
            window.showNotice("Erreur", "Impossible de créer la discussion privée.", "error");
            return;
        }
    }
    
    // Basculer vers Discussion et sélectionner ce canal
    window.switchTab('chat');
    
    // Attendre que la page chat soit chargée
    setTimeout(() => {
        // Sélectionner le canal
        const channelButton = Array.from(document.querySelectorAll('.subject-item')).find(btn => 
            btn.textContent.includes(channelName)
        );
        
        if (channelButton) {
            channelButton.click();
        }
        
        // Focus sur l'input et pré-remplir avec mention
        const chatInput = document.getElementById('chat-input-field');
        if (chatInput) {
            chatInput.value = `@${firstName} ${lastName} `;
            chatInput.focus();
        }
    }, 500);
};

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
window.loadDonors = async function() {
    const { data, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });

    if (error) {
        console.error("Erreur de chargement donateurs:", error);
        const list = document.getElementById('donors-list');
        if (list) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:#ef4444;">Erreur de chargement. Vérifiez vos permissions Supabase.</td></tr>';
        }
        return;
    }
    window.allDonorsData = data || [];
    window.filterDonors();
};

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
    if (!list) {
        console.error('Element donors-list introuvable');
        return;
    }
    
    if (data.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:#64748b;">Aucun donateur trouvé</td></tr>';
        return;
    }
    
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
    console.log('Opening donor file:', id);
    console.log('All donors data:', window.allDonorsData);
    const donor = window.allDonorsData.find(d => d.id === id);
    if (!donor) {
        console.error('Donor not found:', id);
        window.showNotice("Erreur", "Donateur introuvable. Rechargez la page.", "error");
        return;
    }
    const dons = donor.donations || [];
    
    showCustomModal(`
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
                <button onclick="window.closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
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
            <div style="max-height:240px; overflow-y:auto; border:1px solid #eee; margin-top:10px; border-radius:8px;">
                <table class="luxe-table">
                    <thead><tr><th>DATE</th><th>MONTANT</th><th>N° REÇU</th><th>REMERCIÉ ?</th><th style="text-align:right;">ACTION</th></tr></thead>
                    <tbody>
                        ${dons.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; color:#999;">Aucun don enregistré</td></tr>' : ''}
                        ${dons.map(don => `
                            <tr style="${!don.thanked ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                <td>${new Date(don.date).toLocaleDateString()}</td>
                                <td style="font-weight:700;">${don.amount}€</td>
                                <td>
                                    <div style="display:flex; align-items:center; gap:6px;">
                                        <input type="text" id="receipt-${don.id}" value="${don.tax_receipt_number || ''}" placeholder="RF-2024-001" style="padding:4px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:0.85rem; width:100%; max-width:120px;">
                                        <i data-lucide="save" style="width:14px; color:var(--gold); cursor:pointer;" onclick="window.updateReceiptNumber('${don.id}')" title="Enregistrer"></i>
                                    </div>
                                </td>
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
        </div>`);
    lucide.createIcons();
};

/**
 * 6. LOGIQUE DES DONS
 */
window.updateReceiptNumber = async (donId) => {
    const input = document.getElementById(`receipt-${donId}`);
    if (!input) return;
    
    const receiptNumber = input.value.trim() || null;
    
    const { error } = await supabaseClient
        .from('donations')
        .update({ tax_receipt_number: receiptNumber })
        .eq('id', donId);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de mettre à jour le reçu.", "error");
        return;
    }
    
    window.showNotice("Enregistré", "N° de reçu fiscal mis à jour.", "success");
    window.loadDonors();
};

/**
 * 6. LOGIQUE DES DONS (suite)
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
        <p class="mini-label" style="margin-top:10px;">N° REÇU FISCAL (Optionnel)</p>
        <input type="text" id="don-receipt" class="luxe-input" placeholder="Ex: RF-2024-001">
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
        tax_receipt_number: document.getElementById('don-receipt').value.trim() || null,
        thanked: false
    }]);

    window.showNotice("Bravo !", "Don enregistré.");
    if(typeof loadDashboardData === 'function') loadDashboardData(); 
    closeCustomModal();
    window.loadDonors();
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
    );
};

// ==========================================
// EXPORT EXCEL - SYSTÈME COMPLET
// ==========================================

/**
 * MODALE DE FILTRES POUR L'EXPORT GLOBAL
 */
window.showExportFiltersModal = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for(let y = currentYear; y >= currentYear - 10; y--) {
        years.push(y);
    }
    
    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">EXPORTER VERS EXCEL</h3>
            <button onclick="window.closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">
            <p class="mini-label">FILTRER PAR ENTITÉ</p>
            <select id="export-entity-filter" class="luxe-input" style="margin-bottom:20px;">
                <option value="ALL">Toutes les entités</option>
                <option>Institut Alsatia</option>
                <option>Academia Alsatia</option>
                <option>Cours Herrade de Landsberg</option>
                <option>Collège Saints Louis et Zélie Martin</option>
            </select>
            
            <p class="mini-label">FILTRER PAR ANNÉE DE DON</p>
            <select id="export-year-filter" class="luxe-input" style="margin-bottom:20px;">
                <option value="ALL">Toutes les années</option>
                ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
            </select>
            
            <button onclick="window.executeExportToExcel()" class="btn-gold-fill" style="width:100%; height:50px; font-size:1rem;">
                <i data-lucide="download" style="width:20px; margin-right:10px; vertical-align:middle;"></i>
                TÉLÉCHARGER LE FICHIER EXCEL
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

/**
 * EXPORT GLOBAL DE TOUS LES DONATEURS
 */
window.executeExportToExcel = async () => {
    const entityFilter = document.getElementById('export-entity-filter').value;
    const yearFilter = document.getElementById('export-year-filter').value;
    
    // Charger TOUS les donateurs avec leurs dons
    const { data: allDonors, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .order('last_name', { ascending: true });
    
    if (error) {
        window.showNotice("Erreur", "Impossible de charger les données.", "error");
        return;
    }
    
    // Filtrer par entité
    let filteredDonors = allDonors;
    if (entityFilter !== "ALL") {
        filteredDonors = allDonors.filter(d => d.entity === entityFilter);
    }
    
    // Préparer les données pour l'onglet DONATEURS
    const donorsData = filteredDonors.map(d => ({
        'Nom': d.last_name || '',
        'Prénom': d.first_name || '',
        'Entreprise': d.company_name || '',
        'Entité': d.entity || '',
        'Email': d.email || '',
        'Téléphone': d.phone || '',
        'Code Postal': d.zip_code || '',
        'Ville': d.city || '',
        'Notes': d.notes || '',
        'Modifié par': d.last_modified_by || '',
        'Total des dons': d.donations ? d.donations.reduce((sum, don) => sum + parseFloat(don.amount || 0), 0) + ' €' : '0 €'
    }));
    
    // Préparer les données pour l'onglet DONS
    let allDonations = [];
    filteredDonors.forEach(d => {
        if (d.donations && d.donations.length > 0) {
            d.donations.forEach(don => {
                // Filtrer par année si nécessaire
                const donYear = new Date(don.date).getFullYear().toString();
                if (yearFilter === "ALL" || donYear === yearFilter) {
                    allDonations.push({
                        'Nom donateur': d.last_name || '',
                        'Prénom donateur': d.first_name || '',
                        'Entreprise': d.company_name || '',
                        'Entité': d.entity || '',
                        'Date du don': new Date(don.date).toLocaleDateString('fr-FR'),
                        'Montant': parseFloat(don.amount || 0) + ' €',
                        'Mode de paiement': don.payment_mode || '',
                        'N° Reçu Fiscal': don.tax_receipt_number || '',
                        'Remercié': don.thanked ? 'Oui' : 'Non'
                    });
                }
            });
        }
    });
    
    // Créer le fichier Excel avec 2 onglets
    const wb = XLSX.utils.book_new();
    
    // Onglet 1 : DONATEURS
    const ws1 = XLSX.utils.json_to_sheet(donorsData);
    XLSX.utils.book_append_sheet(wb, ws1, "Donateurs");
    
    // Onglet 2 : DONS
    const ws2 = XLSX.utils.json_to_sheet(allDonations);
    XLSX.utils.book_append_sheet(wb, ws2, "Dons");
    
    // Télécharger le fichier
    const fileName = `Alsatia_Export_${entityFilter}_${yearFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    window.closeCustomModal();
    window.showNotice("Téléchargé !", `Fichier "${fileName}" prêt`, "success");
};

/**
 * EXPORT D'UN DONATEUR SPÉCIFIQUE (depuis sa fiche)
 */
window.exportDonorToExcel = async (donorId) => {
    // Charger le donateur avec tous ses dons
    const { data: donor, error } = await supabaseClient
        .from('donors')
        .select('*, donations(*)')
        .eq('id', donorId)
        .single();
    
    if (error || !donor) {
        window.showNotice("Erreur", "Impossible de charger les données.", "error");
        return;
    }
    
    // Onglet 1 : INFORMATIONS DU DONATEUR
    const donorInfo = [{
        'Nom': donor.last_name || '',
        'Prénom': donor.first_name || '',
        'Entreprise': donor.company_name || '',
        'Entité': donor.entity || '',
        'Email': donor.email || '',
        'Téléphone': donor.phone || '',
        'Code Postal': donor.zip_code || '',
        'Ville': donor.city || '',
        'Notes': donor.notes || '',
        'Modifié par': donor.last_modified_by || '',
        'Total des dons': donor.donations ? donor.donations.reduce((sum, don) => sum + parseFloat(don.amount || 0), 0) + ' €' : '0 €',
        'Nombre de dons': donor.donations ? donor.donations.length : 0
    }];
    
    // Onglet 2 : TOUS LES DONS DU DONATEUR
    const donationsData = donor.donations && donor.donations.length > 0 
        ? donor.donations.map(don => ({
            'Date': new Date(don.date).toLocaleDateString('fr-FR'),
            'Montant': parseFloat(don.amount || 0) + ' €',
            'Mode de paiement': don.payment_mode || '',
            'N° Reçu Fiscal': don.tax_receipt_number || '',
            'Remercié': don.thanked ? 'Oui' : 'Non'
        }))
        : [{ 'Aucun don enregistré': '' }];
    
    // Créer le fichier Excel
    const wb = XLSX.utils.book_new();
    
    // Onglet 1 : DONATEUR
    const ws1 = XLSX.utils.json_to_sheet(donorInfo);
    XLSX.utils.book_append_sheet(wb, ws1, "Informations");
    
    // Onglet 2 : DONS
    const ws2 = XLSX.utils.json_to_sheet(donationsData);
    XLSX.utils.book_append_sheet(wb, ws2, "Historique des dons");
    
    // Télécharger
    const fileName = `${donor.last_name}_${donor.first_name || 'Donateur'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    window.showNotice("Téléchargé !", `Fichier "${fileName}" prêt`, "success");
};

function loadUsersForMentions() { console.log("Module CRM Alsatia v1.0 chargé."); }

// ==========================================
// GESTION DU COMPTE UTILISATEUR
// ==========================================

/**
 * CHARGER LES INFORMATIONS DU COMPTE
 */
window.loadAccountPage = async () => {
    // Charger les infos depuis Supabase
    const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    if (error || !profile) {
        window.showNotice("Erreur", "Impossible de charger votre profil.", "error");
        return;
    }
    
    // Remplir les champs non modifiables
    document.getElementById('account-first-name').value = profile.first_name || '';
    document.getElementById('account-last-name').value = profile.last_name || '';
    document.getElementById('account-portal').value = profile.portal || '';
    
    // Remplir les champs modifiables
    document.getElementById('account-email').value = profile.email || '';
    document.getElementById('account-phone').value = profile.phone || '';
    document.getElementById('account-job-title').value = profile.job_title || '';
    
    // Vider les champs PIN
    document.getElementById('account-old-pin').value = '';
    document.getElementById('account-new-pin').value = '';
    document.getElementById('account-confirm-pin').value = '';
    
    if(window.lucide) lucide.createIcons();
};

/**
 * AFFICHER/MASQUER LE PIN (bouton oeil)
 */
window.togglePinVisibility = (inputId, iconElement) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        iconElement.setAttribute('data-lucide', 'eye');
    }
    
    if(window.lucide) lucide.createIcons();
};

/**
 * SAUVEGARDER LES MODIFICATIONS DU COMPTE
 */
window.saveAccountChanges = async () => {
    // Récupérer les valeurs
    const email = document.getElementById('account-email').value.trim();
    const phone = document.getElementById('account-phone').value.trim();
    const jobTitle = document.getElementById('account-job-title').value.trim();
    const oldPin = document.getElementById('account-old-pin').value.trim();
    const newPin = document.getElementById('account-new-pin').value.trim();
    const confirmPin = document.getElementById('account-confirm-pin').value.trim();
    
    // Préparer les données à mettre à jour
    const updates = {
        email: email || null,
        phone: phone || null,
        job_title: jobTitle || null
    };
    
    // Gérer le changement de PIN si demandé
    let pinChanged = false;
    if (oldPin || newPin || confirmPin) {
        // Vérifier que l'ancien PIN est fourni
        if (!oldPin) {
            window.showNotice("Erreur", "Veuillez saisir votre ancien code PIN.", "error");
            return;
        }
        
        // Vérifier que le nouveau PIN est fourni
        if (!newPin) {
            window.showNotice("Erreur", "Veuillez saisir un nouveau code PIN.", "error");
            return;
        }
        
        // Vérifier que la confirmation est fournie
        if (!confirmPin) {
            window.showNotice("Erreur", "Veuillez confirmer votre nouveau code PIN.", "error");
            return;
        }
        
        // Vérifier que l'ancien PIN est correct
        const { data: currentProfile } = await supabaseClient
            .from('profiles')
            .select('pin')
            .eq('id', currentUser.id)
            .single();
        
        if (!currentProfile || currentProfile.pin !== oldPin) {
            window.showNotice("Erreur", "L'ancien code PIN est incorrect.", "error");
            return;
        }
        
        // Vérifier que le nouveau PIN fait 4 chiffres
        if (!/^\d{4}$/.test(newPin)) {
            window.showNotice("Erreur", "Le nouveau code PIN doit contenir exactement 4 chiffres.", "error");
            return;
        }
        
        // Vérifier que les deux nouveaux PIN correspondent
        if (newPin !== confirmPin) {
            window.showNotice("Erreur", "Les deux nouveaux codes PIN ne correspondent pas.", "error");
            return;
        }
        
        // Ajouter le PIN aux updates
        updates.pin = newPin;
        pinChanged = true;
    }
    
    // Mettre à jour dans Supabase
    const { error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', currentUser.id);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder les modifications.", "error");
        console.error("Update error:", error);
        return;
    }
    
    // Mettre à jour currentUser en mémoire
    currentUser = { ...currentUser, ...updates };
    localStorage.setItem('alsatia_user', JSON.stringify(currentUser));
    
    // Message de succès
    if (pinChanged) {
        window.showNotice("Succès", "Vos informations et votre code PIN ont été mis à jour.", "success");
    } else {
        window.showNotice("Succès", "Vos informations ont été mises à jour.", "success");
    }
    
    // Recharger la page
    window.loadAccountPage();
};

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
// ==========================================
// ÉVÉNEMENTS - VERSION FINALE V3 (ULTRA-CORRIGÉE)
// ==========================================

// ==========================================
// ÉVÉNEMENTS - VERSION FINALE V3 (ULTRA-CORRIGÉE)
// ==========================================

window.openEventDetails = async (id) => {
    const { data: ev } = await supabaseClient.from('events').select('*').eq('id', id).single();
    if(!ev) return;

    // Charger les médias depuis le bucket
    const { data: mediaList } = await supabaseClient.storage
        .from('event-media')
        .list(`${id}/photos`);
    
    const { data: docsList } = await supabaseClient.storage
        .from('event-media')
        .list(`${id}/documents`);
    
    const photos = (mediaList || []).filter(f => f.name && f.name !== '.emptyFolderPlaceholder');
    const documents = (docsList || []).filter(f => f.name && f.name !== '.emptyFolderPlaceholder');
    
    // Charger la liste des utilisateurs pour notification
    const { data: users } = await supabaseClient.from('profiles').select('id, first_name, last_name').order('last_name');
    
    const isCompleted = ev.status === 'Complet' || ev.status === 'Terminé';

    // Créer le canal de discussion pour cet événement
    const channelName = `Événement : ${ev.title}`;
    const { data: existingChannel } = await supabaseClient
        .from('chat_subjects')
        .select('*')
        .eq('name', channelName)
        .single();
    
    if (!existingChannel) {
        await supabaseClient.from('chat_subjects').insert([{
            name: channelName,
            entity: 'Privé'
        }]);
    }

    showCustomModal(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 class="luxe-title" style="margin:0;">${ev.title}</h2>
            <button onclick="window.closeCustomModal()" style="border:none; background:none; cursor:pointer; font-size:1.5rem;">&times;</button>
        </div>

        <!-- Badge statut -->
        <div style="text-align:center; margin-bottom:20px; padding:15px; background:${isCompleted ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)' : 'linear-gradient(135deg, #fef3c7, #fde68a)'}; border-radius:12px; border:2px solid ${isCompleted ? '#22c55e' : '#f59e0b'};">
            <div style="font-size:1.5rem; margin-bottom:5px;">${isCompleted ? '✅' : '⏳'}</div>
            <div style="font-weight:800; color:${isCompleted ? '#166534' : '#92400e'}; font-size:1.1rem;">
                ${isCompleted ? 'PRÊT POUR LES RÉSEAUX' : 'EN COURS DE PRÉPARATION'}
            </div>
        </div>

        <div style="max-height:70vh; overflow-y:auto; padding-right:10px;">
            
            <!-- Description de l'événement -->
            <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-bottom:20px;">
                <p class="mini-label">📝 DESCRIPTION DE L'ÉVÉNEMENT</p>
                <textarea id="ev-description-${id}" class="luxe-input" style="min-height:100px; font-size:0.9rem; line-height:1.6;">${ev.description || ''}</textarea>
            </div>

            <!-- Informations de base -->
            <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-bottom:20px;">
                <p class="mini-label">📅 INFORMATIONS PRATIQUES</p>
                
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                    <div>
                        <p style="font-size:0.75rem; color:#64748b; margin-bottom:5px;">DATE</p>
                        <input type="date" id="ev-date-${id}" class="luxe-input" value="${ev.event_date || ''}">
                    </div>
                    <div>
                        <p style="font-size:0.75rem; color:#64748b; margin-bottom:5px;">HEURE</p>
                        <input type="time" id="ev-time-${id}" class="luxe-input" value="${ev.event_time || ''}">
                    </div>
                </div>
                
                <div>
                    <p style="font-size:0.75rem; color:#64748b; margin-bottom:5px;">LIEU</p>
                    <input type="text" id="ev-location-${id}" class="luxe-input" value="${ev.location || ''}" placeholder="Ex: Salle des fêtes...">
                </div>

                <button onclick="window.saveEventInfos('${id}')" class="btn-gold-fill" style="width:100%; margin-top:15px; height:45px;">
                    <i data-lucide="save" style="width:18px; height:18px; vertical-align:middle; margin-right:8px;"></i>
                    ENREGISTRER LES INFORMATIONS
                </button>
            </div>

            <!-- Texte pour les réseaux -->
            <div style="background:white; border:2px solid var(--gold); padding:20px; border-radius:12px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <p class="mini-label" style="margin:0; color:var(--gold);">📱 TEXTE POUR LES RÉSEAUX SOCIAUX</p>
                    ${ev.social_media_text ? `
                        <button onclick="window.deleteSocialText('${id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 12px; border-radius:6px; font-size:0.75rem; cursor:pointer; font-weight:700;">
                            <i data-lucide="trash-2" style="width:12px; height:12px; vertical-align:middle; margin-right:4px;"></i>SUPPRIMER
                        </button>
                    ` : ''}
                </div>
                
                <textarea id="social-text-${id}" class="luxe-input" placeholder="Rédigez votre post pour Instagram, Facebook, LinkedIn..." style="min-height:150px; font-size:0.9rem; line-height:1.6; background:#fffbeb;">${ev.social_media_text || ''}</textarea>
                <button onclick="window.saveSocialText('${id}')" class="btn-gold-fill" style="width:100%; margin-top:10px; height:45px;">
                    <i data-lucide="check" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i>
                    ${ev.social_media_text ? 'METTRE À JOUR' : 'ENREGISTRER'} LE TEXTE
                </button>
            </div>

            <!-- Photos & Documents -->
            <div style="background:white; border:2px solid #e2e8f0; padding:20px; border-radius:12px; margin-bottom:20px;">
                <p class="mini-label" style="margin-bottom:15px;">📸 PHOTOS & 📄 DOCUMENTS</p>
                
                <!-- Upload photos -->
                <div style="margin-bottom:20px;">
                    <label style="display:block; background:linear-gradient(135deg, #fef3c7, #fde68a); padding:15px; border-radius:8px; text-align:center; cursor:pointer; border:2px dashed var(--gold);">
                        <i data-lucide="image-plus" style="width:24px; height:24px; color:var(--gold); margin-bottom:8px;"></i>
                        <div style="font-weight:700; color:#92400e; font-size:0.85rem;">AJOUTER DES PHOTOS</div>
                        <div style="font-size:0.7rem; color:#92400e; margin-top:4px;">Max 10MB par photo</div>
                        <input type="file" id="photo-upload-${id}" accept="image/jpeg,image/png,image/webp" multiple onchange="window.uploadPhotos('${id}')" style="display:none;">
                    </label>
                </div>
                
                <!-- Liste photos -->
                <div id="photos-list-${id}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(100px, 1fr)); gap:10px; margin-bottom:20px;">
                    ${photos.length === 0 ? '<p style="grid-column:1/-1; text-align:center; color:#64748b; padding:20px; font-size:0.85rem;">Aucune photo</p>' : ''}
                    ${photos.slice(0, 20).map(photo => {
                        const { data: urlData } = supabaseClient.storage.from('event-media').getPublicUrl(`${id}/photos/${photo.name}`);
                        const photoUrl = urlData.publicUrl;
                        return `
                            <div style="position:relative; border-radius:8px; overflow:hidden; aspect-ratio:1; border:2px solid #e2e8f0;">
                                <img src="${photoUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;background:#f8fafc;color:#94a3b8;font-size:0.7rem;\\'>Erreur</div>'">
                                <button onclick="window.deleteMedia('${id}', 'photos', '${photo.name.replace(/'/g, "\\'")}') style="position:absolute; top:4px; right:4px; background:rgba(239,68,68,0.9); border:none; color:white; width:24px; height:24px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                                    <i data-lucide="x" style="width:14px; height:14px;"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                    ${photos.length > 20 ? `<p style="grid-column:1/-1; text-align:center; color:#64748b; font-size:0.8rem;">+${photos.length - 20} photos supplémentaires</p>` : ''}
                </div>
                
                <!-- Upload documents -->
                <div style="margin-bottom:20px;">
                    <label style="display:block; background:#f8fafc; padding:15px; border-radius:8px; text-align:center; cursor:pointer; border:2px dashed #cbd5e1;">
                        <i data-lucide="file-plus" style="width:24px; height:24px; color:#64748b; margin-bottom:8px;"></i>
                        <div style="font-weight:700; color:#475569; font-size:0.85rem;">AJOUTER DES DOCUMENTS</div>
                        <div style="font-size:0.7rem; color:#64748b; margin-top:4px;">PDF, DOC, XLS - Max 10MB</div>
                        <input type="file" id="doc-upload-${id}" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onchange="window.uploadDocuments('${id}')" style="display:none;">
                    </label>
                </div>
                
                <!-- Liste documents -->
                <div id="docs-list-${id}">
                    ${documents.length === 0 ? '<p style="text-align:center; color:#64748b; padding:10px; font-size:0.85rem;">Aucun document</p>' : ''}
                    ${documents.map(doc => `
                        <div style="display:flex; align-items:center; justify-content:space-between; background:#f8fafc; padding:10px 15px; border-radius:8px; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <i data-lucide="file-text" style="width:18px; height:18px; color:#64748b; flex-shrink:0;"></i>
                                <span style="font-size:0.85rem; color:#1e293b; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${doc.name}</span>
                            </div>
                            <button onclick="window.deleteMedia('${id}', 'documents', '${doc.name.replace(/'/g, "\\'")}'))" style="background:#fee2e2; color:#ef4444; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:700; flex-shrink:0;">
                                <i data-lucide="trash-2" style="width:12px; height:12px; vertical-align:middle;"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Discussion privée événement -->
            <div style="background:#e0f2fe; border:2px solid #0ea5e9; padding:20px; border-radius:12px; margin-bottom:20px;">
                <p class="mini-label" style="color:#075985; margin-bottom:15px;">💬 DISCUSSION PRIVÉE DE L'ÉVÉNEMENT</p>
                
                <!-- Zone messages -->
                <div id="event-chat-${id}" style="background:white; border-radius:8px; padding:15px; min-height:200px; max-height:300px; overflow-y:auto; margin-bottom:10px;">
                    <p style="text-align:center; color:#64748b; font-size:0.85rem;">Chargement...</p>
                </div>
                
                <!-- Input message -->
                <div style="display:flex; gap:10px;">
                    <input type="text" id="event-chat-input-${id}" class="luxe-input" placeholder="Écrire un message..." style="flex:1;" onkeypress="if(event.key==='Enter') window.sendEventMessage('${id}', '${channelName}')">
                    <button onclick="window.sendEventMessage('${id}', '${channelName}')" class="btn-gold" style="white-space:nowrap;">
                        <i data-lucide="send" style="width:16px; height:16px; vertical-align:middle;"></i>
                    </button>
                </div>
            </div>

            <!-- Notifier un utilisateur -->
            <div style="background:#fef3c7; border:2px solid #fbbf24; padding:20px; border-radius:12px; margin-bottom:20px;">
                <p class="mini-label" style="color:#92400e; margin-bottom:10px;">🔔 NOTIFIER UN UTILISATEUR</p>
                <div style="display:flex; gap:10px;">
                    <select id="notify-user-${id}" class="luxe-input" style="flex:1;">
                        <option value="">Sélectionner un utilisateur...</option>
                        ${(users || []).map(u => `<option value="${u.id}">${u.first_name} ${u.last_name}</option>`).join('')}
                    </select>
                    <button onclick="window.notifyUserForEvent('${id}')" class="btn-gold" style="white-space:nowrap;">
                        <i data-lucide="send" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i>
                        NOTIFIER
                    </button>
                </div>
            </div>

            <!-- Actions si terminé -->
            ${isCompleted ? `
                <div style="background:linear-gradient(135deg, #dcfce7, #bbf7d0); padding:20px; border-radius:12px; border:2px solid #22c55e; margin-bottom:20px;">
                    <p style="font-weight:800; color:#166534; margin-bottom:15px; font-size:1rem;">🎉 ACTIONS DISPONIBLES</p>
                    
                    <button onclick="window.downloadAllPhotos('${id}')" class="btn-gold-fill" style="width:100%; margin-bottom:10px; background:#22c55e; height:50px;">
                        <i data-lucide="download" style="width:18px; height:18px; vertical-align:middle; margin-right:8px;"></i>
                        TÉLÉCHARGER TOUTES LES PHOTOS
                    </button>
                    
                    <button onclick="window.copyTextToClipboard('${id}')" class="btn-gold-fill" style="width:100%; background:#3b82f6; height:50px;">
                        <i data-lucide="copy" style="width:18px; height:18px; vertical-align:middle; margin-right:8px;"></i>
                        COPIER LE TEXTE
                    </button>
                </div>
            ` : ''}

            <!-- Bouton marquer comme terminé -->
            <button onclick="window.toggleEventComplete('${id}', ${isCompleted})" class="btn-gold-fill" style="width:100%; height:55px; background:${isCompleted ? '#ef4444' : '#22c55e'}; margin-bottom:15px;">
                <i data-lucide="${isCompleted ? 'rotate-ccw' : 'check-circle'}" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;"></i>
                ${isCompleted ? 'REPASSER EN COURS' : 'MARQUER COMME TERMINÉ'}
            </button>

            <!-- Bouton supprimer -->
            <button onclick="window.askDeleteEvent('${id}', '${ev.title.replace(/'/g, "\\'")}', true)" style="width:100%; background:#fee2e2; color:#ef4444; border:2px solid #ef4444; padding:12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                <i data-lucide="trash-2" style="width:16px; height:16px; vertical-align:middle; margin-right:6px;"></i>
                SUPPRIMER L'ÉVÉNEMENT (+ médias)
            </button>
        </div>
    `);
    
    lucide.createIcons();
    
    // Charger les messages du canal
    window.loadEventChat(id, channelName);
};

// Charger les messages du canal événement
window.loadEventChat = async (eventId, channelName) => {
    const { data: messages } = await supabaseClient
        .from('chat_global')
        .select('*')
        .eq('subject', channelName)
        .order('created_at', { ascending: true });
    
    const container = document.getElementById(`event-chat-${eventId}`);
    if (!container) return;
    
    if (!messages || messages.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; font-size:0.85rem; padding:20px;">Aucun message. Soyez le premier à écrire !</p>';
        return;
    }
    
    container.innerHTML = messages.map(msg => {
        const isMe = msg.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
        const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        return `
            <div style="margin-bottom:12px; ${isMe ? 'text-align:right;' : ''}">
                <div style="display:inline-block; max-width:70%; text-align:left; background:${isMe ? 'var(--gold)' : '#f1f5f9'}; color:${isMe ? 'white' : '#1e293b'}; padding:10px 15px; border-radius:12px;">
                    <div style="font-weight:700; font-size:0.8rem; margin-bottom:4px; opacity:0.9;">${msg.author_full_name}</div>
                    <div style="font-size:0.9rem; line-height:1.4;">${msg.content}</div>
                    <div style="font-size:0.7rem; opacity:0.7; margin-top:4px;">${date}</div>
                </div>
            </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
};

// Envoyer un message dans le canal événement
window.sendEventMessage = async (eventId, channelName) => {
    const input = document.getElementById(`event-chat-input-${eventId}`);
    if (!input || !input.value.trim()) return;
    
    const content = input.value.trim();
    
    const { error } = await supabaseClient.from('chat_global').insert([{
        subject: channelName,
        content: content,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        portal: currentUser.portal
    }]);
    
    if (error) {
        window.showNotice("Erreur", "Impossible d'envoyer le message.", "error");
        return;
    }
    
    input.value = '';
    window.loadEventChat(eventId, channelName);
};

// Sauvegarder les informations (avec bouton explicite)
window.saveEventInfos = async (eventId) => {
    const description = document.getElementById(`ev-description-${eventId}`)?.value || null;
    const date = document.getElementById(`ev-date-${eventId}`)?.value || null;
    const time = document.getElementById(`ev-time-${eventId}`)?.value || null;
    const location = document.getElementById(`ev-location-${eventId}`)?.value || null;
    
    console.log('💾 Sauvegarde événement:', { eventId, description, date, time, location });
    
    const { error } = await supabaseClient
        .from('events')
        .update({
            description: description,
            event_date: date,
            event_time: time,
            location: location
        })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur sauvegarde:', error);
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
        return;
    }
    
    console.log('✅ Sauvegarde réussie');
    window.showNotice("Enregistré !", "Informations sauvegardées.", "success");
    loadEvents();
};

// Sauvegarder le texte réseaux sociaux
window.saveSocialText = async (eventId) => {
    const textArea = document.getElementById(`social-text-${eventId}`);
    if (!textArea) return;
    
    const text = textArea.value.trim() || null;
    
    const { error } = await supabaseClient
        .from('events')
        .update({ social_media_text: text })
        .eq('id', eventId);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder le texte.", "error");
        return;
    }
    
    window.showNotice("Enregistré !", "Texte sauvegardé avec succès.", "success");
    loadEvents();
};

// Supprimer le texte
window.deleteSocialText = async (eventId) => {
    window.alsatiaConfirm(
        "SUPPRIMER LE TEXTE",
        "Voulez-vous vraiment supprimer le texte pour les réseaux sociaux ?",
        async () => {
            const { error } = await supabaseClient
                .from('events')
                .update({ social_media_text: null })
                .eq('id', eventId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer le texte.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Texte supprimé.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

// Upload photos avec limite de taille
window.uploadPhotos = async (eventId) => {
    const input = document.getElementById(`photo-upload-${eventId}`);
    const files = input.files;
    
    if (!files || files.length === 0) return;
    
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    let uploadCount = 0;
    let errorCount = 0;
    
    for (let file of files) {
        if (file.size > MAX_SIZE) {
            window.showNotice("Fichier trop lourd", `${file.name} dépasse 10MB`, "warning");
            errorCount++;
            continue;
        }
        
        const filePath = `${eventId}/photos/${Date.now()}_${file.name}`;
        
        const { error } = await supabaseClient.storage
            .from('event-media')
            .upload(filePath, file);
        
        if (!error) {
            uploadCount++;
        } else {
            console.error("Erreur upload:", error);
            errorCount++;
        }
    }
    
    if (uploadCount > 0) {
        window.showNotice("Uploadé !", `${uploadCount} photo(s) ajoutée(s).`, "success");
        window.openEventDetails(eventId);
    }
    
    if (errorCount > 0) {
        window.showNotice("Attention", `${errorCount} fichier(s) n'ont pas pu être uploadés.`, "warning");
    }
};

// Upload documents avec limite de taille
window.uploadDocuments = async (eventId) => {
    const input = document.getElementById(`doc-upload-${eventId}`);
    const files = input.files;
    
    if (!files || files.length === 0) return;
    
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    let uploadCount = 0;
    let errorCount = 0;
    
    for (let file of files) {
        if (file.size > MAX_SIZE) {
            window.showNotice("Fichier trop lourd", `${file.name} dépasse 10MB`, "warning");
            errorCount++;
            continue;
        }
        
        const filePath = `${eventId}/documents/${Date.now()}_${file.name}`;
        
        const { error } = await supabaseClient.storage
            .from('event-media')
            .upload(filePath, file);
        
        if (!error) {
            uploadCount++;
        } else {
            console.error("Erreur upload:", error);
            errorCount++;
        }
    }
    
    if (uploadCount > 0) {
        window.showNotice("Uploadé !", `${uploadCount} document(s) ajouté(s).`, "success");
        window.openEventDetails(eventId);
    }
    
    if (errorCount > 0) {
        window.showNotice("Attention", `${errorCount} fichier(s) n'ont pas pu être uploadés.`, "warning");
    }
};

// Supprimer un média
window.deleteMedia = async (eventId, type, fileName) => {
    window.alsatiaConfirm(
        "SUPPRIMER",
        `Voulez-vous vraiment supprimer ce fichier ?`,
        async () => {
            const filePath = `${eventId}/${type}/${fileName}`;
            
            const { error } = await supabaseClient.storage
                .from('event-media')
                .remove([filePath]);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer le fichier.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Fichier supprimé.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

// Marquer comme terminé / repasser en cours
window.toggleEventComplete = async (eventId, isCurrentlyCompleted) => {
    const newStatus = isCurrentlyCompleted ? 'En cours' : 'Terminé';
    
    console.log('🔄 Toggle statut:', { eventId, isCurrentlyCompleted, newStatus });
    
    const { error } = await supabaseClient
        .from('events')
        .update({ status: newStatus })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur toggle:', error);
        window.showNotice("Erreur", "Impossible de changer le statut.", "error");
        return;
    }
    
    console.log('✅ Statut changé en:', newStatus);
    window.showNotice("Statut modifié", `Événement marqué comme "${newStatus}".`, "success");
    window.openEventDetails(eventId);
    loadEvents();
};

// Télécharger toutes les photos
window.downloadAllPhotos = async (eventId) => {
    const { data: files } = await supabaseClient.storage
        .from('event-media')
        .list(`${eventId}/photos`);
    
    const photos = (files || []).filter(f => f.name && f.name !== '.emptyFolderPlaceholder');
    
    if (photos.length === 0) {
        window.showNotice("Aucune photo", "Aucune photo à télécharger.", "warning");
        return;
    }
    
    for (let file of photos) {
        const { data } = await supabaseClient.storage
            .from('event-media')
            .download(`${eventId}/photos/${file.name}`);
        
        if (data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    window.showNotice("Téléchargement", `${photos.length} photo(s) téléchargée(s).`, "success");
};

// Copier le texte dans le presse-papier
window.copyTextToClipboard = async (eventId) => {
    const { data: ev } = await supabaseClient.from('events').select('social_media_text').eq('id', eventId).single();
    
    if (!ev || !ev.social_media_text) {
        window.showNotice("Aucun texte", "Aucun texte à copier.", "warning");
        return;
    }
    
    navigator.clipboard.writeText(ev.social_media_text).then(() => {
        window.showNotice("Copié !", "Texte copié dans le presse-papier.", "success");
    });
};

// Notifier un utilisateur
window.notifyUserForEvent = async (eventId) => {
    const select = document.getElementById(`notify-user-${eventId}`);
    if (!select || !select.value) {
        window.showNotice("Erreur", "Veuillez sélectionner un utilisateur.", "error");
        return;
    }
    
    const userId = select.value;
    const { data: user } = await supabaseClient.from('profiles').select('first_name, last_name').eq('id', userId).single();
    const { data: event } = await supabaseClient.from('events').select('title').eq('id', eventId).single();
    
    if (!user || !event) return;
    
    // Créer un message dans le canal général
    const message = `@${user.first_name} ${user.last_name} - Vous devez intervenir sur l'événement "${event.title}"`;
    
    const { error } = await supabaseClient.from('chat_global').insert([{
        subject: 'Général',
        content: message,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        portal: currentUser.portal
    }]);
    
    if (error) {
        window.showNotice("Erreur", "Impossible d'envoyer la notification.", "error");
        return;
    }
    
    window.showNotice("Notifié !", `${user.first_name} ${user.last_name} a été notifié(e).`, "success");
    select.value = '';
};
// REALTIME POUR DONORS (DONATEURS)
// ==========================================
window.subscribeToDonors = () => {
    if (window.donorsChannel) {
        window.donorsChannel.unsubscribe();
    }

    window.donorsChannel = supabaseClient
        .channel('donors-realtime-' + Date.now())
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'donors' }, 
            payload => {
                console.log('✅ Nouveau donateur ajouté:', payload.new);
                // Recharger la liste
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'donors' }, 
            payload => {
                console.log('📝 Donateur modifié:', payload.new);
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'donors' }, 
            payload => {
                console.log('🗑️ Donateur supprimé:', payload.old.id);
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .subscribe((status) => {
            console.log('Donors subscription status:', status);
        });
};

// ==========================================
// REALTIME POUR DONATIONS (DONS)
// ==========================================
window.subscribeToDonations = () => {
    if (window.donationsChannel) {
        window.donationsChannel.unsubscribe();
    }

    window.donationsChannel = supabaseClient
        .channel('donations-realtime-' + Date.now())
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'donations' }, 
            payload => {
                console.log('💰 Nouveau don ajouté:', payload.new);
                // Recharger la liste des donateurs pour mettre à jour les totaux
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'donations' }, 
            payload => {
                console.log('📝 Don modifié:', payload.new);
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'donations' }, 
            payload => {
                console.log('🗑️ Don supprimé:', payload.old.id);
                if (document.getElementById('tab-donors')?.classList.contains('active')) {
                    loadDonors();
                }
            }
        )
        .subscribe((status) => {
            console.log('Donations subscription status:', status);
        });
};

// ==========================================
// REALTIME POUR EVENTS (ÉVÉNEMENTS)
// ==========================================
window.subscribeToEvents = () => {
    if (window.eventsChannel) {
        window.eventsChannel.unsubscribe();
    }

    window.eventsChannel = supabaseClient
        .channel('events-realtime-' + Date.now())
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'events' }, 
            payload => {
                console.log('📅 Nouvel événement ajouté:', payload.new);
                if (document.getElementById('tab-events')?.classList.contains('active')) {
                    loadEvents();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'UPDATE', schema: 'public', table: 'events' }, 
            payload => {
                console.log('📝 Événement modifié:', payload.new);
                if (document.getElementById('tab-events')?.classList.contains('active')) {
                    loadEvents();
                }
            }
        )
        .on('postgres_changes', 
            { event: 'DELETE', schema: 'public', table: 'events' }, 
            payload => {
                console.log('🗑️ Événement supprimé:', payload.old.id);
                if (document.getElementById('tab-events')?.classList.contains('active')) {
                    loadEvents();
                }
            }
        )
        .subscribe((status) => {
            console.log('Events subscription status:', status);
        });
};

/**
 * 2. GESTION DES SUJETS (DROITS & FILTRAGE)
 */
window.loadChatSubjects = async () => {
    const { data: subjects, error } = await supabaseClient.from('chat_subjects').select('*').order('name');
    if (error) return;

    const container = document.getElementById('chat-subjects-list');
    if (!container) return;

    const myName = `${currentUser.first_name} ${currentUser.last_name}`;
    
    const filtered = subjects.filter(s => {
        // Si c'est Institut Alsatia, voir tout
        if (currentUser.portal === 'Institut Alsatia') return true;
        
        // Si c'est un canal privé (entity = 'Privé'), vérifier si mon nom est dedans
        if (s.entity === 'Privé') {
            return s.name.includes(myName);
        }
        
        // Sinon, filtrer par entité
        return !s.entity || s.entity === currentUser.portal;
    });

    container.innerHTML = filtered.map(s => {
        const isActive = currentChatSubject === s.name;
        return `
        <div class="chat-subject-item ${isActive ? 'active-chat-tab' : ''}" 
             style="display:flex; 
                    justify-content:space-between; 
                    align-items:center; 
                    border-radius:12px; 
                    margin-bottom:6px; 
                    padding:14px 16px; 
                    cursor:pointer; 
                    background:${isActive ? 'rgba(197, 160, 89, 0.15)' : 'transparent'};
                    border-left: 3px solid ${isActive ? 'var(--gold)' : 'transparent'};
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position:relative;"
             onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}')"
             onmouseover="if (!this.classList.contains('active-chat-tab')) { this.style.background='rgba(255,255,255,0.05)'; this.style.borderLeftColor='rgba(197,160,89,0.3)'; }"
             onmouseout="if (!this.classList.contains('active-chat-tab')) { this.style.background='transparent'; this.style.borderLeftColor='transparent'; }">
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                <div style="width:8px; height:8px; border-radius:50%; background:${isActive ? 'var(--gold)' : '#64748b'}; box-shadow:${isActive ? '0 0 8px var(--gold)' : 'none'}; transition:all 0.3s;"></div>
                <div style="flex:1;">
                    <div style="font-weight:${isActive ? '800' : '600'}; font-size:0.9rem; color:${isActive ? 'var(--gold)' : 'white'}; transition:all 0.3s;"># ${s.name}</div>
                    ${s.entity ? `<div style="font-size:0.7rem; opacity:0.6; margin-top:2px; color:white;">${s.entity}</div>` : ''}
                </div>
            </div>
            ${(currentUser.portal === 'Institut Alsatia' || s.entity === currentUser.portal) ? 
                `<i data-lucide="trash-2" 
                    style="width:14px; 
                           color:var(--danger); 
                           opacity:0; 
                           transition:all 0.2s; 
                           cursor:pointer;" 
                    onclick="event.stopPropagation(); window.deleteSubject('${s.id}', '${s.name}')"
                    onmouseover="this.style.opacity='1'; this.style.transform='scale(1.2)';"
                    onmouseout="this.style.opacity='0.5'; this.style.transform='scale(1);"></i>` : ''}
        </div>
    `;
    }).join('');
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
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    // Indicateur de chargement élégant
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px;">
            <div style="width:40px; height:40px; border:3px solid rgba(197,160,89,0.2); border-top-color:var(--gold); border-radius:50%; animation:spin 1s linear infinite;"></div>
            <p style="color:var(--text-muted); font-size:0.9rem;">Chargement des messages...</p>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
    
    const { data, error } = await supabaseClient.from('chat_global')
        .select('*').eq('subject', currentChatSubject).order('created_at', { ascending: true });
    
    if (error) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <i data-lucide="alert-circle" style="width:48px; height:48px; margin-bottom:15px; opacity:0.5;"></i>
                <p>Erreur lors du chargement des messages</p>
            </div>
        `;
        return;
    }
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:15px; opacity:0.6;">
                <i data-lucide="message-circle" style="width:64px; height:64px; color:var(--gold);"></i>
                <p style="color:var(--text-muted); font-size:1rem; font-weight:600;">Aucun message pour le moment</p>
                <p style="color:var(--text-muted); font-size:0.85rem;">Soyez le premier à écrire dans ce canal !</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Organiser les messages en threads (parents + réponses)
    const parentMessages = data.filter(msg => !msg.reply_to);
    const replyMessages = data.filter(msg => msg.reply_to);
    
    // Construire le HTML avec les threads
    let html = '';
    parentMessages.forEach(parent => {
        html += renderSingleMessage(parent, false);
        
        // Ajouter les réponses de ce message
        const replies = replyMessages.filter(r => r.reply_to === parent.id);
        if (replies.length > 0) {
            // Fermer la div du parent, ajouter les réponses dans le container replies-{id}
            html = html.replace(
                `<div id="replies-${parent.id}" class="replies-container"></div>`,
                `<div id="replies-${parent.id}" class="replies-container">
                    ${replies.map(r => renderSingleMessage(r, true)).join('')}
                </div>`
            );
        }
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();
};

function renderSingleMessage(msg, isReply = false) {
    const isMe = msg.author_full_name === `${currentUser.first_name} ${currentUser.last_name}`;
    const isMentioned = msg.content.includes(`@${currentUser.last_name}`);
    const date = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const portalIcon = LOGOS[msg.portal] || 'logo_alsatia.png';

    return `
        <div class="message-wrapper ${isMe ? 'my-wrapper' : ''}" data-msg-id="${msg.id}" style="display:flex; gap:12px; margin-bottom:${isReply ? '8px' : '20px'}; ${isReply ? 'margin-left:0;' : ''} align-items:flex-start; ${isMe ? 'flex-direction:row-reverse;' : ''} animation: slideIn 0.3s ease-out; width:100%;">
            
            <div style="${isMe ? 'text-align:right;' : ''} flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; ${isMe ? 'justify-content:flex-end;' : ''}">
                    <img src="${portalIcon}" style="width:${isReply ? '16px' : '20px'}; height:${isReply ? '16px' : '20px'}; object-fit:contain;">
                    <span style="font-weight:700; font-size:${isReply ? '0.8rem' : '0.9rem'}; color:var(--text-main);">${msg.author_full_name}</span>
                    <span style="font-size:0.7rem; color:var(--text-muted);">${date}</span>
                    ${isMe ? `
                        <i data-lucide="trash-2" 
                           onclick="window.deleteMessage('${msg.id}')" 
                           style="width:14px; 
                                  height:14px; 
                                  color:var(--danger); 
                                  cursor:pointer; 
                                  transition:all 0.2s;
                                  opacity:0.7;" 
                           onmouseover="this.style.opacity='1'; this.style.transform='scale(1.2)';" 
                           onmouseout="this.style.opacity='0.7'; this.style.transform='scale(1)';"></i>
                    ` : ''}
                </div>
                
                <div class="message ${isMe ? 'my-msg' : ''} ${isMentioned ? 'mentioned-luxe' : ''}" id="msg-${msg.id}" 
                     style="position:relative; 
                            padding:${isReply ? '10px 14px' : '14px 18px'}; 
                            border-radius:${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'}; 
                            background:${isMe ? 'linear-gradient(135deg, var(--primary) 0%, #1e293b 100%)' : isMentioned ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'white'}; 
                            color:${isMe ? 'white' : 'var(--text-main)'}; 
                            box-shadow: 0 ${isReply ? '1px 6px' : '2px 12px'} rgba(0,0,0,${isMe ? '0.15' : '0.08'}); 
                            border:${isMentioned && !isMe ? '2px solid var(--gold)' : 'none'};
                            line-height:1.6;
                            word-wrap: break-word;
                            display:inline-block;
                            max-width:100%;
                            font-size:${isReply ? '0.9rem' : '1rem'};
                            ${isMe ? 'margin-left:auto;' : ''}">
                    ${msg.content.replace(/@([\w\sàéèêîïôûù]+)/g, `<span class="mention-badge" style="background:${isMe ? 'rgba(197,160,89,0.3)' : 'rgba(197,160,89,0.15)'}; color:${isMe ? '#fbbf24' : 'var(--gold)'}; padding:2px 6px; border-radius:4px; font-weight:700;">@$1</span>`)}
                    
                    ${msg.file_url ? (() => {
                        const fileName = msg.file_url.split('/').pop();
                        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                        const isPDF = /\.pdf$/i.test(fileName);
                        
                        if (isImage) {
                            return `
                                <div style="margin-top:12px; padding-top:12px; border-top:1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'var(--border)'};">
                                    <a href="${msg.file_url}" target="_blank">
                                        <img src="${msg.file_url}" 
                                             style="max-width:100%; 
                                                    max-height:300px; 
                                                    border-radius:12px; 
                                                    cursor:pointer;
                                                    box-shadow:0 2px 8px rgba(0,0,0,0.15);
                                                    transition:transform 0.2s;"
                                             onmouseover="this.style.transform='scale(1.02)'"
                                             onmouseout="this.style.transform='scale(1)'">
                                    </a>
                                </div>
                            `;
                        } else {
                            return `
                                <div style="margin-top:12px; padding-top:12px; border-top:1px solid ${isMe ? 'rgba(255,255,255,0.2)' : 'var(--border)'};">
                                    <a href="${msg.file_url}" target="_blank" 
                                       style="color:${isMe ? '#fbbf24' : 'var(--gold)'}; 
                                              text-decoration:none; 
                                              font-size:0.85rem; 
                                              font-weight:600; 
                                              display:inline-flex; 
                                              align-items:center; 
                                              gap:6px;
                                              padding:8px 12px;
                                              background:${isMe ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.1)'};
                                              border-radius:8px;
                                              transition: all 0.2s;"
                                       onmouseover="this.style.transform='translateX(3px)'; this.style.background='${isMe ? 'rgba(255,255,255,0.15)' : 'rgba(197,160,89,0.15)'}'" 
                                       onmouseout="this.style.transform='translateX(0)'; this.style.background='${isMe ? 'rgba(255,255,255,0.1)' : 'rgba(197,160,89,0.1)'}'">
                                        <i data-lucide="${isPDF ? 'file-text' : 'paperclip'}" style="width:16px; height:16px;"></i>
                                        ${fileName.length > 30 ? fileName.substring(0, 30) + '...' : fileName}
                                    </a>
                                </div>
                            `;
                        }
                    })() : ''}
                </div>
                
                ${!isReply ? `
                <!-- Bouton Répondre et conteneur pour les réponses -->
                <div style="display:flex; gap:4px; margin-top:6px; ${isMe ? 'justify-content:flex-end;' : ''}">
                    <span onclick="window.replyToMessage('${msg.id}', '${msg.author_full_name}', \`${msg.content.replace(/`/g, '').substring(0, 50)}\`)" style="cursor:pointer; padding:6px 12px; border-radius:12px; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:all 0.2s; font-size:0.75rem; font-weight:600; color:var(--gold);" onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';">↩️ Répondre</span>
                </div>
                <div id="replies-${msg.id}" style="margin-top:12px;"></div>
                ` : ''}
            </div>
        </div>
    `;
}

function appendSingleMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    
    // Vérifier si le message existe déjà (éviter les doublons)
    if (document.getElementById(`msg-${msg.id}`)) {
        console.log('Message déjà affiché, ignoré:', msg.id);
        return;
    }
    
    // Si c'est une réponse, l'ajouter sous le message parent
    if (msg.reply_to) {
        const repliesContainer = document.getElementById(`replies-${msg.reply_to}`);
        if (repliesContainer) {
            const messageHTML = renderSingleMessage(msg, true);
            repliesContainer.insertAdjacentHTML('beforeend', messageHTML);
            
            // Animation d'apparition
            const lastReply = repliesContainer.lastElementChild;
            if (lastReply) {
                lastReply.style.opacity = '0';
                lastReply.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    lastReply.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    lastReply.style.opacity = '1';
                    lastReply.style.transform = 'translateY(0)';
                }, 50);
            }
            
            lucide.createIcons();
            container.scrollTop = container.scrollHeight;
            return;
        }
    }
    
    // Sinon, c'est un message principal, l'ajouter à la fin
    const messageHTML = renderSingleMessage(msg, false);
    container.insertAdjacentHTML('beforeend', messageHTML);
    
    // Récupérer le message qu'on vient d'ajouter
    const lastMsg = container.lastElementChild;
    if (!lastMsg) return;
    
    // Animation d'apparition
    lastMsg.style.opacity = '0';
    lastMsg.style.transform = 'translateY(20px)';
    
    container.scrollTop = container.scrollHeight;
    
    // Animation fluide
    setTimeout(() => {
        lastMsg.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        lastMsg.style.opacity = '1';
        lastMsg.style.transform = 'translateY(0)';
    }, 50);
    
    lucide.createIcons();
    
    // Notification sonore discrète pour les nouveaux messages (sauf les siens)
    if (msg.author_full_name !== `${currentUser.first_name} ${currentUser.last_name}`) {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYHGGS67emnURALT6Lf77BdGAU9kc/ywXIiBS9/y/DdjD4IFme57+ijUhAKTKHd67FeGgU8ktHtw3cmBi6AzvLaiTQGF2K48eylUxAKTJ/d7bdgGgU/k9HuwXMjBCx/zPHejj4HFme64OunVRILSZ3c67RfGQc/k9HuwHIkBC1+y/HejT0GFmi74OynUhAJTKHe67RgGQc/ktLux3QlBSx+zPLgkD0GFWe74eynVBELSZ7d7LNgGQc+ktPvxHMkBCt9y/Hej0AGF2i74O2oVBILSJ7e7LNhGwc+k9TwxnQlBSx8y/PhkUEGFWa64e2oVRIKSZ/e7LVgGQc+ktPvw3QlBCt8y/Ddjj0GF2m74O2nVBEKS57d7LRfGQc/k9Pvw3QmBSt8yO/ejT0HGWm84O6nVBEKS5/d7LReGAc/k9TwxHMkBCt7yO/djT4IHGq94O2oVREJS57e7LNgGAc+ktTwxHMlBCp7x+/ejj8JH2y84O+rVhIJSp7e7LNgGQc9ktTvw3QkBCp7x+/fi0AIH2284e+sWRQLSZ7f7rZjHAk9k9XwxHQlBCl6xu/ejD8JIm+74u+uWhYMSJ3f77RiGwk9lNbvw3YmBSh6xe7cizsIJHG64+6vWhYMSJ3g8LVjGgk8lNbvwnQmBSh5xe7djDsHJHG65O6wWxYLR53h8LRjGgk8lNfvwnUmBSd5xO3djDwHI3G65e6vWxYLSJ7h8bZkGwk7k9fvwXQlBSd4xO3di0AII3K65e6uWxYLSJ/h8bVjGgk7k9fvwHMlBSd4xOzdjj4II3G65e2vWhYKSJ/i8rZjGgk7kszvwHMjBSd3w+3ciz0JJHGz5u2vWRQJR5/j8rVhGQk5ktXwv3IlBCZ3wuzci0AIJHK05+2vWxUJRp7j8rViGQk5kdXwvnEkBCZ2wuvciz8JI3Kz5+2vWxUJRZ3j87RhGQk5kdTvv3IlBCZ2wuvcij4IJHOy5+yuWhQIRZ3j8rNfGAc4kdXvvnIkAyV1werciz4JJHO05+uuWhQIRZvj8rNfFwc4kNPvvXEkAyV0weraij4IJHSx5uuuWRQHRZrj8bJdFgY3j9Puu3AjAyR0wOralD0HJXS06euqWBQHQ5nk8bJcFQY3jtLtuG8iAyNzv+nYkD4HJXa16+qrVxMGQpjk8LJbFAU1jdDts28hAiJyvunXkD8HJ3az6+mpVxMFQZbj8LBaFAU0ks/ts28gAiByvenWjz8HKHW06+ioVRMFQJXi8K9ZEwQzj87ss24fASBwvujWkUAHKXe36+inVBIEP5Th8K5aEgQyjczssmwfAR9tvujVkUEHKne56+imUxEEPpPh8K5YEgQxjMvssWwdAR5svObUkEIHK3e76+imURIDP5Lg765YEQP=');
        audio.volume = 0.15;
        audio.play().catch(() => {});
    }
}

/**
 * 4. MENTIONS & ENVOI
 */
window.handleChatKeyUp = async (e) => {
    const input = e.target;
    const box = document.getElementById('mention-box');

    if (input.value.includes('@')) {
        const query = input.value.split('@').pop().toLowerCase();
        box.style.display = 'block';
        
        console.log('@ détecté, requête:', query);
        
        // Charger tous les utilisateurs depuis la base de données
        if (!allUsersForMentions || allUsersForMentions.length === 0) {
            console.log('Chargement des utilisateurs...');
            const { data: users, error } = await supabaseClient.from('profiles').select('first_name, last_name, portal');
            if (users && !error) {
                allUsersForMentions = users.map(u => ({
                    name: `${u.first_name} ${u.last_name}`,
                    portal: u.portal
                }));
                console.log('Utilisateurs chargés:', allUsersForMentions.length);
            } else {
                console.error('Erreur chargement utilisateurs:', error);
                allUsersForMentions = [];
            }
        }
        
        // Liste des entités
        const entities = [
            'Institut Alsatia', 
            'Academia Alsatia', 
            'Cours Herrade de Landsberg', 
            'Collège Saints Louis et Zélie Martin'
        ];
        
        // Combiner utilisateurs et entités
        const userSuggestions = allUsersForMentions.map(u => u.name);
        const allSuggestions = [...entities, ...userSuggestions];
        
        console.log('Total suggestions:', allSuggestions.length);
        
        const filtered = allSuggestions.filter(s => s.toLowerCase().includes(query));
        
        console.log('Suggestions filtrées:', filtered.length);
        
        if (filtered.length === 0) {
            box.innerHTML = '<div style="padding:10px; color:var(--text-muted); font-size:0.85rem; text-align:center;">Aucune suggestion</div>';
        } else {
            box.innerHTML = filtered.slice(0, 8).map(s => {
                const isEntity = entities.includes(s);
                return `
                    <div class="suggest-item" 
                         onclick="window.insertMention('${s.replace(/'/g, "\\'")}')" 
                         style="padding:12px 15px; 
                                cursor:pointer; 
                                border-bottom:1px solid #f1f5f9; 
                                transition:all 0.2s;
                                display:flex;
                                align-items:center;
                                gap:10px;"
                         onmouseover="this.style.background='#fdfaf3'; this.style.borderLeftColor='var(--gold)';"
                         onmouseout="this.style.background='white'; this.style.borderLeftColor='transparent';">
                        <div style="width:6px; height:6px; border-radius:50%; background:${isEntity ? 'var(--gold)' : '#64748b'};"></div>
                        <div style="flex:1;">
                            <div style="font-weight:600; color:var(--text-main);">@${s}</div>
                            ${isEntity ? '<div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Entité</div>' : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
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

// Variable globale pour stocker le message auquel on répond
let replyingTo = null;

window.replyToMessage = (messageId, authorName, messagePreview) => {
    replyingTo = { id: messageId, author: authorName, preview: messagePreview };
    
    // Afficher la barre de réponse
    const replyBar = document.getElementById('reply-bar');
    if (replyBar) {
        replyBar.style.display = 'flex';
        document.getElementById('reply-author').innerText = authorName;
        document.getElementById('reply-preview').innerText = messagePreview;
    }
    
    // Focus sur l'input
    document.getElementById('chat-input').focus();
};

window.cancelReply = () => {
    replyingTo = null;
    const replyBar = document.getElementById('reply-bar');
    if (replyBar) {
        replyBar.style.display = 'none';
    }
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

    // Préparer les données du message
    const messageData = {
        content: content,
        author_full_name: `${currentUser.first_name} ${currentUser.last_name}`,
        author_last_name: currentUser.last_name,
        portal: currentUser.portal,
        subject: currentChatSubject,
        file_url: fileUrl
    };

    // Ajouter reply_to seulement si on répond à un message
    // (La colonne reply_to doit exister dans Supabase)
    if (replyingTo) {
        messageData.reply_to = replyingTo.id;
    }

    const { data, error } = await supabaseClient.from('chat_global').insert([messageData]).select().single();

    if (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        window.showNotice('Erreur', 'Impossible d\'envoyer le message. Vérifiez que la colonne reply_to existe dans Supabase.', 'error');
        return;
    }

    // Affichage optimiste : ajouter le message immédiatement
    if (data) {
        appendSingleMessage(data);
    }

    input.value = '';
    window.clearChatFile();
    window.cancelReply();
};

window.deleteMessage = (id) => {
    window.alsatiaConfirm("SUPPRIMER", "Voulez-vous supprimer ce message ?", async () => {
        // Supprimer visuellement IMMÉDIATEMENT
        const msgWrapper = document.querySelector(`[data-msg-id="${id}"]`);
        if (msgWrapper) {
            msgWrapper.style.transition = 'all 0.3s ease';
            msgWrapper.style.opacity = '0';
            msgWrapper.style.transform = 'translateX(-20px)';
            setTimeout(() => {
                msgWrapper.remove();
            }, 300);
        }
        
        // Supprimer dans la base de données
        const { error } = await supabaseClient.from('chat_global').delete().eq('id', id);
        
        if (error) {
            console.error('Erreur suppression:', error);
            window.showNotice("Erreur", "Impossible de supprimer le message.", "error");
            // Recharger les messages en cas d'erreur
            window.loadChatMessages();
        } else {
            window.showNotice("Effacé", "Message supprimé.");
        }
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

// Supprimer un événement (avec médias)
window.askDeleteEvent = async (eventId, eventTitle, deleteMedia = false) => {
    window.alsatiaConfirm(
        "SUPPRIMER L'ÉVÉNEMENT",
        `Voulez-vous vraiment supprimer "${eventTitle}" ?${deleteMedia ? ' Les photos et documents seront également supprimés.' : ''}`,
        async () => {
            // Supprimer les médias si demandé
            if (deleteMedia) {
                // Supprimer toutes les photos
                const { data: photos } = await supabaseClient.storage
                    .from('event-media')
                    .list(`${eventId}/photos`);
                
                if (photos && photos.length > 0) {
                    const photoPaths = photos
                        .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
                        .map(f => `${eventId}/photos/${f.name}`);
                    
                    if (photoPaths.length > 0) {
                        await supabaseClient.storage.from('event-media').remove(photoPaths);
                    }
                }
                
                // Supprimer tous les documents
                const { data: docs } = await supabaseClient.storage
                    .from('event-media')
                    .list(`${eventId}/documents`);
                
                if (docs && docs.length > 0) {
                    const docPaths = docs
                        .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
                        .map(f => `${eventId}/documents/${f.name}`);
                    
                    if (docPaths.length > 0) {
                        await supabaseClient.storage.from('event-media').remove(docPaths);
                    }
                }
            }
            
            // Supprimer l'événement
            const { error } = await supabaseClient
                .from('events')
                .delete()
                .eq('id', eventId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer l'événement.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Événement supprimé.", "success");
            closeCustomModal();
            loadEvents();
        },
        true
    );
};

// ==========================================
// SUPPRESSION ÉVÉNEMENT AVEC MÉDIAS
// ==========================================
window.askDeleteEvent = async (eventId, eventTitle, deleteMedia = false) => {
    window.alsatiaConfirm(
        "SUPPRIMER L'ÉVÉNEMENT",
        `Voulez-vous vraiment supprimer "${eventTitle}" ?${deleteMedia ? ' Les photos et documents seront également supprimés.' : ''}`,
        async () => {
            // Supprimer les médias si demandé
            if (deleteMedia) {
                // Supprimer toutes les photos
                const { data: photos } = await supabaseClient.storage
                    .from('event-media')
                    .list(`${eventId}/photos`);
                
                if (photos && photos.length > 0) {
                    const photoPaths = photos
                        .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
                        .map(f => `${eventId}/photos/${f.name}`);
                    
                    if (photoPaths.length > 0) {
                        await supabaseClient.storage.from('event-media').remove(photoPaths);
                    }
                }
                
                // Supprimer tous les documents
                const { data: docs } = await supabaseClient.storage
                    .from('event-media')
                    .list(`${eventId}/documents`);
                
                if (docs && docs.length > 0) {
                    const docPaths = docs
                        .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
                        .map(f => `${eventId}/documents/${f.name}`);
                    
                    if (docPaths.length > 0) {
                        await supabaseClient.storage.from('event-media').remove(docPaths);
                    }
                }
            }
            
            // Supprimer l'événement
            const { error } = await supabaseClient
                .from('events')
                .delete()
                .eq('id', eventId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer l'événement.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Événement supprimé.", "success");
            closeCustomModal();
            loadEvents();
        },
        true
    );
};
