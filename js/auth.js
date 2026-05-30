// js/auth.js — Firebase Google Auth

// ADMIN EMAILS — add your Gmail here to get admin access
const ADMIN_EMAILS = ["noyonxp25@gmail.com"]; // replace with your actual Gmail

// Load App Settings (Logo) globally
async function loadAppSettings() {
    try {
        const doc = await db.collection("settings").doc("general").get();
        if (doc.exists) {
            const data = doc.data();
            if (data.logoUrl) {
                document.querySelectorAll('#app-logo-img, #overlay-logo-img').forEach(img => {
                    img.src = data.logoUrl;
                    img.style.display = 'block';
                });
                document.querySelectorAll('#app-logo-fallback, #overlay-logo-fallback').forEach(el => {
                    el.style.display = 'none';
                });
            }
        }
    } catch(err) { console.error("Error loading settings:", err); }
}

document.addEventListener("DOMContentLoaded", () => {
    loadAppSettings();

    const loginBtn = document.getElementById("google-login-btn");
    const errorMsg = document.getElementById("error-message");
    const loginLoading = document.getElementById("login-loading");

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            loginBtn.classList.add("hidden");
            loginLoading && loginLoading.classList.remove("hidden");

            const provider = new firebase.auth.GoogleAuthProvider();
            try {
                const result = await auth.signInWithPopup(provider);
                await handleUserFirstLogin(result.user);
                window.location.href = "player.html";
            } catch (error) {
                console.error("Login error:", error);
                loginBtn.classList.remove("hidden");
                loginLoading && loginLoading.classList.add("hidden");
                if (errorMsg) {
                    errorMsg.textContent = "Login failed: " + error.message;
                    errorMsg.classList.remove("hidden");
                }
            }
        });
    }

    // Auth state listener
    auth.onAuthStateChanged(async (user) => {
        const path = window.location.pathname;
        const isLogin  = path.endsWith("index.html") || path === "/" || path.endsWith("/");
        const isAdmin  = path.endsWith("admin.html");
        const isPlayer = path.endsWith("player.html");

        if (user) {
            if (isLogin) {
                window.location.href = "player.html";
            } else if (isAdmin) {
                if (user.email !== "noyonxp25@gmail.com") {
                    window.location.href = "player.html";
                }
            }
        } else {
            if (isAdmin || isPlayer) {
                window.location.href = "index.html";
            }
        }
    });
});

async function handleUserFirstLogin(user) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    const isAdmin = ADMIN_EMAILS.includes(user.email);

    if (!doc.exists) {
        await userRef.set({
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL || "",
            role: isAdmin ? "admin" : "user",
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            accessibleChannels: []
        });
    } else {
        // If email matches admin list, promote
        const updateData = {
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (isAdmin && doc.data().role !== "admin") {
            updateData.role = "admin";
        }
        await userRef.update(updateData);
    }
}

function logout() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
}
