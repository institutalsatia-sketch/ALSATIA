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
let mentionUnreadCount = 0; // Compteur de mentions @nom non lues dans le chat global

const LOGOS = {
    "Institut Alsatia": "logo_alsatia.png",
    "Cours Herrade de Landsberg": "herrade.png",
    "Collège Saints Louis et Zélie Martin": "martin.png",
    "Academia Alsatia": "academia.png"
};
// ==========================================
// NOTIFICATIONS - MENTIONS et MESSAGES PRIVES
// ==========================================

window.showMessageNotification = function(fromName, type) {
    var toastContainer = document.getElementById('notice-toast');
    if (!toastContainer) return;

    var id = 'notif-' + Date.now();
    var icon = type === 'mention' ? 'at-sign' : 'message-circle';
    var label = type === 'mention' ? 'Vous avez ete mentionné(e)' : 'Nouveau message privé';
    var color = type === 'mention' ? 'var(--gold)' : '#3b82f6';

    var iconDiv = '<div style="width:36px;height:36px;border-radius:10px;background:' + color + '22;border:1.5px solid ' + color + '55;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="' + icon + '" style="width:18px;height:18px;color:' + color + ';"></i></div>';
    var textDiv = '<div style="flex:1;min-width:0;"><div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:' + color + ';margin-bottom:2px;">' + label + '</div><div style="font-size:0.88rem;font-weight:600;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">de ' + fromName + '</div></div>';
    var closeBtn = '<button onclick="document.getElementById(\'' + id + '\').remove()" style="background:none;border:none;cursor:pointer;color:#64748b;padding:4px;border-radius:6px;display:flex;align-items:center;" onmouseover="this.style.color=\'white\'" onmouseout="this.style.color=\'#64748b\'"><i data-lucide="x" style="width:14px;height:14px;"></i></button>';

    var wrapperStyle = 'background:var(--primary);color:white;padding:14px 18px;border-radius:14px;border-left:4px solid ' + color + ';box-shadow:0 8px 24px rgba(0,0,0,0.25);display:flex;align-items:center;gap:12px;min-width:280px;max-width:360px;pointer-events:auto;animation:slideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) forwards;';
    var html = '<div id="' + id + '" style="' + wrapperStyle + '">' + iconDiv + textDiv + closeBtn + '</div>';

    toastContainer.insertAdjacentHTML('beforeend', html);
    if (window.lucide) lucide.createIcons();

    setTimeout(function() {
        var el = document.getElementById(id);
        if (el) {
            el.style.transition = 'all 0.3s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateX(60px)';
            setTimeout(function() { el.remove(); }, 300);
        }
    }, 6000);
};

window.updateMentionBadge = function() {
    var navChat = document.getElementById('nav-chat');
    if (!navChat) return;
    var badge = navChat.querySelector('.mention-nav-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'mention-nav-badge';
        navChat.appendChild(badge);
    }
    if (mentionUnreadCount > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = String(Math.min(mentionUnreadCount, 99));
    } else {
        badge.style.display = 'none';
        badge.textContent = '';
    }
};

window.clearMentionBadge = function() {
    mentionUnreadCount = 0;
    window.updateMentionBadge();
};

window.startGlobalMentionWatcher = function() {
    if (window.mentionWatcherChannel) return;
    var myLastName = currentUser.last_name.toLowerCase().trim();
    var myFirstName = currentUser.first_name.toLowerCase().trim();
    window.mentionWatcherChannel = supabaseClient
        .channel('mention-watcher-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global' }, function(p) {
            var msg = p.new;
            if (!msg) return;
            // Ignorer ses propres messages (comparaison souple)
            var authorNorm = (msg.author_full_name || '').toLowerCase().trim();
            var myNorm = (myFirstName + ' ' + myLastName).trim();
            if (authorNorm === myNorm) return;
            // Détecter @NomDeFamille dans le contenu
            if (msg.content && msg.content.toLowerCase().indexOf('@' + myLastName) !== -1) {
                mentionUnreadCount++;
                window.updateMentionBadge();
                window.showMessageNotification(msg.author_full_name || 'Quelqu\'un', 'mention');
            }
        })
        .subscribe(function(status) {
            console.log('mention-watcher status:', status);
        });
};

