// =====================================================
// DM (CHAT PRIVÉ) - MODULE AUTONOME (sans toucher app.js)
// - Accessible uniquement via Contacts
// - Modale pro (pas de fenêtre native)
// - Sans pièces jointes
// - Edition / suppression (soft delete) côté auteur
// - Realtime Supabase + fallback polling si realtime KO
// =====================================================

console.log('💬 DM.JS CHARGÉ');

(function () {
  // ------------------------------
  // Helpers sûrs
  // ------------------------------
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const p = document.createElement('p');
    p.textContent = String(str);
    return p.innerHTML;
  }

  function getCurrentUser() {
    const s = localStorage.getItem('alsatia_user');
    if (!s) return null;
    try { return JSON.parse(s); } catch { return null; }
  }

  function getSupabaseClient() {
    // app.js déclare `const supabaseClient = ...`
    if (typeof supabaseClient !== 'undefined') return supabaseClient;
    if (typeof window.supabaseClient !== 'undefined') return window.supabaseClient;
    return null;
  }

  function makeConversationKey(a, b) {
    const arr = [String(a), String(b)].sort();
    return `${arr[0]}:${arr[1]}`;
  }

  function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function isNearBottom(el) {
    if (!el) return true;
    return (el.scrollHeight - el.scrollTop - el.clientHeight) < 220;
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit'
      });
    } catch {
      return '';
    }
  }

  // ------------------------------
  // Etat DM
  // ------------------------------
  let dmChannel = null;
  let dmActivePeer = null; // { id, name }
  let dmConversationKey = null;
  let dmMessagesMap = new Map(); // id -> message row

  // Fallback polling
  let dmPollTimer = null;
  let dmPollInFlight = false;

  // ------------------------------
  // Cleanup : unsubscribe realtime + stop polling
  // ------------------------------
  function stopPolling() {
    if (dmPollTimer) {
      clearInterval(dmPollTimer);
      dmPollTimer = null;
    }
  }

  function unsubscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb) return;

    stopPolling();

    if (dmChannel) {
      try { sb.removeChannel(dmChannel); } catch (e) {}
      dmChannel = null;
    }
  }

  // Wrap closeCustomModal pour nettoyer
  (function wrapCloseCustomModal() {
    if (typeof window.closeCustomModal !== 'function') return;
    const originalClose = window.closeCustomModal;
    if (originalClose.__dm_wrapped) return;

    function wrappedCloseCustomModal() {
      unsubscribeConversation();
      return originalClose();
    }
    wrappedCloseCustomModal.__dm_wrapped = true;
    window.closeCustomModal = wrappedCloseCustomModal;
  })();

  // ------------------------------
  // UI : ouvrir la modale DM
  // ------------------------------
  function openDMModal(peer) {
    const me = getCurrentUser();
    if (!me) {
      if (window.showNotice) window.showNotice('Erreur', 'Utilisateur non connecté.', 'error');
      return;
    }

    dmActivePeer = peer;
    dmConversationKey = makeConversationKey(me.id, peer.id);
    dmMessagesMap = new Map();

    const titleName = escapeHTML(peer.name);

    const modalBody = document.getElementById('modal-body');
    const modal = document.getElementById('custom-modal');
    if (!modalBody || !modal) {
      console.error('DM: modal introuvable (#custom-modal / #modal-body)');
      return;
    }

    modalBody.innerHTML = `
      <div class="dm-header">
        <div>
          <h3 class="dm-title">
            <i data-lucide="message-circle" style="width:20px; height:20px; color:var(--gold);"></i>
            Conversation privée
          </h3>
          <p class="dm-subtitle">Avec <strong>${titleName}</strong></p>
        </div>
        <button class="dm-close-btn" onclick="window.closeCustomModal()" aria-label="Fermer">&times;</button>
      </div>

      <div class="dm-chat-shell">
        <div id="dm-messages" class="dm-messages">
          <div class="dm-empty">Chargement...</div>
        </div>

        <div class="dm-input-bar">
          <textarea id="dm-input" class="dm-input" placeholder="Écrire un message..." rows="1"></textarea>
          <button id="dm-send" class="dm-send-btn" title="Envoyer">
            <i data-lucide="send" style="width:18px; height:18px;"></i>
          </button>
        </div>
      </div>
    `;

    // Afficher modale
    modal.style.display = 'flex';
    setTimeout(() => { modal.style.opacity = '1'; }, 10);

    if (window.lucide) lucide.createIcons();

    // Bind events
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendCurrentMessage();
        }
      });

      // auto-grow
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendCurrentMessage);

    // Load + subscribe
    loadConversation()
      .then(() => subscribeConversation())
      .catch(() => {});
  }

  // ------------------------------
  // Data : load messages
  // ------------------------------
  async function loadConversation() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const peer = dmActivePeer;

    if (!sb || !me || !peer) return;

    const box = document.getElementById('dm-messages');
    if (box && dmMessagesMap.size === 0) box.innerHTML = `<div class="dm-empty">Chargement...</div>`;

    const { data, error } = await sb
      .from('dm_messages')
      .select('*')
      .eq('conversation_key', dmConversationKey)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('DM load error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible de charger la conversation.', 'error');
      if (box) box.innerHTML = `<div class="dm-empty">Impossible de charger la conversation.</div>`;
      return;
    }

    const prevCount = dmMessagesMap.size;

    dmMessagesMap = new Map();
    (data || []).forEach((m) => dmMessagesMap.set(m.id, m));

    const container = document.getElementById('dm-messages');
    const keepBottom = container ? isNearBottom(container) : true;

    renderConversation({ keepScrollIfNearBottom: keepBottom });

    if (container && (prevCount === 0 || keepBottom)) {
      scrollToBottom(container);
    }
  }

  // ------------------------------
  // Fallback polling (si realtime KO)
  // ------------------------------
  function startPolling() {
    if (dmPollTimer) return;

    console.warn('🟠 DM realtime KO → fallback polling activé (2s)');
    dmPollTimer = setInterval(async () => {
      if (dmPollInFlight) return;
      dmPollInFlight = true;
      try {
        await loadConversation();
      } catch (e) {
        // silence
      } finally {
        dmPollInFlight = false;
      }
    }, 2000);
  }

  // ------------------------------
  // Data : subscribe realtime
  // - On s'abonne sans filtre serveur pour éliminer les bugs de filter
  // - On filtre côté client sur conversation_key
  // ------------------------------
  function subscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb || !dmConversationKey) return;

    unsubscribeConversation();

    console.log('🔌 DM subscribe: ouverture canal realtime…');

    dmChannel = sb
      .channel('dm-channel') // nom stable (évite les caractères spéciaux)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dm_messages'
      }, (payload) => {
        // Filtrage côté client
        const row = payload.new || payload.old;
        if (!row || row.conversation_key !== dmConversationKey) return;

        if (payload.eventType === 'INSERT') {
          dmMessagesMap.set(payload.new.id, payload.new);
          renderConversation({ keepScrollIfNearBottom: true });
        } else if (payload.eventType === 'UPDATE') {
          dmMessagesMap.set(payload.new.id, payload.new);
          renderConversation({ keepScrollIfNearBottom: true });
        } else if (payload.eventType === 'DELETE') {
          dmMessagesMap.delete(payload.old.id);
          renderConversation({ keepScrollIfNearBottom: true });
        }
      })
      .subscribe((status) => {
        console.log('🔌 DM realtime status:', status);

        // Si realtime ne s’abonne pas correctement, on active le polling
        // (SUBSCRIBED attendu)
        if (status === 'SUBSCRIBED') {
          stopPolling();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling();
        }
      });

    // “watchdog” : si pas SUBSCRIBED rapidement, polling
    setTimeout(() => {
      // si dmChannel existe toujours et que polling pas lancé, on le lance
      // (ça protège les cas où le callback status n’arrive pas)
      if (!dmPollTimer) startPolling();
    }, 3500);
  }

  // ------------------------------
  // Render
  // ------------------------------
  function renderConversation(opts = {}) {
    const me = getCurrentUser();
    const peer = dmActivePeer;
    const container = document.getElementById('dm-messages');

    if (!me || !peer || !container) return;

    const wasNearBottom = isNearBottom(container);

    const messages = Array.from(dmMessagesMap.values()).sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return ta - tb;
    });

    if (messages.length === 0) {
      container.innerHTML = `<div class="dm-empty">Aucun message. Dites bonjour 👋</div>`;
      return;
    }

    container.innerHTML = messages.map((m) => renderMessageRow(m, me)).join('');

    if (window.lucide) lucide.createIcons();

    if (opts.keepScrollIfNearBottom && wasNearBottom) {
      scrollToBottom(container);
    }
  }

  function renderMessageRow(m, me) {
    const isMe = m.sender_profile_id === me.id;
    const rowClass = isMe ? 'me' : 'them';

    const isDeleted = !!m.is_deleted;
    const content = isDeleted ? '<em style="opacity:0.65;">Message supprimé</em>' : escapeHTML(m.content);

    const edited = (m.updated_at && m.created_at && (new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) > 1500);
    const editedBadge = (!isDeleted && edited) ? `<span class="dm-edited">modifié</span>` : '';

    const actions = (isMe && !isDeleted) ? `
      <div class="dm-actions">
        <button class="dm-icon-btn" title="Modifier" onclick="window.dmStartEdit('${m.id}')">
          <i data-lucide="pencil" style="width:14px; height:14px;"></i>
        </button>
        <button class="dm-icon-btn danger" title="Supprimer" onclick="window.dmDeleteMessage('${m.id}')">
          <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
        </button>
      </div>
    ` : '';

    return `
      <div class="dm-bubble-row ${rowClass}" id="dm-row-${m.id}">
        <div class="dm-bubble ${rowClass}">
          <div class="dm-text" id="dm-text-${m.id}">${content}</div>
          <div class="dm-meta">
            <span>${formatTime(m.created_at)} ${editedBadge}</span>
            ${actions}
          </div>
        </div>
      </div>
    `;
  }

  // ------------------------------
  // Actions : send
  // ------------------------------
  async function sendCurrentMessage() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const peer = dmActivePeer;

    const input = document.getElementById('dm-input');
    if (!sb || !me || !peer || !input) return;

    const text = (input.value || '').trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    const payload = {
      sender_profile_id: me.id,
      receiver_profile_id: peer.id,
      conversation_key: dmConversationKey,
      content: text,
      is_deleted: false
    };

    const { error } = await sb
      .from('dm_messages')
      .insert([payload]);

    if (error) {
      console.error('DM send error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible d’envoyer.', 'error');
    }
  }

  // ------------------------------
  // Actions : edit
  // ------------------------------
  window.dmStartEdit = function (messageId) {
    const me = getCurrentUser();
    if (!me) return;

    const m = dmMessagesMap.get(messageId);
    if (!m || m.sender_profile_id !== me.id || m.is_deleted) return;

    const textDiv = document.getElementById('dm-text-' + messageId);
    if (!textDiv) return;

    const original = m.content || '';

    textDiv.innerHTML = `
      <textarea class="dm-edit-area" id="dm-edit-${messageId}">${escapeHTML(original)}</textarea>
      <div class="dm-edit-actions">
        <button class="dm-mini-btn cancel" onclick="window.dmCancelEdit('${messageId}')">Annuler</button>
        <button class="dm-mini-btn save" onclick="window.dmSaveEdit('${messageId}')">Enregistrer</button>
      </div>
    `;

    if (window.lucide) lucide.createIcons();

    const ta = document.getElementById('dm-edit-' + messageId);
    if (ta) {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  };

  window.dmCancelEdit = function (messageId) {
    const m = dmMessagesMap.get(messageId);
    const me = getCurrentUser();
    if (!m || !me) return;

    const textDiv = document.getElementById('dm-text-' + messageId);
    if (!textDiv) return;

    textDiv.innerHTML = escapeHTML(m.content || '');
  };

  window.dmSaveEdit = async function (messageId) {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const m = dmMessagesMap.get(messageId);

    if (!sb || !me || !m || m.sender_profile_id !== me.id || m.is_deleted) return;

    const ta = document.getElementById('dm-edit-' + messageId);
    if (!ta) return;

    const newText = (ta.value || '').trim();
    if (!newText) {
      if (window.showNotice) window.showNotice('DM', 'Le message ne peut pas être vide.', 'warning');
      return;
    }

    const { error } = await sb
      .from('dm_messages')
      .update({ content: newText })
      .eq('id', messageId);

    if (error) {
      console.error('DM edit error:', error);
      if (window.showNotice) window.showNotice('DM', 'Impossible de modifier.', 'error');
    }
  };

  // ------------------------------
  // Actions : delete (soft)
  // ------------------------------
  window.dmDeleteMessage = function (messageId) {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    const m = dmMessagesMap.get(messageId);

    if (!sb || !me || !m || m.sender_profile_id !== me.id || m.is_deleted) return;

    if (typeof window.alsatiaConfirm === 'function') {
      window.alsatiaConfirm(
        'SUPPRIMER LE MESSAGE',
        'Voulez-vous vraiment supprimer ce message ?',
        async () => {
          const { error } = await sb
            .from('dm_messages')
            .update({ is_deleted: true, content: '' })
            .eq('id', messageId);

          if (error) {
            console.error('DM delete error:', error);
            if (window.showNotice) window.showNotice('DM', 'Impossible de supprimer.', 'error');
          }
        },
        true
      );
    } else {
      console.error('DM: alsatiaConfirm indisponible, suppression refusée.');
      if (window.showNotice) window.showNotice('DM', 'Suppression indisponible.', 'error');
    }
  };

  // ------------------------------
  // Integration : bouton "Message privé" dans Contacts
  // Sans modifier app.js : on wrap window.renderContacts(users)
  // ------------------------------
  function injectDMButtons(users) {
    const me = getCurrentUser();
    const grid = document.getElementById('contacts-grid');
    if (!grid || !Array.isArray(users) || users.length === 0) return;

    const cards = grid.querySelectorAll('.contact-card');
    if (!cards || cards.length === 0) return;

    for (let i = 0; i < Math.min(cards.length, users.length); i++) {
      const u = users[i];
      const card = cards[i];
      if (!u || !card) continue;

      if (me && u.id === me.id) continue;
      if (card.querySelector('.dm-contact-btn')) continue;

      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Utilisateur';

      const btn = document.createElement('button');
      btn.className = 'dm-contact-btn';
      btn.type = 'button';
      btn.innerHTML = `
        <i data-lucide="message-circle" style="width:18px; height:18px;"></i>
        MESSAGE PRIVÉ
      `;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openDMModal({ id: u.id, name: fullName });
      });

      card.appendChild(btn);
    }

    if (window.lucide) lucide.createIcons();
  }

  function hookRenderContacts() {
    if (typeof window.renderContacts !== 'function') return false;

    const original = window.renderContacts;
    if (original.__dm_wrapped) return true;

    function wrappedRenderContacts(users) {
      original(users);
      injectDMButtons(users);
    }
    wrappedRenderContacts.__dm_wrapped = true;

    window.renderContacts = wrappedRenderContacts;
    return true;
  }

  const tryHook = () => {
    const ok = hookRenderContacts();
    if (!ok) setTimeout(tryHook, 60);
  };
  tryHook();

})();
