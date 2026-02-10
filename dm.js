// =====================================================
// DM (CHAT PRIVÉ) — VERSION STABLE
// Objectif :
// - Realtime fiable (comme avant)
// - Pas de resubscribe fantôme
// - Polling uniquement si Realtime échoue
// - Aucune dépendance app.js
// =====================================================

console.log('💬 DM.JS CHARGÉ — VERSION STABLE');

(function () {

  // ===============================
  // Helpers
  // ===============================
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('alsatia_user'));
    } catch {
      return null;
    }
  }

  function getSupabaseClient() {
    return window.supabaseClient || window.supabase || null;
  }

  function escapeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function makeConversationKey(a, b) {
    return [a, b].sort().join(':');
  }

  function scrollBottom(el) {
    if (el) el.scrollTop = el.scrollHeight;
  }

  function isNearBottom(el) {
    return el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 150) : true;
  }

  // ===============================
  // State
  // ===============================
  let dmChannel = null;
  let dmPollTimer = null;
  let dmPolling = false;

  let dmActivePeer = null;
  let dmConversationKey = null;
  let dmMessages = new Map();

  let dmModalOpen = false;
  let dmClosing = false;

  // ===============================
  // Polling fallback
  // ===============================
  function startPolling() {
    if (dmPollTimer) return;
    console.warn('🟠 DM → fallback polling');
    dmPollTimer = setInterval(loadConversation, 2000);
  }

  function stopPolling() {
    if (dmPollTimer) {
      clearInterval(dmPollTimer);
      dmPollTimer = null;
    }
  }

  // ===============================
  // Realtime subscribe
  // ===============================
  function subscribeConversation() {
    const sb = getSupabaseClient();
    if (!sb || !dmConversationKey) return;

    unsubscribeConversation();

    console.log('🔌 DM realtime subscribe', dmConversationKey);

    let watchdog = setTimeout(() => {
      if (dmModalOpen) startPolling();
    }, 4000);

    const safeName = `dm_${dmConversationKey.replace(/[^a-z0-9]/gi, '_')}`;

    dmChannel = sb
      .channel(safeName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_key=eq.${dmConversationKey}`
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            dmMessages.set(row.id, row);
          }
          if (payload.eventType === 'DELETE') {
            dmMessages.delete(row.id);
          }

          renderConversation(true);
        }
      )
      .subscribe((status) => {
        console.log('🔌 DM realtime status:', status);

        if (status === 'SUBSCRIBED') {
          clearTimeout(watchdog);
          stopPolling();
        }

        if (
          (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') &&
          dmModalOpen
        ) {
          clearTimeout(watchdog);
          startPolling();
        }

        // CLOSED volontaire → ignorer
        if (status === 'CLOSED' && dmClosing) {
          clearTimeout(watchdog);
        }
      });
  }

  function unsubscribeConversation() {
    const sb = getSupabaseClient();
    stopPolling();

    if (dmChannel && sb) {
      dmClosing = true;
      sb.removeChannel(dmChannel);
      dmChannel = null;
      setTimeout(() => dmClosing = false, 300);
    }
  }

  // ===============================
  // Load messages
  // ===============================
  async function loadConversation() {
    if (dmPolling) return;
    dmPolling = true;

    const sb = getSupabaseClient();
    if (!sb || !dmConversationKey) return;

    const { data } = await sb
      .from('dm_messages')
      .select('*')
      .eq('conversation_key', dmConversationKey)
      .order('created_at', { ascending: true });

    if (data) {
      dmMessages.clear();
      data.forEach(m => dmMessages.set(m.id, m));
      renderConversation(false);
    }

    dmPolling = false;
  }

  // ===============================
  // Render
  // ===============================
  function renderConversation(fromRealtime) {
    const box = document.getElementById('dm-messages');
    if (!box) return;

    const keep = fromRealtime && isNearBottom(box);

    box.innerHTML = [...dmMessages.values()].map(m => {
      const isMe = m.sender_profile_id === getCurrentUser()?.id;
      return `
        <div class="dm-bubble-row ${isMe ? 'me' : 'them'}">
          <div class="dm-bubble ${isMe ? 'me' : 'them'}">
            ${escapeHTML(m.content || '')}
          </div>
        </div>
      `;
    }).join('');

    if (keep) scrollBottom(box);
  }

  // ===============================
  // UI open / close
  // ===============================
  async function openDM(peer) {
    const me = getCurrentUser();
    if (!me) return;

    dmModalOpen = true;
    dmActivePeer = peer;
    dmConversationKey = makeConversationKey(me.id, peer.id);
    dmMessages.clear();

    const modal = document.getElementById('custom-modal');
    const body = document.getElementById('modal-body');

    body.innerHTML = `
      <div class="dm-header">
        <strong>${escapeHTML(peer.first_name)} ${escapeHTML(peer.last_name)}</strong>
        <button onclick="closeCustomModal()">✕</button>
      </div>
      <div id="dm-messages" class="dm-messages"></div>
      <div class="dm-input-bar">
        <textarea id="dm-input"></textarea>
        <button id="dm-send">Envoyer</button>
      </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('dm-send').onclick = sendMessage;

    await loadConversation();
    subscribeConversation();
  }

  // ===============================
  // Send
  // ===============================
  async function sendMessage() {
    const sb = getSupabaseClient();
    const me = getCurrentUser();
    if (!sb || !me || !dmActivePeer) return;

    const input = document.getElementById('dm-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    await sb.from('dm_messages').insert([{
      sender_profile_id: me.id,
      receiver_profile_id: dmActivePeer.id,
      conversation_key: dmConversationKey,
      content: text
    }]);
  }

  // ===============================
  // Hook contacts (sans app.js)
  // ===============================
  function hookContacts() {
    if (!window.renderContacts || window.renderContacts.__dm) return;

    const original = window.renderContacts;
    window.renderContacts = function (users) {
      original(users);
      const cards = document.querySelectorAll('.contact-card');
      cards.forEach((card, i) => {
        const u = users[i];
        if (!u || card.querySelector('.dm-btn')) return;

        const btn = document.createElement('button');
        btn.textContent = 'Message';
        btn.className = 'dm-btn';
        btn.onclick = () => openDM(u);
        card.appendChild(btn);
      });
    };
    window.renderContacts.__dm = true;
  }

  // ===============================
  // Cleanup close modal
  // ===============================
  const origClose = window.closeCustomModal;
  window.closeCustomModal = function () {
    dmModalOpen = false;
    unsubscribeConversation();
    origClose?.();
  };

  // ===============================
  // Init
  // ===============================
  const wait = setInterval(() => {
    if (window.renderContacts) {
      hookContacts();
      clearInterval(wait);
    }
  }, 100);

})();