// FIX CHAT REALTIME
window.subscribeToChat = function() {
    if (window.chatChannel) window.chatChannel.unsubscribe();
    var myFullName = currentUser.first_name + ' ' + currentUser.last_name;
    window.chatChannel = supabaseClient.channel('chat-' + Date.now())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_global', filter: 'subject=eq.' + currentChatSubject }, function(p) {
            if (p.new.author_full_name !== myFullName) {
                var c = document.getElementById('chat-messages-container');
                if (c) {
                    c.insertAdjacentHTML('beforeend', renderSingleMessage(p.new));
                    c.scrollTop = c.scrollHeight;
                    if (window.lucide) lucide.createIcons();
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
        // Nettoyer le channel Realtime si ouvert
        if (window.eventChatChannel) {
            try {
                supabaseClient.removeChannel(window.eventChatChannel);
                console.log('🧹 Channel Realtime nettoyé');
            } catch (e) {
                console.log('Erreur cleanup channel:', e);
            }
            window.eventChatChannel = null;
        }
        
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
    window.startGlobalMentionWatcher();
    
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

    // Bouton import Excel (Institut Alsatia uniquement)
    const btnImport = document.getElementById('btn-import-donors');
    if (btnImport) {
        btnImport.style.display = (portal === 'Institut Alsatia') ? 'inline-flex' : 'none';
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

    // Nettoyer le channel Realtime des événements si on quitte les événements
    if (tabId !== 'events' && window.eventChatChannel) {
        try {
            supabaseClient.removeChannel(window.eventChatChannel);
            console.log('🧹 Channel événement nettoyé (changement onglet)');
        } catch (e) {
            console.log('Erreur cleanup channel:', e);
        }
        window.eventChatChannel = null;
    }

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
        window.clearMentionBadge();
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
    
    const isInstitutAlsatia = currentUser.portal === 'Institut Alsatia';
    
    grid.innerHTML = users.map(u => {
        // Déterminer le badge de statut
        let statusBadge = '';
        let statusActions = '';
        
        if (u.status === 'pending') {
            statusBadge = '<div style="display:inline-block; background:#fef3c7; color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">⏳ EN ATTENTE D\'APPROBATION</div>';
            if (isInstitutAlsatia) {
                const pendingEmail = u.email ? `
                    <div style="margin-bottom:12px; background:#fef9ec; border:1.5px solid #fbbf24; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px;">
                        <div style="min-width:0;">
                            <div style="font-size:0.7rem; font-weight:700; color:#92400e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px;">Email de contact</div>
                            <div style="font-size:0.85rem; color:#1e293b; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.email}</div>
                        </div>
                        <a href="mailto:${u.email}?subject=Votre compte Alsatia a été approuvé&body=Bonjour ${u.first_name},%0A%0AVotre compte sur le portail Alsatia a été approuvé. Vous pouvez désormais vous connecter.%0A%0ACordialement,%0AL'équipe Alsatia"
                           style="background:var(--gold); color:white; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.75rem; text-decoration:none; white-space:nowrap; flex-shrink:0;">
                            ✉️ Envoyer
                        </a>
                    </div>
                ` : '<div style="margin-bottom:12px; font-size:0.8rem; color:#94a3b8; font-style:italic;">Aucun email renseigné</div>';

                statusActions = `
                    ${pendingEmail}
                    <div style="display:flex; gap:8px; margin-top:4px;">
                        <button onclick="window.approveUser('${u.id}')" style="flex:1; background:#10b981; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ✅ APPROUVER
                        </button>
                        <button onclick="window.rejectUser('${u.id}')" style="flex:1; background:#ef4444; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ❌ REFUSER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'revoked') {
            statusBadge = '<div style="display:inline-block; background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">🚫 ACCÈS RÉVOQUÉ</div>';
            if (isInstitutAlsatia) {
                statusActions = `
                    <div style="margin-top:16px;">
                        <button onclick="window.reactivateUser('${u.id}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ♻️ RÉACTIVER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'rejected') {
            statusBadge = '<div style="display:inline-block; background:#fee2e2; color:#991b1b; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">❌ INSCRIPTION REFUSÉE</div>';
            if (isInstitutAlsatia) {
                statusActions = `
                    <div style="margin-top:16px;">
                        <button onclick="window.reactivateUser('${u.id}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                            ♻️ RÉACTIVER
                        </button>
                    </div>
                `;
            }
        } else if (u.status === 'approved' && isInstitutAlsatia && u.id !== currentUser.id) {
            // Utilisateur approuvé - possibilité de révoquer (sauf soi-même)
            statusBadge = '<div style="display:inline-block; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px;">✅ ACTIF</div>';
            
            // GESTION DES ACCÈS (seulement si pas Institut Alsatia)
            let accessToggles = '';
            if (u.portal !== 'Institut Alsatia') {
                accessToggles = `
                    <div style="margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px;">
                        <p style="margin:0 0 10px 0; font-size:0.85rem; font-weight:700; color:#64748b;">🔐 Accès autorisés :</p>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                                <input type="checkbox" ${u.access_donors ? 'checked' : ''} onchange="window.toggleAccess('${u.id}', 'access_donors', this.checked)" style="width:18px; height:18px; cursor:pointer;">
                                <span>Base Donateurs</span>
                            </label>
                            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                                <input type="checkbox" ${u.access_events ? 'checked' : ''} onchange="window.toggleAccess('${u.id}', 'access_events', this.checked)" style="width:18px; height:18px; cursor:pointer;">
                                <span>Événements</span>
                            </label>
                        </div>
                    </div>
                `;
            }
            
            statusActions = `
                ${accessToggles}
                <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px;">
                    <button onclick="window.revokeUser('${u.id}')" style="width:100%; background:#ef4444; color:white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.85rem;">
                        🚫 RÉVOQUER L'ACCÈS
                    </button>
                    <button onclick="window.deleteUser('${u.id}', '${u.first_name} ${u.last_name}')" style="width:100%; background:#7f1d1d; color:#fecaca; border:2px solid #991b1b; padding:10px; border-radius:8px; cursor:pointer; font-weight:700; font-size:0.8rem; letter-spacing:0.5px;">
                        🗑️ SUPPRIMER DÉFINITIVEMENT
                    </button>
                </div>
            `;
        } else {
            // Utilisateur normal approuvé
            statusBadge = '<div style="display:inline-block; background:linear-gradient(135deg, #fef3c7, #fde68a); color:#92400e; font-size:0.7rem; font-weight:700; padding:6px 12px; border-radius:20px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px;">' + u.portal + '</div>';
        }
        
        return `
            <div class="contact-card" style="background:white; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.08); padding:24px; transition:all 0.3s; border:2px solid transparent;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.12)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)'; this.style.borderColor='transparent';">
                
                <!-- En-tête sans avatar -->
                <div style="margin-bottom:20px;">
                    <h3 style="margin:0 0 4px 0; font-size:1.1rem; font-weight:800; color:#1e293b;">${u.first_name} ${u.last_name.toUpperCase()}</h3>
                    <p style="margin:0; font-size:0.85rem; color:#64748b; font-weight:500;">${u.job_title || 'Collaborateur'}</p>
                </div>
                
                <!-- Badge statut/entité -->
                ${statusBadge}
                
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
                
                <!-- Actions de gestion (Institut Alsatia seulement) -->
                ${statusActions}
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
            <h3 class="luxe-title">
                <i data-lucide="user-plus" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                NOUVEAU CONTACT CRM
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Entité -->
            <p class="mini-label">AFFECTATION ÉCOLE *</p>
            <select id="n-d-entity" class="luxe-input" style="border:1px solid var(--gold); margin-bottom:15px;">
                <option ${userPortal === 'Institut Alsatia' ? 'selected' : ''}>Institut Alsatia</option>
                <option ${userPortal === 'Academia Alsatia' ? 'selected' : ''}>Academia Alsatia</option>
                <option ${userPortal === 'Cours Herrade de Landsberg' ? 'selected' : ''}>Cours Herrade de Landsberg</option>
                <option ${userPortal === 'Collège Saints Louis et Zélie Martin' ? 'selected' : ''}>Collège Saints Louis et Zélie Martin</option>
            </select>

            <!-- Nom + Prénom -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">NOM *</p><input type="text" id="n-d-last" class="luxe-input" placeholder="DUPONT"></div>
                <div><p class="mini-label">PRÉNOM</p><input type="text" id="n-d-first" class="luxe-input" placeholder="Jean"></div>
            </div>

            <!-- Entreprise -->
            <p class="mini-label">ENTREPRISE / ASSOCIATION (Optionnel)</p>
            <input type="text" id="n-d-company" class="luxe-input" placeholder="Société XYZ" style="margin-bottom:15px;">

            <!-- Email + Téléphone -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">EMAIL</p><input type="email" id="n-d-email" class="luxe-input" placeholder="jean@email.com"></div>
                <div><p class="mini-label">TÉLÉPHONE</p><input type="text" id="n-d-phone" class="luxe-input" placeholder="06 12 34 56 78"></div>
            </div>

            <!-- Adresse -->
            <p class="mini-label">ADRESSE</p>
            <input type="text" id="n-d-address" class="luxe-input" placeholder="12 rue de la Paix" style="margin-bottom:10px;">
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:10px; margin-bottom:15px;">
                <div><p class="mini-label">CODE POSTAL</p><input type="text" id="n-d-zip" class="luxe-input" placeholder="67000"></div>
                <div><p class="mini-label">VILLE</p><input type="text" id="n-d-city" class="luxe-input" placeholder="Strasbourg"></div>
            </div>

            <!-- Origine -->
            <p class="mini-label">ORIGINE DU CONTACT</p>
            <select id="n-d-origin" class="luxe-input" style="margin-bottom:15px;">
                <option value="">— Non renseigné —</option>
                <option>Gala annuel</option>
                <option>Recommandation</option>
                <option>Événement</option>
                <option>Site web</option>
                <option>Courrier</option>
                <option>Ancien élève</option>
                <option>Parent d'élève</option>
                <option>Autre</option>
            </select>

            <!-- Notes -->
            <p class="mini-label">NOTES INTERNES</p>
            <textarea id="n-d-notes" class="luxe-input" rows="3" placeholder="Informations complémentaires..." style="margin-bottom:20px;"></textarea>

            <button onclick="window.execCreateDonor()" class="btn-gold-fill" style="width:100%; height:48px; letter-spacing:1px;">
                <i data-lucide="save" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                CRÉER LE CONTACT
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

window.execCreateDonor = async () => {
    const last = document.getElementById('n-d-last').value.trim();
    const ent = document.getElementById('n-d-entity').value;
    if(!last || !ent) return window.showNotice("Erreur", "Le Nom et l'Entité sont obligatoires.", "error");

    const { error } = await supabaseClient.from('donors').insert([{
        last_name: last.toUpperCase(),
        first_name: document.getElementById('n-d-first').value.trim(),
        company_name: document.getElementById('n-d-company').value.trim() || null,
        entity: ent,
        email: document.getElementById('n-d-email').value.trim().toLowerCase() || null,
        phone: document.getElementById('n-d-phone').value.trim() || null,
        address: document.getElementById('n-d-address').value.trim() || null,
        zip_code: document.getElementById('n-d-zip').value.trim() || null,
        city: document.getElementById('n-d-city').value.trim() || null,
        origin: document.getElementById('n-d-origin').value || null,
        notes: document.getElementById('n-d-notes').value.trim() || null,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    }]);

    if(error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Succès ✅", "Contact créé avec succès.", "success");
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
                <input type="text" id="edit-address" class="luxe-input" value="${donor.address || ''}" placeholder="Adresse" style="margin-bottom:8px;">
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
                    <thead><tr><th>DATE</th><th>MONTANT</th><th>MODE</th><th>CAMPAGNE</th><th>N° REÇU</th><th>REMERCIÉ ?</th><th style="text-align:right;">ACTION</th></tr></thead>
                    <tbody>
                        ${dons.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding:15px; color:#999;">Aucun don enregistré</td></tr>' : ''}
                        ${dons.map(don => `
                            <tr style="${!don.thanked ? 'background:rgba(239, 68, 68, 0.05);' : ''}">
                                <td>${new Date(don.date).toLocaleDateString('fr-FR')}</td>
                                <td style="font-weight:700;">${Number(don.amount).toLocaleString('fr-FR')} €</td>
                                <td><span style="font-size:0.75rem; color:#64748b;">${don.payment_mode || '—'}</span></td>
                                <td><span style="font-size:0.75rem; color:#64748b;">${don.campaign || '—'}</span></td>
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
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="heart-handshake" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                ENREGISTRER UN DON
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- Montant + Date -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                    <p class="mini-label">MONTANT (€) *</p>
                    <input type="number" id="don-amt" class="luxe-input" placeholder="0.00" min="0" step="0.01">
                </div>
                <div>
                    <p class="mini-label">DATE DU DON *</p>
                    <input type="date" id="don-date" class="luxe-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>

            <!-- Mode de paiement -->
            <p class="mini-label">MODE DE PAIEMENT</p>
            <select id="don-method" class="luxe-input" style="margin-bottom:14px;">
                <option value="">— Sélectionner —</option>
                <option>Virement bancaire</option>
                <option>Chèque</option>
                <option>Espèces</option>
                <option>Carte bancaire</option>
                <option>Prélèvement automatique</option>
                <option>Helloasso</option>
                <option>Autre</option>
            </select>

            <!-- Reçu fiscal + ID reçu -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px;">
                <div>
                    <p class="mini-label">N° REÇU FISCAL</p>
                    <input type="text" id="don-receipt" class="luxe-input" placeholder="Ex: RF-2025-001">
                </div>
                <div>
                    <p class="mini-label">ID REÇU INTERNE</p>
                    <input type="text" id="don-fiscal-id" class="luxe-input" placeholder="Ex: REC-0042">
                </div>
            </div>

            <!-- Campagne / Objet du don -->
            <p class="mini-label">OBJET / CAMPAGNE DU DON</p>
            <input type="text" id="don-campaign" class="luxe-input" placeholder="Ex: Gala 2025, Fête de fin d'année..." style="margin-bottom:14px;">

            <!-- Remercié -->
            <div style="display:flex; align-items:center; gap:12px; background:rgba(197,160,89,0.06); border:1px dashed var(--gold); border-radius:10px; padding:12px 16px; margin-bottom:20px;">
                <input type="checkbox" id="don-thanked" style="width:18px;height:18px;accent-color:var(--gold);cursor:pointer;">
                <label for="don-thanked" style="cursor:pointer; font-size:0.88rem; font-weight:600; color:var(--primary);">
                    Le donateur a déjà été remercié pour ce don
                </label>
            </div>

            <button onclick="window.execAddDonation('${donorId}')" class="btn-gold-fill" style="width:100%; height:48px; font-size:0.95rem; letter-spacing:1px;">
                <i data-lucide="check-circle" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                VALIDER LE PAIEMENT
            </button>
        </div>
    `);
    if(window.lucide) lucide.createIcons();
};

window.execAddDonation = async (donorId) => {
    const amt = document.getElementById('don-amt').value;
    const dat = document.getElementById('don-date').value;
    if (!amt || parseFloat(amt) <= 0) return window.showNotice("Erreur", "Le montant doit être supérieur à 0.", "error");
    if (!dat) return window.showNotice("Erreur", "La date est obligatoire.", "error");

    const { error } = await supabaseClient.from('donations').insert([{
        donor_id: donorId,
        amount: parseFloat(amt),
        date: dat,
        payment_mode: document.getElementById('don-method').value || null,
        tax_receipt_number: document.getElementById('don-receipt').value.trim() || null,
        fiscal_receipt_id: document.getElementById('don-fiscal-id').value.trim() || null,
        campaign: document.getElementById('don-campaign').value.trim() || null,
        thanked: document.getElementById('don-thanked').checked
    }]);

    if (error) return window.showNotice("Erreur", error.message, "error");

    window.showNotice("Bravo !", "Don enregistré avec succès.", "success");
    if(typeof loadDashboardData === 'function') loadDashboardData();
    closeCustomModal();
    window.loadDonors();
};

window.updateDonorFields = async (id) => {
    const payload = {
        entity: document.getElementById('edit-entity').value,
        last_name: document.getElementById('edit-last').value.toUpperCase(),
        first_name: document.getElementById('edit-first').value,
        company_name: document.getElementById('edit-company').value || null,
        email: document.getElementById('edit-email').value || null,
        phone: document.getElementById('edit-phone').value || null,
        address: document.getElementById('edit-address') ? document.getElementById('edit-address').value : null,
        zip_code: document.getElementById('edit-zip').value || null,
        city: document.getElementById('edit-city').value || null,
        origin: document.getElementById('edit-origin').value || null,
        notes: document.getElementById('edit-notes').value || null,
        last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`
    };
    const { error } = await supabaseClient.from('donors').update(payload).eq('id', id);
    if(error) return window.showNotice("Erreur", error.message, "error");
    window.showNotice("Succès ✅", "Fiche mise à jour.", "success");
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
        'Adresse': d.address || '',
        'Code Postal': d.zip_code || '',
        'Ville': d.city || '',
        'Origine': d.origin || '',
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
                        'Montant (€)': parseFloat(don.amount || 0),
                        'Mode de paiement': don.payment_mode || '',
                        'Campagne': don.campaign || '',
                        'N° Reçu Fiscal': don.tax_receipt_number || '',
                        'ID Reçu Interne': don.fiscal_receipt_id || '',
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
        'Adresse': donor.address || '',
        'Code Postal': donor.zip_code || '',
        'Ville': donor.city || '',
        'Origine': donor.origin || '',
        'Notes': donor.notes || '',
        'Modifié par': donor.last_modified_by || '',
        'Total des dons': donor.donations ? donor.donations.reduce((sum, don) => sum + parseFloat(don.amount || 0), 0) + ' €' : '0 €',
        'Nombre de dons': donor.donations ? donor.donations.length : 0
    }];
    
    // Onglet 2 : TOUS LES DONS DU DONATEUR
    const donationsData = donor.donations && donor.donations.length > 0 
        ? donor.donations.map(don => ({
            'Date': new Date(don.date).toLocaleDateString('fr-FR'),
            'Montant (€)': parseFloat(don.amount || 0),
            'Mode de paiement': don.payment_mode || '',
            'Campagne': don.campaign || '',
            'N° Reçu Fiscal': don.tax_receipt_number || '',
            'ID Reçu Interne': don.fiscal_receipt_id || '',
            'Remercié': don.thanked ? 'Oui' : 'Non'
        }))
        : [{ 'Aucun don enregistré': '' }];
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(donorInfo);
    XLSX.utils.book_append_sheet(wb, ws1, "Informations");
    const ws2 = XLSX.utils.json_to_sheet(donationsData);
    XLSX.utils.book_append_sheet(wb, ws2, "Historique des dons");
    
    const fileName = `${donor.last_name}_${donor.first_name || 'Donateur'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    window.showNotice("Téléchargé !", `Fichier "${fileName}" prêt`, "success");
};

function loadUsersForMentions() { console.log("Module CRM Alsatia v2.0 chargé."); }

// ==========================================
// IMPORT EXCEL — DONATEURS (Institut Alsatia uniquement)
// ==========================================

const VALID_ENTITIES_IMPORT = [
    'Institut Alsatia',
    'Academia Alsatia',
    'Cours Herrade de Landsberg',
    'Collège Saints Louis et Zélie Martin'
];

// Stockage temporaire des données prévisualisées
window._importPreviewData = [];

/**
 * OUVRIR LA MODALE D'IMPORT
 */
window.showImportDonorsModal = () => {
    if (currentUser.portal !== 'Institut Alsatia') {
        window.showNotice("Accès refusé", "Cette fonctionnalité est réservée à Institut Alsatia.", "error");
        return;
    }

    showCustomModal(`
        <div class="modal-header-luxe">
            <h3 class="luxe-title">
                <i data-lucide="upload" style="width:20px;height:20px;vertical-align:middle;margin-right:8px;color:var(--gold);"></i>
                IMPORT EXCEL — DONATEURS
            </h3>
            <button onclick="closeCustomModal()" class="close-btn">&times;</button>
        </div>
        <div class="modal-scroll-body">

            <!-- BULLE D'INFO TEMPLATE -->
            <div style="background:rgba(197,160,89,0.07); border:1.5px solid var(--gold); border-radius:14px; padding:18px 20px; margin-bottom:22px;">
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                    <i data-lucide="info" style="width:20px;height:20px;color:var(--gold);flex-shrink:0;"></i>
                    <span style="font-weight:800; font-size:0.85rem; color:var(--primary); text-transform:uppercase; letter-spacing:0.8px;">Format du fichier Excel attendu</span>
                </div>

                <p style="font-size:0.82rem; color:var(--primary); margin:0 0 12px 0; font-weight:600;">Le fichier doit avoir <b>2 onglets</b> :</p>

                <!-- Onglet 1 : Donateurs -->
                <div style="background:white; border-radius:10px; padding:14px; margin-bottom:10px; border:1px solid #e2e8f0;">
                    <div style="font-weight:800; font-size:0.8rem; color:#10b981; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        📋 Onglet 1 — "Donateurs" (colonnes attendues)
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; font-size:0.75rem;">
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#ef4444;font-weight:900;">*</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700;">last_name</code>
                            <span style="color:#64748b;">Nom (obligatoire)</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">first_name</code>
                            <span style="color:#64748b;">Prénom</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">company_name</code>
                            <span style="color:#64748b;">Entreprise</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">email</code>
                            <span style="color:#64748b;">Email</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">phone</code>
                            <span style="color:#64748b;">Téléphone</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">address</code>
                            <span style="color:#64748b;">Adresse</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">zip_code</code>
                            <span style="color:#64748b;">Code postal</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">city</code>
                            <span style="color:#64748b;">Ville</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">entity</code>
                            <span style="color:#64748b;">École / Entité</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">origin</code>
                            <span style="color:#64748b;">Origine</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;grid-column:1/-1;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">notes</code>
                            <span style="color:#64748b;">Notes internes</span>
                        </div>
                    </div>
                    <p style="font-size:0.72rem; color:#64748b; margin:10px 0 0 0; font-style:italic;">
                        💡 Si la colonne <code>entity</code> est absente ou invalide → valeur par défaut : <b>Institut Alsatia</b>
                    </p>
                </div>

                <!-- Onglet 2 : Dons -->
                <div style="background:white; border-radius:10px; padding:14px; border:1px solid #e2e8f0;">
                    <div style="font-weight:800; font-size:0.8rem; color:#3b82f6; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">
                        💰 Onglet 2 — "Dons" (colonnes attendues)
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; font-size:0.75rem;">
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#ef4444;font-weight:900;">*</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700;">last_name</code>
                            <span style="color:#64748b;">Nom du donateur</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#ef4444;font-weight:900;">*</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700;">amount</code>
                            <span style="color:#64748b;">Montant en €</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">date</code>
                            <span style="color:#64748b;">Date (JJ/MM/AAAA)</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">payment_mode</code>
                            <span style="color:#64748b;">Mode de paiement</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">campaign</code>
                            <span style="color:#64748b;">Campagne / Objet</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">tax_receipt_number</code>
                            <span style="color:#64748b;">N° reçu fiscal</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:3px 0;grid-column:1/-1;">
                            <span style="color:#94a3b8;">○</span>
                            <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">thanked</code>
                            <span style="color:#64748b;">Remercié ? (Oui / Non)</span>
                        </div>
                    </div>
                    <p style="font-size:0.72rem; color:#64748b; margin:10px 0 0 0; font-style:italic;">
                        💡 La colonne <b>last_name</b> dans l'onglet Dons sert à rattacher chaque don au bon donateur importé.
                    </p>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-top:12px; padding:10px 12px; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe;">
                    <i data-lucide="download" style="width:16px;height:16px;color:#3b82f6;flex-shrink:0;"></i>
                    <span style="font-size:0.78rem; color:#1e40af; font-weight:600;">
                        Téléchargez un fichier template vide : 
                        <span onclick="window.downloadImportTemplate()" style="text-decoration:underline; cursor:pointer;">
                            Template_Import_Donateurs.xlsx
                        </span>
                    </span>
                </div>
            </div>

            <!-- Sélection fichier -->
            <p class="mini-label">SÉLECTIONNER LE FICHIER EXCEL (.xlsx / .xls)</p>
            <input type="file" id="import-excel-file" accept=".xlsx,.xls"
                style="width:100%; padding:12px; border:2px dashed var(--gold); border-radius:12px; background:rgba(197,160,89,0.03); color:var(--primary); margin-bottom:20px; cursor:pointer; font-size:0.9rem;">

            <!-- Zone de prévisualisation -->
            <div id="import-preview" style="display:none; margin-bottom:16px;"></div>

            <!-- Boutons -->
            <button onclick="window.previewImportDonors()" class="btn-gold" style="width:100%; height:46px; margin-bottom:10px;">
                <i data-lucide="eye" style="width:16px;height:16px;vertical-align:middle;margin-right:8px;"></i>
                PRÉVISUALISER LES DONNÉES
            </button>
            <button id="btn-confirm-import" onclick="window.execImportDonors()" class="btn-gold-fill" style="width:100%; height:50px; display:none; font-size:1rem; letter-spacing:1px;">
                <i data-lucide="upload-cloud" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>
                CONFIRMER L'IMPORT
            </button>
        </div>
    `);
    if (window.lucide) lucide.createIcons();
};

/**
 * TÉLÉCHARGER UN TEMPLATE VIDE
 */
window.downloadImportTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Onglet Donateurs
    const donorsTemplate = [{
        last_name: 'DUPONT',
        first_name: 'Jean',
        company_name: '',
        email: 'jean.dupont@email.com',
        phone: '06 12 34 56 78',
        address: '12 rue de la Paix',
        zip_code: '67000',
        city: 'Strasbourg',
        entity: 'Institut Alsatia',
        origin: 'Gala 2025',
        notes: ''
    }];

    // Onglet Dons
    const donsTemplate = [{
        last_name: 'DUPONT',
        amount: 500,
        date: '15/06/2024',
        payment_mode: 'Virement bancaire',
        campaign: 'Gala 2025',
        tax_receipt_number: 'RF-2025-001',
        fiscal_receipt_id: 'REC-0001',
        thanked: 'Oui'
    }];

    const ws1 = XLSX.utils.json_to_sheet(donorsTemplate);
    XLSX.utils.book_append_sheet(wb, ws1, 'Donateurs');
    const ws2 = XLSX.utils.json_to_sheet(donsTemplate);
    XLSX.utils.book_append_sheet(wb, ws2, 'Dons');

    XLSX.writeFile(wb, 'Template_Import_Donateurs.xlsx');
    window.showNotice("Template téléchargé !", "Remplissez le fichier puis importez-le.", "success");
};

/**
 * PRÉVISUALISER LES DONNÉES DU FICHIER
 */
window.previewImportDonors = () => {
    const fileInput = document.getElementById('import-excel-file');
    if (!fileInput || !fileInput.files[0]) {
        window.showNotice("Erreur", "Veuillez sélectionner un fichier Excel.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });

            // --- LECTURE ONGLET DONATEURS ---
            const donorSheetName = workbook.SheetNames.find(n =>
                n.toLowerCase().includes('donat') || n.toLowerCase().includes('contact') || n === workbook.SheetNames[0]
            );
            const donorSheet = workbook.Sheets[donorSheetName];
            const donorRows = XLSX.utils.sheet_to_json(donorSheet, { defval: '' });

            if (!donorRows.length) {
                window.showNotice("Fichier vide", "Aucune ligne trouvée dans l'onglet Donateurs.", "error");
                return;
            }

            // Normaliser les donateurs
            window._importPreviewData = donorRows.map((r, i) => {
                const raw = (v) => (v || '').toString().trim();
                const lastName = raw(r['last_name'] || r['Last_Name'] || r['NOM'] || r['Nom']).toUpperCase();
                const entityRaw = raw(r['entity'] || r['Entity'] || r['ENTITÉ'] || r['entite'] || r['Entité']);
                const entity = VALID_ENTITIES_IMPORT.includes(entityRaw) ? entityRaw : 'Institut Alsatia';
                return {
                    last_name: lastName,
                    first_name: raw(r['first_name'] || r['PRÉNOM'] || r['Prénom']),
                    company_name: raw(r['company_name'] || r['ENTREPRISE'] || r['Entreprise']) || null,
                    email: raw(r['email'] || r['Email'] || r['EMAIL']).toLowerCase() || null,
                    phone: raw(r['phone'] || r['TÉLÉPHONE'] || r['Téléphone'] || r['Tel']) || null,
                    address: raw(r['address'] || r['ADRESSE'] || r['Adresse']) || null,
                    zip_code: raw(r['zip_code'] || r['CP'] || r['Code Postal'] || r['code_postal']) || null,
                    city: raw(r['city'] || r['VILLE'] || r['Ville']) || null,
                    entity,
                    origin: raw(r['origin'] || r['ORIGINE'] || r['Origine']) || null,
                    notes: raw(r['notes'] || r['NOTES'] || r['Notes']) || null,
                    last_modified_by: `${currentUser.first_name} ${currentUser.last_name}`,
                    _rowIndex: i + 2,
                    _valid: !!lastName
                };
            });

            // --- LECTURE ONGLET DONS (optionnel) ---
            window._importDonsData = [];
            if (workbook.SheetNames.length >= 2) {
                const donsSheetName = workbook.SheetNames.find(n =>
                    n.toLowerCase().includes('don') && !n.toLowerCase().includes('donat')
                ) || workbook.SheetNames[1];

                if (donsSheetName !== donorSheetName) {
                    const donsSheet = workbook.Sheets[donsSheetName];
                    const donsRows = XLSX.utils.sheet_to_json(donsSheet, { defval: '' });
                    const raw = (v) => (v || '').toString().trim();

                    window._importDonsData = donsRows
                        .filter(r => raw(r['last_name'] || r['NOM'] || r['Nom']) && raw(r['amount'] || r['MONTANT'] || r['Montant']))
                        .map(r => {
                            const lastName = raw(r['last_name'] || r['NOM'] || r['Nom']).toUpperCase();
                            const amountRaw = raw(r['amount'] || r['MONTANT'] || r['Montant']).replace(',', '.').replace(/[^0-9.]/g, '');
                            const amount = parseFloat(amountRaw);

                            // Parsing date flexible
                            let dateStr = raw(r['date'] || r['DATE'] || r['Date']);
                            let parsedDate = null;
                            if (dateStr) {
                                // Tentative DD/MM/YYYY
                                const parts = dateStr.split('/');
                                if (parts.length === 3) {
                                    parsedDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
                                } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
                                    parsedDate = dateStr.substring(0, 10);
                                } else if (r['date'] instanceof Date) {
                                    parsedDate = r['date'].toISOString().split('T')[0];
                                }
                            }
                            if (!parsedDate) parsedDate = new Date().toISOString().split('T')[0];

                            const thankedRaw = raw(r['thanked'] || r['REMERCIÉ'] || r['Remercié']).toLowerCase();

                            return {
                                _donor_last_name: lastName,
                                amount: isNaN(amount) ? null : amount,
                                date: parsedDate,
                                payment_mode: raw(r['payment_mode'] || r['MODE'] || r['Mode de paiement']) || null,
                                campaign: raw(r['campaign'] || r['CAMPAGNE'] || r['Campagne']) || null,
                                tax_receipt_number: raw(r['tax_receipt_number'] || r['N° REÇU'] || r['Reçu fiscal']) || null,
                                fiscal_receipt_id: raw(r['fiscal_receipt_id'] || r['ID REÇU'] || r['ID Reçu']) || null,
                                thanked: ['oui', 'yes', '1', 'true', 'o'].includes(thankedRaw),
                                _valid: !isNaN(amount) && amount > 0
                            };
                        });
                }
            }

            const valid = window._importPreviewData.filter(r => r._valid);
            const invalid = window._importPreviewData.filter(r => !r._valid);
            const validDons = window._importDonsData.filter(d => d._valid);

            const previewEl = document.getElementById('import-preview');
            previewEl.style.display = 'block';
            previewEl.innerHTML = `
                <!-- Compteurs -->
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:16px;">
                    <div style="background:#f0fdf4; border:1px solid #22c55e; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.6rem; font-weight:900; color:#16a34a;">${valid.length}</div>
                        <div style="font-size:0.7rem; color:#16a34a; font-weight:700; text-transform:uppercase;">Donateurs valides</div>
                    </div>
                    <div style="background:${invalid.length > 0 ? '#fef2f2' : '#f8fafc'}; border:1px solid ${invalid.length > 0 ? '#ef4444' : '#e2e8f0'}; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.6rem; font-weight:900; color:${invalid.length > 0 ? '#dc2626' : '#94a3b8'};">${invalid.length}</div>
                        <div style="font-size:0.7rem; color:${invalid.length > 0 ? '#dc2626' : '#94a3b8'}; font-weight:700; text-transform:uppercase;">Sans nom (ignorés)</div>
                    </div>
                    <div style="background:#eff6ff; border:1px solid #3b82f6; border-radius:10px; padding:12px; text-align:center;">
                        <div style="font-size:1.6rem; font-weight:900; color:#1d4ed8;">${validDons.length}</div>
                        <div style="font-size:0.7rem; color:#1d4ed8; font-weight:700; text-transform:uppercase;">Dons à importer</div>
                    </div>
                </div>

                <!-- Aperçu donateurs -->
                <p style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Aperçu des donateurs :</p>
                <div style="max-height:160px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead style="background:var(--surface); position:sticky; top:0;">
                            <tr>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">NOM</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">PRÉNOM</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">EMAIL</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:var(--gold);">ENTITÉ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${valid.slice(0, 8).map(r => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:6px 8px; font-weight:700; color:var(--primary);">${r.last_name}</td>
                                    <td style="padding:6px 8px;">${r.first_name || '—'}</td>
                                    <td style="padding:6px 8px; color:#64748b; font-size:0.73rem;">${r.email || '—'}</td>
                                    <td style="padding:6px 8px;">
                                        <span style="background:rgba(197,160,89,0.12); color:var(--primary); padding:2px 7px; border-radius:6px; font-size:0.7rem; font-weight:600;">${r.entity}</span>
                                    </td>
                                </tr>`).join('')}
                            ${valid.length > 8 ? `<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8; font-style:italic; font-size:0.75rem;">... et ${valid.length - 8} autres</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>

                ${validDons.length > 0 ? `
                <!-- Aperçu dons -->
                <p style="font-size:0.75rem; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Aperçu des dons :</p>
                <div style="max-height:130px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:12px;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                        <thead style="background:var(--surface); position:sticky; top:0;">
                            <tr>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:#3b82f6;">DONATEUR</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:#3b82f6;">MONTANT</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:#3b82f6;">DATE</th>
                                <th style="padding:8px; text-align:left; border-bottom:1px solid #e2e8f0; color:#3b82f6;">CAMPAGNE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${validDons.slice(0, 6).map(d => `
                                <tr style="border-bottom:1px solid #f1f5f9;">
                                    <td style="padding:6px 8px; font-weight:600;">${d._donor_last_name}</td>
                                    <td style="padding:6px 8px; font-weight:700; color:#10b981;">${d.amount?.toLocaleString('fr-FR')} €</td>
                                    <td style="padding:6px 8px; color:#64748b;">${new Date(d.date).toLocaleDateString('fr-FR')}</td>
                                    <td style="padding:6px 8px; color:#64748b;">${d.campaign || '—'}</td>
                                </tr>`).join('')}
                            ${validDons.length > 6 ? `<tr><td colspan="4" style="padding:8px; text-align:center; color:#94a3b8; font-style:italic; font-size:0.75rem;">... et ${validDons.length - 6} autres dons</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
                ` : ''}
            `;

            if (valid.length > 0) {
                const btn = document.getElementById('btn-confirm-import');
                btn.style.display = 'block';
                btn.innerHTML = `<i data-lucide="upload-cloud" style="width:18px;height:18px;vertical-align:middle;margin-right:8px;"></i>IMPORTER ${valid.length} DONATEUR${valid.length > 1 ? 'S' : ''}${validDons.length > 0 ? ` + ${validDons.length} DON${validDons.length > 1 ? 'S' : ''}` : ''}`;
            }

            if (window.lucide) lucide.createIcons();

        } catch (err) {
            console.error('Erreur lecture Excel:', err);
            window.showNotice("Erreur de lecture", "Impossible de lire le fichier. Vérifiez le format (.xlsx).", "error");
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};

/**
 * EXÉCUTER L'IMPORT
 */
window.execImportDonors = async () => {
    const toInsert = (window._importPreviewData || []).filter(r => r._valid).map(({ _rowIndex, _valid, ...d }) => d);
    const donsToInsert = (window._importDonsData || []).filter(d => d._valid);

    if (!toInsert.length) {
        window.showNotice("Erreur", "Aucune donnée valide à importer.", "error");
        return;
    }

    const btn = document.getElementById('btn-confirm-import');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" style="width:16px;vertical-align:middle;margin-right:8px;animation:spin 1s linear infinite;"></i>Import en cours...'; if(window.lucide) lucide.createIcons(); }

    const BATCH_SIZE = 100;
    let insertedDonors = 0;
    let errorsDonors = 0;

    // Map pour retrouver les IDs des donateurs insérés (nom → id)
    const donorIdMap = {};

    // Insérer les donateurs par batch
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabaseClient.from('donors').insert(batch).select('id, last_name');
        if (error) {
            console.error('Erreur batch import donateurs:', error);
            errorsDonors += batch.length;
        } else {
            insertedDonors += batch.length;
            // Construire le mapping nom → id
            if (data) {
                data.forEach(d => {
                    donorIdMap[d.last_name.toUpperCase()] = d.id;
                });
            }
        }
    }

    // Insérer les dons en rattachant les donor_id
    let insertedDons = 0;
    let errorsDons = 0;

    if (donsToInsert.length > 0 && Object.keys(donorIdMap).length > 0) {
        const donsWithIds = donsToInsert
            .filter(d => donorIdMap[d._donor_last_name])
            .map(({ _donor_last_name, _valid, ...d }) => ({
                ...d,
                donor_id: donorIdMap[_donor_last_name]
            }));

        for (let i = 0; i < donsWithIds.length; i += BATCH_SIZE) {
            const batch = donsWithIds.slice(i, i + BATCH_SIZE);
            const { error } = await supabaseClient.from('donations').insert(batch);
            if (error) {
                console.error('Erreur batch import dons:', error);
                errorsDons += batch.length;
            } else {
                insertedDons += batch.length;
            }
        }
    }

    window._importPreviewData = [];
    window._importDonsData = [];
    closeCustomModal();

    // Message de résultat
    if (errorsDonors === 0 && errorsDons === 0) {
        const msg = insertedDons > 0
            ? `${insertedDonors} donateur${insertedDonors > 1 ? 's' : ''} et ${insertedDons} don${insertedDons > 1 ? 's' : ''} importés avec succès.`
            : `${insertedDonors} donateur${insertedDonors > 1 ? 's' : ''} importé${insertedDonors > 1 ? 's' : ''} avec succès.`;
        window.showNotice("Import réussi ✅", msg, "success");
    } else {
        window.showNotice("Import partiel ⚠️", `${insertedDonors} donateurs, ${insertedDons} dons importés. ${errorsDonors + errorsDons} erreur(s). Consultez la console.`, "warning");
    }

    window.loadDonors();
};

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
window.loadChatSubjects = async () => {
    const { data: subjects, error } = await supabaseClient.from('chat_subjects').select('*').order('name');
    if (error) return;

    const container = document.getElementById('chat-subjects-list');
    if (!container) return;

    const myName = `${currentUser.first_name} ${currentUser.last_name}`;
    
    const filtered = subjects.filter(s => {
        // BLOQUER TOUS LES CANAUX PRIVÉS (discussions 1-to-1 désactivées)
        if (s.entity === 'Privé') {
            return false;
        }
        
        // Si c'est Institut Alsatia, voir tout (sauf les privés)
        if (currentUser.portal === 'Institut Alsatia') return true;
        
        // Sinon, filtrer par entité
        return !s.entity || s.entity === currentUser.portal;
    });

    // PROTECTION : Si le canal actif n'est plus accessible (canal privé supprimé), rediriger vers Général
    const isCurrentSubjectAvailable = filtered.some(s => s.name === currentChatSubject);
    if (!isCurrentSubjectAvailable) {
        console.warn(`⚠️ Canal "${currentChatSubject}" inaccessible, redirection vers Général`);
        currentChatSubject = 'Général';
        const titleEl = document.getElementById('chat-current-title');
        if (titleEl) titleEl.innerText = '# Général';
    }

    container.innerHTML = filtered.map(s => {
        const isActive = currentChatSubject === s.name;
        return `
        <div class="chat-subject-item ${isActive ? 'active-chat-tab' : ''}" 
             onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}')">
            <div class="channel-indicator"></div>
            <div class="channel-name">
                <div class="channel-title"># ${s.name}</div>
                ${s.entity ? `<div class="channel-entity">${s.entity}</div>` : ''}
            </div>
            ${(currentUser.portal === 'Institut Alsatia' || s.entity === currentUser.portal) ? 
                `<i data-lucide="trash-2" 
                    onclick="event.stopPropagation(); window.deleteSubject('${s.id}', '${s.name}')"></i>` : ''}
        </div>
    `;
    }).join('');
    lucide.createIcons();
    
    // Mettre à jour le dropdown mobile
    const mobileMenu = document.getElementById('mobile-channel-menu');
    if (mobileMenu) {
        mobileMenu.innerHTML = filtered.map(s => {
            const isActive = currentChatSubject === s.name;
            return `
            <div class="mobile-channel-item ${isActive ? 'active' : ''}" 
                 onclick="window.switchChatSubject('${s.name.replace(/'/g, "\\'")}'); window.closeChannelDropdown();">
                <div class="mobile-channel-item-content">
                    <div class="mobile-channel-name"># ${s.name}</div>
                    ${s.entity ? `<div class="mobile-channel-entity">${s.entity}</div>` : ''}
                </div>
                ${isActive ? '<span class="mobile-channel-check">✓</span>' : ''}
            </div>
            `;
        }).join('');
    }
    
    // Mettre à jour le bouton du dropdown
    const mobileToggle = document.getElementById('mobile-current-channel');
    if (mobileToggle) {
        mobileToggle.innerText = `# ${currentChatSubject}`;
    }
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
// =====================================================
// ÉVÉNEMENTS - VERSION REFONTE COMPLÈTE
// =====================================================

/**
 * CHARGEMENT ET AFFICHAGE DES ÉVÉNEMENTS
 * Groupés par mois avec compte à rebours
 */
async function loadEvents() {
    const container = document.getElementById('events-container');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align:center; padding:40px;"><div class="spinner"></div><p>Chargement...</p></div>';
    
    const { data: events, error } = await supabaseClient
        .from('events_v2')
        .select('*')
        .order('event_date', { ascending: true });
    
    if (error) {
        container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Erreur de chargement</div>';
        return;
    }
    
    if (!events || events.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px;">
                <i data-lucide="calendar-x" style="width:64px; height:64px; color:var(--text-muted); margin-bottom:20px;"></i>
                <p style="color:var(--text-muted); font-size:1.1rem;">Aucun événement planifié</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    // Grouper les événements par mois
    const now = new Date();
    const groupedEvents = {
        upcoming: {},
        past: []
    };
    
    events.forEach(ev => {
        const eventDate = new Date(ev.event_date);
        const isPast = eventDate < now;
        
        if (isPast) {
            groupedEvents.past.push(ev);
        } else {
            const monthKey = eventDate.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' });
            if (!groupedEvents.upcoming[monthKey]) {
                groupedEvents.upcoming[monthKey] = [];
            }
            groupedEvents.upcoming[monthKey].push(ev);
        }
    });
    
    let html = '';
    
    // Événements à venir (groupés par mois)
    Object.keys(groupedEvents.upcoming).forEach(monthKey => {
        html += `
            <div class="month-separator">
                <i data-lucide="calendar" style="width:20px; height:20px;"></i>
                ${monthKey.toUpperCase()}
            </div>
        `;
        
        groupedEvents.upcoming[monthKey].forEach(ev => {
            html += renderEventCard(ev, false);
        });
    });
    
    // Événements passés
    if (groupedEvents.past.length > 0) {
        html += `
            <div class="month-separator" style="margin-top:40px;">
                <i data-lucide="archive" style="width:20px; height:20px;"></i>
                ÉVÉNEMENTS PASSÉS
            </div>
        `;
        
        groupedEvents.past.forEach(ev => {
            html += renderEventCard(ev, true);
        });
    }
    
    container.innerHTML = html;
    lucide.createIcons();
}

/**
 * RENDER UNE CARTE D'ÉVÉNEMENT
 */
function renderEventCard(ev, isPast) {
    const eventDate = new Date(ev.event_date);
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Texte compte à rebours
    let countdownText = '';
    if (isPast) {
        const daysSince = Math.abs(diffDays);
        countdownText = daysSince === 0 ? "Aujourd'hui" : `Il y a ${daysSince} jour${daysSince > 1 ? 's' : ''}`;
    } else {
        countdownText = diffDays === 0 ? "Aujourd'hui" : 
                       diffDays === 1 ? "Demain" : 
                       `Dans ${diffDays} jours`;
    }
    
    // Couleur du badge statut
    const statusColors = {
        'draft': { bg: '#fef3c7', color: '#92400e', icon: '⏳', text: 'EN PRÉPARATION' },
        'ready': { bg: '#d1fae5', color: '#065f46', icon: '✅', text: 'PRÊT' },
        'published': { bg: '#dbeafe', color: '#1e40af', icon: '📱', text: 'PUBLIÉ' }
    };
    
    const statusStyle = statusColors[ev.status] || statusColors.draft;
    
    // Couleur de la bordure
    const borderColor = isPast ? '#e5e7eb' : 
                       ev.status === 'ready' ? '#10b981' : 
                       ev.status === 'published' ? '#3b82f6' : '#f59e0b';
    
    return `
        <div class="event-card" onclick="window.openEventDetails('${ev.id}')" style="
            border-left: 4px solid ${borderColor};
            opacity: ${isPast ? '0.7' : '1'};
        ">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-main);">${escapeHTML(ev.title)}</h3>
                <span style="
                    background:${statusStyle.bg}; 
                    color:${statusStyle.color}; 
                    padding:4px 12px; 
                    border-radius:20px; 
                    font-size:0.75rem; 
                    font-weight:700;
                    white-space:nowrap;
                ">
                    ${statusStyle.icon} ${statusStyle.text}
                </span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:8px; color:var(--text-muted); font-size:0.9rem;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="calendar" style="width:16px; height:16px;"></i>
                    ${eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    <span style="color:${isPast ? '#ef4444' : '#10b981'}; font-weight:600;">• ${countdownText}</span>
                </div>
                
                ${ev.location ? `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <i data-lucide="map-pin" style="width:16px; height:16px;"></i>
                        ${escapeHTML(ev.location)}
                    </div>
                ` : ''}
                
                <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="building" style="width:16px; height:16px;"></i>
                    ${escapeHTML(ev.entity)}
                </div>
            </div>
        </div>
    `;
}

/**
 * MODAL : CRÉER UN NOUVEL ÉVÉNEMENT
 */
window.showAddEventModal = () => {
    const isInstitut = currentUser.portal === 'Institut Alsatia';
    
    showCustomModal(`
        <h3 class="luxe-title">PLANIFIER UN ÉVÉNEMENT</h3>
        
        <div style="display:flex; flex-direction:column; gap:15px; margin-top:20px;">
            <div>
                <label class="mini-label">TITRE DE L'ÉVÉNEMENT</label>
                <input type="text" id="new-event-title" class="luxe-input" placeholder="Gala de Charité 2026">
            </div>
            
            <div>
                <label class="mini-label">ENTITÉ CONCERNÉE</label>
                <select id="new-event-entity" class="luxe-input">
                    <option value="Institut Alsatia" ${!isInstitut ? 'disabled' : ''}>Institut Alsatia</option>
                    <option value="Academia Alsatia">Academia Alsatia</option>
                    <option value="Cours Herrade de Landsberg">Cours Herrade de Landsberg</option>
                    <option value="Collège Saints Louis et Zélie Martin">Collège Saints Louis et Zélie Martin</option>
                </select>
            </div>
            
            <div>
                <label class="mini-label">DATE PRÉVUE</label>
                <input type="date" id="new-event-date" class="luxe-input">
            </div>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="window.closeCustomModal()" class="btn-outline" style="flex:1;">Annuler</button>
                <button onclick="window.createEvent()" class="btn-gold" style="flex:1;">Créer</button>
            </div>
        </div>
    `);
};

/**
 * CRÉER UN ÉVÉNEMENT
 */
window.createEvent = async () => {
    const title = document.getElementById('new-event-title')?.value?.trim();
    const entity = document.getElementById('new-event-entity')?.value;
    const date = document.getElementById('new-event-date')?.value;
    
    if (!title || !entity || !date) {
        window.showNotice("Erreur", "Tous les champs sont requis.", "error");
        return;
    }
    
    const { data, error } = await supabaseClient
        .from('events_v2')
        .insert([{
            title: title,
            entity: entity,
            event_date: date,
            status: 'draft',
            created_by: `${currentUser.first_name} ${currentUser.last_name}`
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Erreur création:', error);
        window.showNotice("Erreur", "Impossible de créer l'événement.", "error");
        return;
    }
    
    window.showNotice("Créé !", "Événement créé avec succès.", "success");
    window.closeCustomModal();
    loadEvents();
    
    // Ouvrir directement la fiche
    setTimeout(() => window.openEventDetails(data.id), 300);
};

/**
 * OUVRIR LA FICHE DÉTAILLÉE D'UN ÉVÉNEMENT
 */
window.openEventDetails = async (eventId) => {
    // Charger l'événement
    const { data: ev, error } = await supabaseClient
        .from('events_v2')
        .select('*')
        .eq('id', eventId)
        .single();
    
    if (error || !ev) {
        window.showNotice("Erreur", "Événement introuvable.", "error");
        return;
    }
    
    // Charger les messages du chat
    const { data: messages } = await supabaseClient
        .from('event_messages')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
    
    const isReady = ev.status === 'ready' || ev.status === 'published';
    const statusBg = ev.status === 'ready' || ev.status === 'published' ? '#d1fae5' : '#fef3c7';
    const statusColor = ev.status === 'ready' || ev.status === 'published' ? '#065f46' : '#92400e';
    const statusText = ev.status === 'ready' || ev.status === 'published' ? '✅ PRÊT POUR PUBLICATION' : '⏳ EN PRÉPARATION';
    
    showCustomModal(`
        <div style="max-height:80vh; overflow-y:auto; padding:10px;">
            <!-- En-tête -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; position:sticky; top:0; background:white; padding-bottom:10px; z-index:10;">
                <h2 class="luxe-title" style="margin:0;">${escapeHTML(ev.title)}</h2>
                <button onclick="window.closeCustomModal()" style="border:none; background:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <!-- Badge statut -->
            <div style="background:${statusBg}; color:${statusColor}; padding:12px 20px; border-radius:12px; text-align:center; font-weight:700; margin-bottom:20px;">
                ${statusText}
            </div>
            
            <!-- Description -->
            <div class="luxe-section">
                <label class="mini-label">DESCRIPTION</label>
                <textarea id="ev-description" class="luxe-input" rows="4" placeholder="Décrivez l'événement...">${escapeHTML(ev.description || '')}</textarea>
            </div>
            
            <!-- Informations pratiques -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">📅 INFORMATIONS PRATIQUES</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div>
                        <label class="mini-label">DATE</label>
                        <input type="date" id="ev-date" class="luxe-input" value="${ev.event_date || ''}">
                    </div>
                    <div>
                        <label class="mini-label">HEURE</label>
                        <input type="time" id="ev-time" class="luxe-input" value="${ev.event_time || ''}">
                    </div>
                </div>
                <div style="margin-top:15px;">
                    <label class="mini-label">LIEU</label>
                    <input type="text" id="ev-location" class="luxe-input" placeholder="Salle des fêtes" value="${escapeHTML(ev.location || '')}">
                </div>
                <button onclick="window.saveEventInfos('${eventId}')" class="btn-gold" style="width:100%; margin-top:15px;">
                    <i data-lucide="save"></i> ENREGISTRER LES INFORMATIONS
                </button>
            </div>
            
            <!-- Photos -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">📸 PHOTOS</h4>
                <input type="file" id="photo-input-${eventId}" accept="image/*" multiple style="display:none;" onchange="window.uploadPhotos('${eventId}')">
                <button onclick="document.getElementById('photo-input-${eventId}').click()" class="btn-outline" style="width:100%; margin-bottom:15px;">
                    <i data-lucide="upload"></i> AJOUTER DES PHOTOS
                </button>
                <div id="photos-grid-${eventId}" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px;">
                    ${(ev.photos || []).map(url => `
                        <div style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; border:2px solid var(--border);">
                            <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                            <div style="position:absolute; top:5px; right:5px; display:flex; gap:4px;">
                                <button onclick="window.downloadSinglePhoto('${url}')" style="background:rgba(197,160,89,0.9); border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; color:white; display:flex; align-items:center; justify-content:center; font-size:16px;" title="Télécharger">⬇️</button>
                                <button onclick="window.deletePhoto('${eventId}', '${url}')" style="background:rgba(239,68,68,0.9); border:none; border-radius:50%; width:28px; height:28px; cursor:pointer; color:white; font-weight:bold;" title="Supprimer">×</button>
                            </div>
                        </div>
                    `).join('') || '<p style="text-align:center; color:var(--text-muted); padding:20px;">Aucune photo</p>'}
                </div>
            </div>
            
            <!-- Texte réseaux sociaux -->
            <div class="luxe-section" style="background:linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding:20px; border-radius:12px;">
                <h4 style="margin:0 0 15px 0; color:#92400e;">📱 TEXTE POUR LES RÉSEAUX SOCIAUX</h4>
                <textarea id="ev-social-text" class="luxe-input" rows="6" placeholder="Rédigez le post pour Instagram, Facebook, LinkedIn...">${escapeHTML(ev.social_media_text || '')}</textarea>
                <button onclick="window.saveSocialText('${eventId}')" class="btn-gold" style="width:100%; margin-top:10px;">
                    <i data-lucide="save"></i> ${ev.social_media_text ? 'METTRE À JOUR' : 'ENREGISTRER'} LE TEXTE
                </button>
                ${ev.social_media_text ? `<button onclick="window.deleteSocialText('${eventId}')" class="btn-outline" style="width:100%; margin-top:10px; color:#ef4444; border-color:#ef4444;">SUPPRIMER</button>` : ''}
            </div>
            
            <!-- Chat privé -->
            <div class="luxe-section">
                <h4 style="margin:0 0 15px 0; color:var(--gold);">💬 DISCUSSION INTERNE</h4>
                <div id="event-chat-${eventId}" style="background:white; border-radius:8px; padding:15px; max-height:300px; overflow-y:auto; margin-bottom:10px; border:2px solid var(--border);">
                    ${renderEventMessages(messages || [])}
                </div>
                <div style="display:flex; gap:10px;">
                    <input type="text" id="event-msg-input-${eventId}" class="luxe-input" placeholder="Écrire un message..." style="flex:1;" onkeypress="if(event.key==='Enter') window.sendEventMessage('${eventId}')">
                    <button onclick="window.sendEventMessage('${eventId}')" class="btn-gold">
                        <i data-lucide="send"></i>
                    </button>
                </div>
            </div>
            
            <!-- Actions si prêt -->
            ${isReady ? `
                <div class="luxe-section" style="background:#d1fae5; padding:20px; border-radius:12px;">
                    <h4 style="margin:0 0 15px 0; color:#065f46;">✅ ACTIONS DISPONIBLES</h4>
                    <div style="display:flex; gap:10px;">
                        <button onclick="window.downloadAllPhotos('${eventId}')" class="btn-gold" style="flex:1;">
                            <i data-lucide="download"></i> TÉLÉCHARGER LES PHOTOS
                        </button>
                        <button onclick="window.copySocialText('${eventId}')" class="btn-gold" style="flex:1;">
                            <i data-lucide="copy"></i> COPIER LE TEXTE
                        </button>
                    </div>
                </div>
            ` : ''}
            
            <!-- Bouton statut -->
            <button onclick="window.toggleEventStatus('${eventId}', '${ev.status}')" class="btn-gold" style="width:100%; margin-top:15px; ${isReady ? 'background:#f59e0b;' : ''}">
                ${isReady ? '⏳ REPASSER EN PRÉPARATION' : '✅ MARQUER COMME PRÊT'}
            </button>
            
            <!-- Bouton supprimer -->
            <button onclick="window.deleteEvent('${eventId}')" class="btn-outline" style="width:100%; margin-top:10px; color:#ef4444; border-color:#ef4444;">
                <i data-lucide="trash-2"></i> SUPPRIMER L'ÉVÉNEMENT
            </button>
        </div>
    `);
    
    lucide.createIcons();
    
    // Scroll vers le bas du chat
    const chatContainer = document.getElementById(`event-chat-${eventId}`);
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // S'abonner au realtime pour les messages
    window.subscribeToEventChat(eventId);
};

/**
 * RENDER MESSAGES DU CHAT
 */
function renderEventMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<p style="text-align:center; color:var(--text-muted); padding:20px;">Aucun message</p>';
    }
    
    return messages.map(m => `
        <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <strong style="color:var(--gold);">${escapeHTML(m.author_name)}</strong>
                <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(m.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <p style="margin:0; color:var(--text-main);">${escapeHTML(m.message)}</p>
        </div>
    `).join('');
}

/**
 * SAUVEGARDER LES INFORMATIONS
 */
window.saveEventInfos = async (eventId) => {
    const description = document.getElementById('ev-description')?.value?.trim() || null;
    const date = document.getElementById('ev-date')?.value || null;
    const time = document.getElementById('ev-time')?.value || null;
    const location = document.getElementById('ev-location')?.value?.trim() || null;
    
    console.log('💾 Sauvegarde:', { eventId, description, date, time, location });
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({
            description,
            event_date: date,
            event_time: time,
            location
        })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur:', error);
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
        return;
    }
    
    console.log('✅ Sauvegardé');
    window.showNotice("Enregistré !", "Informations mises à jour.", "success");
    loadEvents();
};

/**
 * UPLOADER DES PHOTOS
 */
window.uploadPhotos = async (eventId) => {
    const input = document.getElementById(`photo-input-${eventId}`);
    const files = input.files;
    
    if (!files || files.length === 0) return;
    
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    let uploaded = 0;
    let failed = 0;

    // Indicateur de chargement
    const uploadBtn = input.closest('div')?.querySelector('.btn-outline') || document.querySelector(`[onclick*="uploadPhotos('${eventId}')"]`);
    const originalBtnHTML = uploadBtn ? uploadBtn.innerHTML : null;
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `
            <span style="display:inline-flex;align-items:center;gap:8px;">
                <span style="width:16px;height:16px;border:2px solid rgba(197,160,89,0.3);border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block;"></span>
                Chargement en cours...
            </span>`;
    }

    // Toast de progression
    window.showNotice('Upload', `Envoi de ${files.length} photo(s)...`, 'info');
    
    for (const file of files) {
        if (file.size > MAX_SIZE) {
            console.warn('Fichier trop lourd:', file.name);
            failed++;
            continue;
        }
        
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `${eventId}/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
            .from('event-files')
            .upload(filePath, file);
        
        if (error) {
            console.error('Erreur upload:', error);
            failed++;
            continue;
        }
        
        // Récupérer l'URL publique
        const { data: urlData } = supabaseClient.storage
            .from('event-files')
            .getPublicUrl(filePath);
        
        // Ajouter l'URL au tableau photos
        const { data: ev } = await supabaseClient
            .from('events_v2')
            .select('photos')
            .eq('id', eventId)
            .single();
        
        const photos = ev.photos || [];
        photos.push(urlData.publicUrl);
        
        await supabaseClient
            .from('events_v2')
            .update({ photos })
            .eq('id', eventId);
        
        uploaded++;
    }
    
    // Restaurer le bouton
    if (uploadBtn && originalBtnHTML) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = originalBtnHTML;
    }
    // Réinitialiser l'input fichier
    input.value = '';

    if (uploaded > 0) {
        window.showNotice("Uploadé !", `${uploaded} photo(s) ajoutée(s).`, "success");
        window.openEventDetails(eventId); // Recharger la fiche
    }
    
    if (failed > 0) {
        window.showNotice("Attention", `${failed} fichier(s) non uploadé(s).`, "error");
    }
};

/**
 * SUPPRIMER UNE PHOTO
 */
/**
 * TÉLÉCHARGER UNE PHOTO
 */
window.downloadSinglePhoto = async (photoUrl) => {
    try {
        // Récupérer l'image
        const response = await fetch(photoUrl);
        const blob = await response.blob();
        
        // Extraire le nom du fichier depuis l'URL
        const urlParts = photoUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        window.showNotice("Téléchargée", "Photo téléchargée avec succès.", "success");
    } catch (error) {
        console.error('Erreur téléchargement:', error);
        window.showNotice("Erreur", "Impossible de télécharger la photo.", "error");
    }
};

window.deletePhoto = async (eventId, photoUrl) => {
    window.alsatiaConfirm(
        "SUPPRIMER LA PHOTO",
        "Voulez-vous vraiment supprimer cette photo ?",
        async () => {
            // Récupérer le chemin du fichier depuis l'URL
            const urlParts = photoUrl.split('/');
            const fileName = urlParts[urlParts.length - 1];
            const filePath = `${eventId}/${fileName}`;
            
            // Supprimer du storage
            await supabaseClient.storage
                .from('event-files')
                .remove([filePath]);
            
            // Retirer l'URL du tableau
            const { data: ev } = await supabaseClient
                .from('events_v2')
                .select('photos')
                .eq('id', eventId)
                .single();
            
            const photos = (ev.photos || []).filter(url => url !== photoUrl);
            
            await supabaseClient
                .from('events_v2')
                .update({ photos })
                .eq('id', eventId);
            
            window.showNotice("Supprimée", "Photo supprimée.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

/**
 * SAUVEGARDER TEXTE RÉSEAUX SOCIAUX
 */
window.saveSocialText = async (eventId) => {
    const text = document.getElementById('ev-social-text')?.value?.trim() || null;
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({ social_media_text: text })
        .eq('id', eventId);
    
    if (error) {
        window.showNotice("Erreur", "Impossible de sauvegarder.", "error");
        return;
    }
    
    window.showNotice("Enregistré !", "Texte sauvegardé.", "success");
    window.openEventDetails(eventId);
};

/**
 * SUPPRIMER TEXTE RÉSEAUX SOCIAUX
 */
window.deleteSocialText = async (eventId) => {
    window.alsatiaConfirm(
        "SUPPRIMER LE TEXTE",
        "Voulez-vous vraiment supprimer le texte ?",
        async () => {
            await supabaseClient
                .from('events_v2')
                .update({ social_media_text: null })
                .eq('id', eventId);
            
            window.showNotice("Supprimé", "Texte supprimé.", "success");
            window.openEventDetails(eventId);
        },
        true
    );
};

/**
 * ENVOYER UN MESSAGE DANS LE CHAT
 */
window.sendEventMessage = async (eventId) => {
    const input = document.getElementById(`event-msg-input-${eventId}`);
    const message = input?.value?.trim();
    
    if (!message) return;
    
    const { data, error } = await supabaseClient
        .from('event_messages')
        .insert([{
            event_id: eventId,
            author_id: currentUser.id,
            author_name: `${currentUser.first_name} ${currentUser.last_name}`,
            message: message
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Erreur message:', error);
        window.showNotice("Erreur", "Message non envoyé.", "error");
        return;
    }
    
    input.value = '';
    
    // Afficher le message immédiatement
    const container = document.getElementById(`event-chat-${eventId}`);
    if (container) {
        const messageHTML = `
            <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:var(--gold);">${escapeHTML(data.author_name)}</strong>
                    <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(data.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <p style="margin:0; color:var(--text-main);">${escapeHTML(data.message)}</p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', messageHTML);
        container.scrollTop = container.scrollHeight;
    }
};

/**
 * S'ABONNER AU REALTIME POUR LE CHAT
 */
window.subscribeToEventChat = (eventId) => {
    // Désabonner l'ancien channel proprement
    if (window.eventChatChannel) {
        try {
            supabaseClient.removeChannel(window.eventChatChannel);
        } catch (e) {
            console.log('Erreur désabonnement:', e);
        }
        window.eventChatChannel = null;
    }
    
    // Créer le nouveau channel avec gestion d'erreur
    const channel = supabaseClient
        .channel(`event-chat-${eventId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: '' }
            }
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            filter: `event_id=eq.${eventId}`
        }, async (payload) => {
            console.log('Nouveau message Realtime:', payload.new);
            
            // Si c'est mon propre message, ne rien faire (déjà affiché immédiatement)
            const isMyMessage = payload.new.author_id === currentUser.id;
            if (isMyMessage) {
                console.log('Mon propre message, ignoré (déjà affiché)');
                return;
            }
            
            // Sinon, afficher le message reçu
            const container = document.getElementById(`event-chat-${eventId}`);
            if (container) {
                const messageHTML = `
                    <div style="margin-bottom:15px; padding:10px; background:var(--bg); border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong style="color:var(--gold);">${escapeHTML(payload.new.author_name)}</strong>
                            <span style="color:var(--text-muted); font-size:0.85rem;">${new Date(payload.new.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</span>
                        </div>
                        <p style="margin:0; color:var(--text-main);">${escapeHTML(payload.new.message)}</p>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', messageHTML);
                container.scrollTop = container.scrollHeight;
            }
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('✅ Chat Realtime connecté');
            }
            if (status === 'CHANNEL_ERROR') {
                console.error('❌ Erreur channel Realtime:', err);
                // Ne pas réessayer automatiquement pour éviter la boucle
                if (window.eventChatChannel) {
                    supabaseClient.removeChannel(window.eventChatChannel);
                    window.eventChatChannel = null;
                }
            }
            if (status === 'TIMED_OUT') {
                console.warn('⏱️ Timeout Realtime');
            }
            if (status === 'CLOSED') {
                console.log('🔌 Channel fermé');
            }
        });
    
    window.eventChatChannel = channel;
};

/**
 * CHANGER LE STATUT
 */
window.toggleEventStatus = async (eventId, currentStatus) => {
    const newStatus = (currentStatus === 'ready' || currentStatus === 'published') ? 'draft' : 'ready';
    
    console.log('🔄 Toggle statut:', { eventId, currentStatus, newStatus });
    
    const { error } = await supabaseClient
        .from('events_v2')
        .update({ status: newStatus })
        .eq('id', eventId);
    
    if (error) {
        console.error('❌ Erreur:', error);
        window.showNotice("Erreur", "Impossible de changer le statut.", "error");
        return;
    }
    
    console.log('✅ Statut:', newStatus);
    window.showNotice("Modifié", `Événement ${newStatus === 'ready' ? 'prêt' : 'en préparation'}.`, "success");
    loadEvents();
    window.openEventDetails(eventId);
};

/**
 * TÉLÉCHARGER TOUTES LES PHOTOS
 */
window.downloadAllPhotos = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('photos')
        .eq('id', eventId)
        .single();
    
    if (!ev || !ev.photos || ev.photos.length === 0) {
        window.showNotice("Aucune photo", "Pas de photos à télécharger.", "info");
        return;
    }
    
    ev.photos.forEach((url, index) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `photo_${index + 1}.jpg`;
            a.click();
        }, index * 500);
    });
    
    window.showNotice("Téléchargement", `${ev.photos.length} photo(s) en cours...`, "success");
};

/**
 * COPIER LE TEXTE DANS LE PRESSE-PAPIER
 */
window.copySocialText = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('social_media_text')
        .eq('id', eventId)
        .single();
    
    if (!ev || !ev.social_media_text) {
        window.showNotice("Aucun texte", "Pas de texte à copier.", "info");
        return;
    }
    
    navigator.clipboard.writeText(ev.social_media_text);
    window.showNotice("Copié !", "Texte copié dans le presse-papier.", "success");
};

