// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyBuuRwHaDLe4BKaReu4R91ZC57StYTuF0Y",
  authDomain: "ip-tvv2.firebaseapp.com",
  projectId: "ip-tvv2",
  storageBucket: "ip-tvv2.firebasestorage.app",
  messagingSenderId: "644260464304",
  appId: "1:644260464304:web:89280d4439d50016fc5d75"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

window.auth = auth;
window.db = db;
