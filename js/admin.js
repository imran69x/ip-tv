// js/admin.js — NOYON TV Admin Panel

document.addEventListener("DOMContentLoaded", () => {

    // ── TAB SWITCHING ──
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => { t.classList.add('hidden'); t.classList.remove('active'); });
            item.classList.add('active');
            const el = document.getElementById(`tab-${tab}`);
            el.classList.remove('hidden'); el.classList.add('active');
            if (tab === 'users') loadUsers();
            if (tab === 'subscriptions') loadSubUsers();
            if (tab === 'channels') loadChannels();
            if (tab === 'packages') loadPackages();
            if (tab === 'payment') loadPaymentMethods();
            if (tab === 'settings') loadSettings();
        });
    });

    // ── CHANNEL MODAL ──
    const channelModal = document.getElementById('channel-modal');
    document.getElementById('btn-add-channel').addEventListener('click', () => {
        document.getElementById('channel-form').reset();
        document.getElementById('channel-id').value = '';
        document.getElementById('modal-title').textContent = 'Add Channel';
        document.getElementById('modal-error').classList.add('hidden');
        channelModal.classList.remove('hidden');
    });
    document.getElementById('btn-cancel-modal').addEventListener('click', () => channelModal.classList.add('hidden'));

    document.getElementById('channel-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-channel');
        const errEl = document.getElementById('modal-error');
        errEl.classList.add('hidden');
        btn.textContent = 'Saving...'; btn.disabled = true;
        const id = document.getElementById('channel-id').value;
        const data = {
            name: document.getElementById('channel-name').value,
            url: document.getElementById('channel-url').value,
            category: document.getElementById('channel-category').value,
            logo: document.getElementById('channel-logo').value,
            isActive: document.getElementById('channel-active').checked
        };
        try {
            if (id) { await db.collection("channels").doc(id).update(data); }
            else { await db.collection("channels").add(data); }
            channelModal.classList.add('hidden');
            loadChannels();
        } catch(err) {
            errEl.textContent = "Error: " + err.message;
            errEl.classList.remove('hidden');
        } finally { btn.textContent = 'Save Channel'; btn.disabled = false; }
    });

    // ── PACKAGE MODAL ──
    const pkgModal = document.getElementById('pkg-modal');
    document.getElementById('btn-add-package').addEventListener('click', () => {
        document.getElementById('pkg-form').reset();
        document.getElementById('pkg-id').value = '';
        document.getElementById('pkg-modal-title').textContent = 'Add Package';
        document.getElementById('pkg-error').classList.add('hidden');
        pkgModal.classList.remove('hidden');
    });
    document.getElementById('btn-cancel-pkg').addEventListener('click', () => pkgModal.classList.add('hidden'));

    document.getElementById('pkg-form').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-pkg');
        const errEl = document.getElementById('pkg-error');
        errEl.classList.add('hidden');
        btn.textContent = 'Saving...'; btn.disabled = true;
        const id = document.getElementById('pkg-id').value;
        const featuresRaw = document.getElementById('pkg-features').value;
        const data = {
            name: document.getElementById('pkg-name').value,
            price: Number(document.getElementById('pkg-price').value),
            durationDays: Number(document.getElementById('pkg-days').value),
            features: featuresRaw.split('\n').map(f => f.trim()).filter(Boolean),
            isPopular: document.getElementById('pkg-popular').checked,
            isActive: document.getElementById('pkg-active').checked
        };
        try {
            if (id) { await db.collection("subscription_packages").doc(id).update(data); }
            else { await db.collection("subscription_packages").add(data); }
            pkgModal.classList.add('hidden');
            loadPackages();
        } catch(err) {
            errEl.textContent = "Error: " + err.message;
            errEl.classList.remove('hidden');
        } finally { btn.textContent = 'Save Package'; btn.disabled = false; }
    });

    // ── USER MANAGEMENT ──
    let allChannelsCache = [];
    let selectedUserId = null;
    let selectedUserChannels = [];

    async function loadUsers() {
        const el = document.getElementById('admin-user-list');
        el.innerHTML = '<div class="loading-text"><div class="spinner"></div></div>';
        try {
            const [userSnap, chSnap] = await Promise.all([
                db.collection("users").get(),
                db.collection("channels").get()
            ]);
            allChannelsCache = [];
            chSnap.forEach(d => allChannelsCache.push({ id: d.id, ...d.data() }));
            el.innerHTML = '';
            userSnap.forEach(doc => {
                const u = doc.data();
                const status = u.subscriptionStatus || 'trial';
                const statusClass = status === 'active' ? 'status-active' : status === 'expired' ? 'status-expired' : 'status-trial';
                const div = document.createElement('div');
                div.className = 'user-item';
                div.innerHTML = `
                    <img src="${u.photoURL||''}" class="user-avatar-sm" onerror="this.style.display='none'">
                    <div class="user-info">
                        <div style="font-weight:600">${u.displayName||'Unknown'} ${u.role==='admin'?'<span style="color:var(--accent-cyan);font-size:10px">(Admin)</span>':''}</div>
                        <div class="user-email">${u.email}</div>
                    </div>
                    <span class="status-badge ${statusClass}">${status}</span>
                `;
                div.addEventListener('click', () => {
                    document.querySelectorAll('.user-item').forEach(x => x.classList.remove('selected'));
                    div.classList.add('selected');
                    selectedUserId = doc.id;
                    selectedUserChannels = u.accessibleChannels || [];
                    document.getElementById('selected-user-name').textContent = u.displayName;
                    document.getElementById('access-placeholder').classList.add('hidden');
                    document.getElementById('access-controls').classList.remove('hidden');
                    renderChecklist();
                });
                el.appendChild(div);
            });
            if (el.innerHTML === '') el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">No users found</div>';
        } catch(err) {
            el.innerHTML = `<div style="color:#ff6b6b;padding:16px;font-size:13px"><b>Database Error:</b><br>${err.message}</div>`;
        }
    }

    function renderChecklist() {
        const el = document.getElementById('channel-checklist');
        el.innerHTML = '';
        const groups = {};
        allChannelsCache.forEach(ch => { const cat = ch.category||'Other'; if (!groups[cat]) groups[cat]=[]; groups[cat].push(ch); });
        Object.entries(groups).forEach(([cat, chs]) => {
            const hdr = document.createElement('div');
            hdr.style.cssText = 'color:var(--accent-cyan);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:8px 4px 4px';
            hdr.textContent = cat;
            el.appendChild(hdr);
            chs.forEach(ch => {
                const checked = selectedUserChannels.includes(ch.id);
                const div = document.createElement('div');
                div.className = 'check-item';
                div.innerHTML = `<input type="checkbox" id="chk-${ch.id}" value="${ch.id}" ${checked?'checked':''}><label for="chk-${ch.id}">${ch.name}</label>`;
                el.appendChild(div);
            });
        });
    }

    document.getElementById('btn-grant-all').addEventListener('click', () =>
        document.querySelectorAll('.channel-checklist input').forEach(cb => cb.checked = true));
    document.getElementById('btn-revoke-all').addEventListener('click', () =>
        document.querySelectorAll('.channel-checklist input').forEach(cb => cb.checked = false));
    document.getElementById('btn-save-access').addEventListener('click', async () => {
        if (!selectedUserId) return;
        const checked = [...document.querySelectorAll('.channel-checklist input:checked')].map(cb => cb.value);
        const btn = document.getElementById('btn-save-access');
        btn.textContent = 'Saving...';
        await db.collection("users").doc(selectedUserId).update({ accessibleChannels: checked });
        selectedUserChannels = checked;
        btn.textContent = '✓ Saved!';
        setTimeout(() => btn.textContent = 'Save Access', 2000);
    });

    // ── SUBSCRIPTION MANAGEMENT ──
    async function loadSubUsers() {
        const tbody = document.getElementById('sub-user-table');
        tbody.innerHTML = '<tr><td colspan="5"><div class="loading-text"><div class="spinner"></div></div></td></tr>';
        try {
            const [pkgSnap, userSnap] = await Promise.all([
                db.collection("subscription_packages").where("isActive", "==", true).get(),
                db.collection("users").get()
            ]);
            const packages = [];
            pkgSnap.forEach(d => packages.push({ id: d.id, ...d.data() }));
            tbody.innerHTML = '';
            userSnap.forEach(doc => {
                const u = doc.data();
                if (u.role === 'admin') return;
                const status = u.subscriptionStatus || 'trial';
                const expiry = u.subscriptionExpiry?.toDate();
                const statusClass = status === 'active' ? 'status-active' : status === 'expired' ? 'status-expired' : 'status-trial';
                const pkgOptions = packages.map(p => `<option value="${p.id}" data-days="${p.durationDays}">${p.name} (${p.durationDays}d)</option>`).join('');
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight:600">${u.displayName||'Unknown'}</td>
                    <td style="font-size:12px;color:var(--text-secondary)">${u.email}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td style="font-size:12px">${expiry ? expiry.toLocaleDateString() : '—'}</td>
                    <td>
                        <div style="display:flex;gap:8px;align-items:center">
                            <select id="pkg-select-${doc.id}" class="search-input" style="padding:6px 10px;font-size:12px;width:140px">
                                ${pkgOptions || '<option>No packages</option>'}
                            </select>
                            <button class="btn-primary btn-grant-sub" data-uid="${doc.id}" style="padding:6px 12px;font-size:12px">Grant</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
            document.querySelectorAll('.btn-grant-sub').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const uid = e.target.getAttribute('data-uid');
                    const sel = document.getElementById(`pkg-select-${uid}`);
                    const days = parseInt(sel.selectedOptions[0]?.getAttribute('data-days') || 30);
                    const expiry = new Date();
                    expiry.setDate(expiry.getDate() + days);
                    btn.textContent = '...'; btn.disabled = true;
                    await db.collection("users").doc(uid).update({
                        subscriptionStatus: "active",
                        subscriptionExpiry: firebase.firestore.Timestamp.fromDate(expiry),
                        accessibleChannels: []
                    });
                    btn.textContent = '✓'; 
                    setTimeout(() => { btn.textContent = 'Grant'; btn.disabled = false; }, 2000);
                    loadSubUsers();
                });
            });
            if (tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary)">No users found</td></tr>';
        } catch(err) {
            tbody.innerHTML = `<tr><td colspan="5" style="color:#ff6b6b;padding:16px">${err.message}</td></tr>`;
        }
    }

    // ── CHANNELS ──
    async function loadChannels() {
        const tbody = document.getElementById('admin-channel-table');
        tbody.innerHTML = '<tr><td colspan="4"><div class="loading-text"><div class="spinner"></div></div></td></tr>';
        try {
            const snap = await db.collection("channels").orderBy("category").get();
            tbody.innerHTML = '';
            snap.forEach(doc => {
                const c = doc.data();
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.name}</td>
                    <td>${c.category||'-'}</td>
                    <td><span style="color:${c.isActive?'var(--success)':'var(--error)'}">${c.isActive?'Active':'Off'}</span></td>
                    <td style="display:flex;gap:6px">
                        <button class="btn-secondary btn-edit" data-id="${doc.id}" style="padding:4px 10px;font-size:12px">Edit</button>
                        <button class="btn-secondary btn-del" data-id="${doc.id}" style="padding:4px 10px;font-size:12px;color:var(--error);border-color:var(--error)">Del</button>
                    </td>`;
                tbody.appendChild(tr);
            });
            document.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.target.getAttribute('data-id');
                    const doc = await db.collection("channels").doc(id).get();
                    const d = doc.data();
                    document.getElementById('channel-id').value = id;
                    document.getElementById('channel-name').value = d.name;
                    document.getElementById('channel-url').value = d.url;
                    document.getElementById('channel-category').value = d.category||'';
                    document.getElementById('channel-logo').value = d.logo||'';
                    document.getElementById('channel-active').checked = d.isActive;
                    document.getElementById('modal-title').textContent = 'Edit Channel';
                    document.getElementById('modal-error').classList.add('hidden');
                    channelModal.classList.remove('hidden');
                });
            });
            document.querySelectorAll('.btn-del').forEach(btn => {
                btn.addEventListener('click', async e => {
                    if (!confirm("Delete this channel?")) return;
                    await db.collection("channels").doc(e.target.getAttribute('data-id')).delete();
                    loadChannels();
                });
            });
            if (snap.empty) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary)">No channels yet</td></tr>';
        } catch(err) {
            tbody.innerHTML = `<tr><td colspan="4" style="color:#ff6b6b;padding:16px">${err.message}</td></tr>`;
        }
    }

    document.getElementById('btn-import-bd').addEventListener('click', async () => {
        if (!confirm("Import Bangladesh channels into Firestore?")) return;
        const btn = document.getElementById('btn-import-bd');
        btn.textContent = 'Importing...'; btn.disabled = true;
        const channels = [
            { name:"BTV National", url:"https://www.btvlive.gov.bd/streams/ef8b8bbc-98b7-4ba7-a49d-a0adaf259d35/ES/355ba051-9a60-48aa-adcf-5a6c64da8c5c/355ba051-9a60-48aa-adcf-5a6c64da8c5c_3_playlist.m3u8", category:"BD" },
            { name:"Ananda TV", url:"https://bozztv.com/rongo/rongo-AnandaTV/index.m3u8", category:"BD News" },
            { name:"ATN News", url:"https://bozztv.com/rongo/rongo-ATNNews/index.m3u8", category:"BD News" },
            { name:"Channel 24", url:"https://bozztv.com/rongo/rongo-Channel24HD/index.m3u8", category:"BD News" },
            { name:"Desh TV", url:"https://bozztv.com/rongo/rongo-DeshTV/index.m3u8", category:"BD News" },
            { name:"Independent TV", url:"https://bozztv.com/rongo/rongo-IndependentTV/index.m3u8", category:"BD News" },
            { name:"Jamuna TV", url:"https://bozztv.com/rongo/rongo-JamunaTelevision/index.m3u8", category:"BD News" },
            { name:"Somoy News", url:"https://bozztv.com/rongo/rongo-somoy/index.m3u8", category:"BD News" },
            { name:"RTV", url:"https://bozztv.com/rongo/rongo-RTV/index.m3u8", category:"BD News" },
            { name:"News 24", url:"https://bozztv.com/rongo/rongo-News24HD/index.m3u8", category:"BD News" },
            { name:"T Sports", url:"https://tvsen7.aynaott.com/tsportshd/index.m3u8", category:"BD Sports" },
            { name:"Al Jazeera English", url:"https://live-hls-web-aje.getaj.net/AJE/index.m3u8", category:"International News" },
            { name:"DW English", url:"https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8", category:"International News" },
            { name:"France 24", url:"https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8", category:"International News" },
        ];
        const batch = db.batch();
        channels.forEach(ch => batch.set(db.collection("channels").doc(), { ...ch, logo:"", isActive:true }));
        await batch.commit();
        alert("Imported successfully!");
        loadChannels();
        btn.textContent = 'Auto-Import BD'; btn.disabled = false;
    });

    // ── ADMIN CHANNEL SEARCH ──
    const searchInput = document.getElementById('admin-channel-search');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            const rows = document.querySelectorAll('#admin-channel-table tr');
            rows.forEach(row => {
                if(row.children.length < 4) return; // skip empty/loading rows
                const text = (row.children[0].textContent + " " + row.children[1].textContent).toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        });
    }

    // ── PACKAGES ──
    async function loadPackages() {
        const el = document.getElementById('packages-list');
        el.innerHTML = '<div class="loading-text"><div class="spinner"></div></div>';
        try {
            const snap = await db.collection("subscription_packages").get();
            el.innerHTML = '';
            if (snap.empty) { el.innerHTML = '<p style="color:var(--text-secondary);text-align:center">No packages yet. Add one!</p>'; return; }
            snap.forEach(doc => {
                const p = doc.data();
                const div = document.createElement('div');
                div.className = 'pkg-card';
                div.innerHTML = `
                    <div class="pkg-info">
                        <h4>${p.name} ${p.isPopular ? '⭐' : ''} <span class="status-badge ${p.isActive?'status-active':'status-expired'}">${p.isActive?'Active':'Hidden'}</span></h4>
                        <span>${p.durationDays} days · ${(p.features||[]).join(', ')}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:16px">
                        <div class="pkg-price">৳${p.price}</div>
                        <button class="btn-secondary btn-edit-pkg" data-id="${doc.id}" style="padding:6px 12px;font-size:12px">Edit</button>
                        <button class="btn-secondary btn-del-pkg" data-id="${doc.id}" style="padding:6px 12px;font-size:12px;color:var(--error);border-color:var(--error)">Del</button>
                    </div>
                `;
                el.appendChild(div);
            });
            document.querySelectorAll('.btn-edit-pkg').forEach(btn => {
                btn.addEventListener('click', async e => {
                    const id = e.target.getAttribute('data-id');
                    const doc = await db.collection("subscription_packages").doc(id).get();
                    const p = doc.data();
                    document.getElementById('pkg-id').value = id;
                    document.getElementById('pkg-name').value = p.name;
                    document.getElementById('pkg-price').value = p.price;
                    document.getElementById('pkg-days').value = p.durationDays;
                    document.getElementById('pkg-features').value = (p.features||[]).join('\n');
                    document.getElementById('pkg-popular').checked = p.isPopular||false;
                    document.getElementById('pkg-active').checked = p.isActive;
                    document.getElementById('pkg-modal-title').textContent = 'Edit Package';
                    pkgModal.classList.remove('hidden');
                });
            });
            document.querySelectorAll('.btn-del-pkg').forEach(btn => {
                btn.addEventListener('click', async e => {
                    if (!confirm("Delete this package?")) return;
                    await db.collection("subscription_packages").doc(e.target.getAttribute('data-id')).delete();
                    loadPackages();
                });
            });
        } catch(err) { el.innerHTML = `<p style="color:#ff6b6b">${err.message}</p>`; }
    }

    // ── PAYMENT METHODS ──
    async function loadPaymentMethods() {
        const el = document.getElementById('pm-list');
        el.innerHTML = '<div class="loading-text"><div class="spinner"></div></div>';
        try {
            const doc = await db.collection("payment_settings").doc("methods").get();
            const methods = doc.exists ? (doc.data().methods || []) : [];
            el.innerHTML = '';
            methods.forEach((m, idx) => {
                const div = document.createElement('div');
                div.className = 'pm-item';
                div.innerHTML = `
                    <div><strong>${m.name}</strong>: ${m.number} ${m.type?`(${m.type})`:''}</div>
                    <button class="btn-secondary" data-idx="${idx}" style="padding:4px 10px;font-size:12px;color:var(--error);border-color:var(--error)">Remove</button>
                `;
                div.querySelector('button').addEventListener('click', async () => {
                    methods.splice(idx, 1);
                    await db.collection("payment_settings").doc("methods").set({ methods });
                    loadPaymentMethods();
                });
                el.appendChild(div);
            });
            if (!methods.length) el.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">No payment methods added yet.</p>';
        } catch(err) { el.innerHTML = `<p style="color:#ff6b6b">${err.message}</p>`; }
    }

    document.getElementById('btn-add-pm').addEventListener('click', async () => {
        const name = document.getElementById('pm-name').value.trim();
        const number = document.getElementById('pm-number').value.trim();
        const type = document.getElementById('pm-type').value.trim();
        if (!name || !number) return alert("Name and number required");
        const doc = await db.collection("payment_settings").doc("methods").get();
        const methods = doc.exists ? (doc.data().methods || []) : [];
        methods.push({ name, number, type });
        await db.collection("payment_settings").doc("methods").set({ methods });
        document.getElementById('pm-name').value = '';
        document.getElementById('pm-number').value = '';
        document.getElementById('pm-type').value = '';
        loadPaymentMethods();
    });

    // ── SETTINGS ──
    async function loadSettings() {
        try {
            const doc = await db.collection("settings").doc("general").get();
            if (doc.exists) {
                const url = doc.data().logoUrl || '';
                document.getElementById('settings-logo-url').value = url;
                if (url) {
                    document.getElementById('settings-logo-preview').src = url;
                    document.getElementById('settings-logo-preview').style.display = 'inline-block';
                    document.getElementById('settings-logo-fallback').style.display = 'none';
                }
            }
        } catch(err) { console.error(err); }
    }

    document.getElementById('settings-logo-url').addEventListener('input', e => {
        const url = e.target.value;
        const img = document.getElementById('settings-logo-preview');
        const fb = document.getElementById('settings-logo-fallback');
        if (url) { img.src = url; img.style.display = 'inline-block'; fb.style.display = 'none'; }
        else { img.style.display = 'none'; fb.style.display = 'inline-block'; }
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const btn = document.getElementById('btn-save-settings');
        const msg = document.getElementById('settings-message');
        btn.textContent = 'Saving...'; btn.disabled = true;
        const url = document.getElementById('settings-logo-url').value.trim();
        try {
            await db.collection("settings").doc("general").set({ logoUrl: url }, { merge: true });
            msg.textContent = 'Settings saved successfully! Refresh page to see changes globally.';
            msg.classList.remove('hidden');
            if (typeof loadAppSettings === 'function') loadAppSettings(); // update current page
        } catch(err) {
            msg.textContent = 'Error: ' + err.message;
            msg.style.color = 'var(--error)';
            msg.classList.remove('hidden');
        } finally {
            btn.textContent = 'Save Settings'; btn.disabled = false;
            setTimeout(() => msg.classList.add('hidden'), 5000);
        }
    });

    // ── INIT ──
    auth.onAuthStateChanged((user) => { if (user) loadUsers(); });
});