/**
 * SUPPRIMER UN ÉVÉNEMENT
 */
window.deleteEvent = async (eventId) => {
    const { data: ev } = await supabaseClient
        .from('events_v2')
        .select('title, photos')
        .eq('id', eventId)
        .single();
    
    if (!ev) return;
    
    window.alsatiaConfirm(
        "SUPPRIMER L'ÉVÉNEMENT",
        `Voulez-vous vraiment supprimer "${ev.title}" ?\nLes photos et messages seront également supprimés.`,
        async () => {
            // Supprimer les photos du storage
            if (ev.photos && ev.photos.length > 0) {
                const filePaths = ev.photos.map(url => {
                    const parts = url.split('/');
                    const fileName = parts[parts.length - 1];
                    return `${eventId}/${fileName}`;
                });
                
                await supabaseClient.storage
                    .from('event-files')
                    .remove(filePaths);
            }
            
            // Supprimer l'événement (cascade supprime les messages)
            const { error } = await supabaseClient
                .from('events_v2')
                .delete()
                .eq('id', eventId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer.", "error");
                return;
            }
            
            window.showNotice("Supprimé", "Événement supprimé.", "success");
            window.closeCustomModal();
            loadEvents();
        },
        true
    );
};


// =====================================================
// RESPONSIVE MOBILE - MENU BURGER
// =====================================================

