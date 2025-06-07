// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; // <-- إضافة هذا السطر

const firebaseConfig = {
  apiKey: "AIzaSyCsgYfJpNeqTVSY0eZgRFOw2DMDbYgSMGU",
  authDomain: "project-d3f9b.firebaseapp.com",
  projectId: "project-d3f9b",
  storageBucket: "project-d3f9b.firebasestorage.app",
  messagingSenderId: "22656895821",
  appId: "1:22656895821:web:6f6dbc47baa6326a400504",
  measurementId: "G-PDETFD7QW0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // <-- إضافة وتصدير هذا السطر