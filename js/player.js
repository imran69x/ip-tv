// js/player.js — NOYON TV with Subscription System

document.addEventListener("DOMContentLoaded", () => {
    const video = document.getElementById('video-player');
    const noVideoOverlay = document.getElementById('no-video-overlay');
    const channelListEl = document.getElementById('channel-list');
    const searchInput = document.getElementById('channel-search');
    const trialBadge = document.getElementById('trial-badge');
    const expiredOverlay = document.getElementById('expired-overlay');
    let hls = null;
    let allChannels = [];
    let userAccessibleChannelIds = [];
    let userSubscriptionStatus = 'loading'; // trial | active | expired

    const ADMIN_EMAIL = 'noyonxp25@gmail.com';
    const FREE_TRIAL_DAYS = 3;

    auth.onAuthStateChanged(async (user) => {
        if (!user) return;

        document.getElementById('user-name').textContent = user.displayName || user.email;
        if (user.photoURL) {
            const avatar = document.getElementById('user-avatar');
            avatar.src = user.photoURL;
            avatar.classList.remove('hidden');
        }

        const isAdmin = user.email === ADMIN_EMAIL;
        const now = new Date();

        // Upsert user to Firestore
        const userRef = db.collection("users").doc(user.uid);
        const userSnap = await userRef.get();
        let userData = {};

        if (!userSnap.exists) {
            // First time login — start free trial
            userData = {
                email: user.email,
                displayName: user.displayName || user.email,
                photoURL: user.photoURL || "",
                role: isAdmin ? "admin" : "user",
                trialStartDate: firebase.firestore.Timestamp.fromDate(now),
                subscriptionStatus: isAdmin ? "admin" : "trial",
                subscriptionExpiry: null,
                accessibleChannels: [],
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            };
            await userRef.set(userData);
        } else {
            userData = userSnap.data();
            await userRef.update({
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                displayName: user.displayName || userData.displayName,
                photoURL: user.photoURL || userData.photoURL || ""
            });
        }

        if (isAdmin) {
            document.getElementById('admin-btn').classList.remove('hidden');
            document.getElementById('subscription-btn').classList.add('hidden');
            userAccessibleChannelIds = ["ALL"];
            userSubscriptionStatus = "admin";
        } else {
            // Check subscription status
            userSubscriptionStatus = await checkSubscriptionStatus(userRef, userData, now);

            if (userSubscriptionStatus === "trial") {
                const trialStart = userData.trialStartDate?.toDate() || now;
                const daysLeft = FREE_TRIAL_DAYS - Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
                trialBadge.textContent = `🎁 ${daysLeft} day${daysLeft !== 1 ? 's' : ''} trial left`;
                trialBadge.classList.remove('hidden');
                userAccessibleChannelIds = ["ALL"];
            } else if (userSubscriptionStatus === "active") {
                const expiry = userData.subscriptionExpiry?.toDate() || now;
                const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                trialBadge.textContent = `✅ Active — ${daysLeft}d left`;
                trialBadge.classList.remove('hidden');
                trialBadge.style.background = 'rgba(16,185,129,0.2)';
                trialBadge.style.borderColor = 'var(--success)';
                trialBadge.style.color = 'var(--success)';
                userAccessibleChannelIds = ["ALL"];
            } else {
                // expired
                userSubscriptionStatus = "expired";
                expiredOverlay.classList.remove('hidden');
                userAccessibleChannelIds = [];
                loadSubscriptionModal(user);
                await loadChannels();
                return;
            }
        }

        loadSubscriptionModal(user);
        await loadChannels();
    });

    async function checkSubscriptionStatus(userRef, userData, now) {
        let status = userData.subscriptionStatus || "trial";

        if (status === "active") {
            const expiry = userData.subscriptionExpiry?.toDate();
            if (expiry && expiry < now) {
                status = "expired";
                await userRef.update({ subscriptionStatus: "expired" });
            }
        } else if (status === "trial") {
            const trialStart = userData.trialStartDate?.toDate() || now;
            const daysPassed = (now - trialStart) / (1000 * 60 * 60 * 24);
            if (daysPassed > FREE_TRIAL_DAYS) {
                status = "expired";
                await userRef.update({ subscriptionStatus: "expired" });
            }
        }
        return status;
    }

    async function loadSubscriptionModal(user) {
        const statusText = document.getElementById('sub-status-text');
        const plansGrid = document.getElementById('sub-plans');
        const paymentBox = document.getElementById('payment-methods-display');

        if (userSubscriptionStatus === "trial") {
            const userData = (await db.collection("users").doc(user.uid).get()).data();
            const trialStart = userData.trialStartDate?.toDate() || new Date();
            const daysLeft = FREE_TRIAL_DAYS - Math.floor((new Date() - trialStart) / (1000*60*60*24));
            statusText.textContent = `🎁 Free Trial — ${daysLeft} days remaining`;
        } else if (userSubscriptionStatus === "active") {
            const userData = (await db.collection("users").doc(user.uid).get()).data();
            const expiry = userData.subscriptionExpiry?.toDate();
            statusText.textContent = `✅ Active subscription — expires ${expiry?.toLocaleDateString()}`;
        } else {
            statusText.textContent = `❌ Your access has expired. Choose a plan below.`;
            statusText.style.color = '#ff6b6b';
        }

        // Load plans
        try {
            const plansSnap = await db.collection("subscription_packages").where("isActive", "==", true).get();
            plansGrid.innerHTML = '';
            plansSnap.forEach(doc => {
                const p = doc.data();
                const card = document.createElement('div');
                card.className = 'plan-card';
                if (p.isPopular) card.classList.add('popular');
                card.innerHTML = `
                    ${p.isPopular ? '<div class="popular-badge">Most Popular</div>' : ''}
                    <h3>${p.name}</h3>
                    <div class="plan-price">৳${p.price}<span>/${p.durationDays} days</span></div>
                    <div class="plan-features">${(p.features || []).map(f => `<div>✓ ${f}</div>`).join('')}</div>
                `;
                plansGrid.appendChild(card);
            });
            if (plansSnap.empty) {
                plansGrid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">No plans available yet.</p>';
            }
        } catch(e) { console.error(e); }

        // Load payment methods
        try {
            const paySnap = await db.collection("payment_settings").doc("methods").get();
            if (paySnap.exists) {
                const methods = paySnap.data().methods || [];
                paymentBox.innerHTML = methods.map(m =>
                    `<div class="pay-method"><strong>${m.name}</strong>: ${m.number} ${m.type ? `(${m.type})` : ''}</div>`
                ).join('');
            } else {
                paymentBox.innerHTML = '<p style="color:var(--text-secondary)">Payment info not set by admin yet.</p>';
            }
        } catch(e) { paymentBox.innerHTML = ''; }
    }

    async function loadChannels() {
        channelListEl.innerHTML = '<div class="loading-text"><div class="spinner"></div><span>Loading...</span></div>';
        try {
            const snapshot = await db.collection("channels").where("isActive", "==", true).get();
            allChannels = [];
            snapshot.forEach(doc => allChannels.push({ id: doc.id, ...doc.data() }));

            if (allChannels.length === 0) {
                await seedDefaultChannels();
                const s2 = await db.collection("channels").where("isActive", "==", true).get();
                allChannels = [];
                s2.forEach(doc => allChannels.push({ id: doc.id, ...doc.data() }));
            }
            renderChannelList(allChannels);
        } catch (e) {
            channelListEl.innerHTML = '<div class="loading-text">Error loading channels</div>';
        }
    }

    async function seedDefaultChannels() {
        const batch = db.batch();
        getDefaultChannels().forEach(ch => batch.set(db.collection("channels").doc(ch.id), ch));
        await batch.commit();
    }

    function renderChannelList(channels) {
        channelListEl.innerHTML = '';
        if (!channels.length) { channelListEl.innerHTML = '<div class="loading-text">No channels</div>'; return; }
        const groups = {};
        channels.forEach(ch => { const cat = ch.category || 'Other'; if (!groups[cat]) groups[cat] = []; groups[cat].push(ch); });
        Object.entries(groups).forEach(([cat, chs]) => {
            const hdr = document.createElement('div');
            hdr.className = 'category-header';
            hdr.textContent = cat;
            channelListEl.appendChild(hdr);
            chs.forEach(channel => {
                const access = userAccessibleChannelIds.includes("ALL") || userAccessibleChannelIds.includes(channel.id);
                const div = document.createElement('div');
                div.className = `channel-item ${access ? '' : 'locked'}`;
                div.innerHTML = `
                    <div class="channel-logo-wrap">
                        <img src="${channel.logo||''}" class="channel-logo" alt="" onerror="this.style.display='none';this.parentElement.querySelector('.logo-fallback').style.display='flex'">
                        <div class="logo-fallback" style="display:none">▶</div>
                    </div>
                    <div class="channel-details">
                        <div class="channel-name">${channel.name}</div>
                        <div class="channel-cat">${channel.category||''}</div>
                    </div>
                    ${!access ? '<span class="locked-icon">🔒</span>' : ''}
                `;
                if (access) div.addEventListener('click', () => playChannel(channel, div));
                else div.addEventListener('click', () => document.getElementById('sub-modal').classList.remove('hidden'));
                channelListEl.appendChild(div);
            });
        });
    }

    function playChannel(channel, el) {
        if (userSubscriptionStatus === 'expired') { document.getElementById('sub-modal').classList.remove('hidden'); return; }
        document.querySelectorAll('.channel-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        document.getElementById('now-playing-title').textContent = channel.name;
        document.getElementById('now-playing-category').textContent = channel.category || '';
        document.getElementById('nav-channel-name').textContent = channel.name;
        noVideoOverlay.style.display = 'flex';
        noVideoOverlay.innerHTML = '<div class="overlay-content"><div class="spinner"></div><p>Loading stream...</p></div>';
        if (hls) { hls.destroy(); hls = null; }
        if (Hls.isSupported()) {
            hls = new Hls({ manifestLoadingTimeOut: 15000, levelLoadingTimeOut: 15000 });
            hls.loadSource(channel.url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => { noVideoOverlay.style.display = 'none'; video.play().catch(()=>{}); });
            hls.on(Hls.Events.ERROR, (e, d) => {
                if (d.fatal) noVideoOverlay.innerHTML = '<div class="overlay-content"><div style="font-size:36px">⚠️</div><p>Stream unavailable</p><small>Channel may be offline</small></div>';
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = channel.url;
            video.onloadedmetadata = () => { noVideoOverlay.style.display = 'none'; video.play().catch(()=>{}); };
            video.onerror = () => { noVideoOverlay.innerHTML = '<div class="overlay-content"><div style="font-size:36px">⚠️</div><p>Stream unavailable</p></div>'; };
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            const q = e.target.value.toLowerCase();
            renderChannelList(allChannels.filter(c => c.name.toLowerCase().includes(q) || (c.category||'').toLowerCase().includes(q)));
        });
    }
});

function getDefaultChannels() {
    return [
        { id:'ch_test', name:"HD Test Stream", url:"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", category:"Test", logo:"", isActive:true },
        { id:'ch_bd_01', name:"BTV National", url:"https://www.btvlive.gov.bd/streams/ef8b8bbc-98b7-4ba7-a49d-a0adaf259d35/ES/355ba051-9a60-48aa-adcf-5a6c64da8c5c/355ba051-9a60-48aa-adcf-5a6c64da8c5c_3_playlist.m3u8", category:"BD", logo:"", isActive:true },
        { id:'ch_bdnews_01', name:"Ananda TV", url:"https://bozztv.com/rongo/rongo-AnandaTV/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdnews_02', name:"ATN News", url:"https://bozztv.com/rongo/rongo-ATNNews/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdnews_03', name:"Channel 24", url:"https://bozztv.com/rongo/rongo-Channel24HD/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdnews_04', name:"Jamuna TV", url:"https://bozztv.com/rongo/rongo-JamunaTelevision/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdnews_05', name:"Somoy News", url:"https://bozztv.com/rongo/rongo-somoy/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdnews_06', name:"RTV", url:"https://bozztv.com/rongo/rongo-RTV/index.m3u8", category:"BD News", logo:"", isActive:true },
        { id:'ch_bdsport_01', name:"T Sports", url:"https://tvsen7.aynaott.com/tsportshd/index.m3u8", category:"BD Sports", logo:"", isActive:true },
        { id:'ch_int_01', name:"Al Jazeera English", url:"https://live-hls-web-aje.getaj.net/AJE/index.m3u8", category:"International News", logo:"", isActive:true },
        { id:'ch_int_02', name:"DW English", url:"https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8", category:"International News", logo:"", isActive:true },
        { id:'ch_int_03', name:"France 24", url:"https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8", category:"International News", logo:"", isActive:true },
    ];
}