window.toggleMobileMenu = () => {
    const nav = document.querySelector(".side-nav");
    const overlay = document.getElementById("mobile-overlay");
    const isOpen = nav.classList.contains("mobile-open");
    
    if (isOpen) {
        nav.classList.remove("mobile-open");
        overlay.classList.remove("active");
    } else {
        nav.classList.add("mobile-open");
        overlay.classList.add("active");
    }
};

window.closeMobileMenu = () => {
    document.querySelector(".side-nav").classList.remove("mobile-open");
    document.getElementById("mobile-overlay").classList.remove("active");
};

// Fermer le menu mobile lors du changement d'onglet
const originalSwitchTab = window.switchTab;
window.switchTab = (tabId) => {
    if (window.innerWidth <= 768) {
        window.closeMobileMenu();
    }
    originalSwitchTab(tabId);
};

// =====================================================
// DROPDOWN CANAUX MOBILE
// =====================================================

window.toggleChannelDropdown = () => {
    const menu = document.getElementById('mobile-channel-menu');
    const chevron = document.getElementById('mobile-chevron');
    const isOpen = menu.style.display === 'block';
    
    if (isOpen) {
        menu.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
        document.removeEventListener('click', window.handleClickOutsideDropdown);
    } else {
        menu.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
        
        // Fermer au click extérieur (après un petit délai pour éviter fermeture immédiate)
        setTimeout(() => {
            document.addEventListener('click', window.handleClickOutsideDropdown);
        }, 100);
    }
};

window.handleClickOutsideDropdown = (e) => {
    const menu = document.getElementById('mobile-channel-menu');
    const toggle = document.getElementById('mobile-channel-toggle');
    
    // Si on clique en dehors du menu ET du bouton toggle
    if (menu && !menu.contains(e.target) && !toggle.contains(e.target)) {
        window.closeChannelDropdown();
    }
};

window.closeChannelDropdown = () => {
    const menu = document.getElementById('mobile-channel-menu');
    const chevron = document.getElementById('mobile-chevron');
    
    if (menu) menu.style.display = 'none';
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    document.removeEventListener('click', window.handleClickOutsideDropdown);
};

// Toggle chat sidebar mobile (ancien système)
window.toggleChatSidebar = () => {
    const sidebar = document.querySelector(".chat-sidebar");
    sidebar.classList.toggle("mobile-open");
};

// Ajouter click sur header chat pour ouvrir sidebar mobile
document.addEventListener("DOMContentLoaded", () => {
    const chatHeader = document.querySelector(".chat-header");
    if (chatHeader && window.innerWidth <= 768) {
        chatHeader.style.cursor = "pointer";
        chatHeader.addEventListener("click", window.toggleChatSidebar);
    }
});


// =====================================================
// GESTION DES COMPTES (Institut Alsatia uniquement)
// =====================================================

window.approveUser = async (userId) => {
    window.alsatiaConfirm(
        "APPROUVER LE COMPTE",
        "Voulez-vous approuver ce compte ? L'utilisateur pourra se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'approved' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible d'approuver le compte.", "error");
                return;
            }
            
            window.showNotice("Approuvé", "Le compte a été approuvé avec succès.", "success");
            loadContacts();
        }
    );
};

window.rejectUser = async (userId) => {
    window.alsatiaConfirm(
        "REFUSER L'INSCRIPTION",
        "Voulez-vous refuser cette inscription ? L'utilisateur ne pourra pas se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'rejected' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de refuser le compte.", "error");
                return;
            }
            
            window.showNotice("Refusé", "L'inscription a été refusée.", "success");
            loadContacts();
        },
        true
    );
};

window.revokeUser = async (userId) => {
    window.alsatiaConfirm(
        "RÉVOQUER L'ACCÈS",
        "Voulez-vous révoquer l'accès de cet utilisateur ? Il ne pourra plus se connecter.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'revoked' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de révoquer l'accès.", "error");
                return;
            }
            
            window.showNotice("Révoqué", "L'accès a été révoqué.", "success");
            loadContacts();
        },
        true
    );
};

window.deleteUser = async (userId, userName) => {
    window.alsatiaConfirm(
        "⚠️ SUPPRESSION DÉFINITIVE",
        `Vous allez supprimer définitivement le compte de ${userName}. Cette action est IRRÉVERSIBLE. Tous ses messages privés seront aussi supprimés.`,
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .delete()
                .eq('id', userId);

            if (error) {
                window.showNotice("Erreur", "Impossible de supprimer ce compte.", "error");
                return;
            }

            window.showNotice("Supprimé", `Le compte de ${userName} a été supprimé définitivement.`, "success");
            loadContacts();
        },
        true
    );
};

window.reactivateUser = async (userId) => {
    window.alsatiaConfirm(
        "RÉACTIVER LE COMPTE",
        "Voulez-vous réactiver ce compte ? L'utilisateur pourra se connecter à nouveau.",
        async () => {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ status: 'approved' })
                .eq('id', userId);
            
            if (error) {
                window.showNotice("Erreur", "Impossible de réactiver le compte.", "error");
                return;
            }
            
            window.showNotice("Réactivé", "Le compte a été réactivé.", "success");
            loadContacts();
        }
    );
};

// =====================================================
// GESTION DES PERMISSIONS D'ACCÈS
// =====================================================

window.toggleAccess = async (userId, accessField, isChecked) => {
    try {
        console.log(`🔐 Modification ${accessField} pour ${userId} → ${isChecked}`);
        
        const { error } = await supabaseClient
            .from('profiles')
            .update({ [accessField]: isChecked })
            .eq('id', userId);
        
        if (error) throw error;
        
        const accessName = {
            'access_donors': 'Base Donateurs',
            'access_events': 'Événements'
        }[accessField];
        
        window.showNotice(
            "Accès modifié",
            `${accessName} ${isChecked ? 'activé' : 'désactivé'}`,
            "success"
        );
        
    } catch (error) {
        console.error('❌ Erreur toggleAccess:', error);
        window.showNotice("Erreur", "Impossible de modifier l'accès.", "error");
        loadContacts(); // Recharger pour remettre l'état correct
    }
};

function applyAccessPermissions() {
    if (!currentUser) return;
    
    // Institut Alsatia a accès à tout, rien à cacher
    if (currentUser.portal === 'Institut Alsatia') return;
    
    console.log('🔐 Application des permissions pour:', currentUser.portal);
    
    // Cacher Base Donateurs si pas accès
    if (!currentUser.access_donors) {
        const donorsNav = document.getElementById('nav-donors');
        if (donorsNav) {
            donorsNav.style.display = 'none';
            console.log('❌ Base Donateurs masquée');
        }
    }
    
    // Cacher Événements si pas accès
    if (!currentUser.access_events) {
        const eventsNav = document.getElementById('nav-events');
        if (eventsNav) {
            eventsNav.style.display = 'none';
            console.log('❌ Événements masqués');
        }
    }
}

// Appliquer les permissions au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    applyAccessPermissions();
    lucide.createIcons();
});
