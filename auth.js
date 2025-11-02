// 🔐 auth.js — Proteção de login MorillaFlix
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Seletores
const accountBtn = document.getElementById('account-btn');
const logoutBtn = document.getElementById('logout-btn');

// Observa o estado de autenticação
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Usuário logado — mostra conta e botão de sair
    const nome = user.email.split('@')[0];
    if (accountBtn) accountBtn.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    // Usuário não logado — redireciona
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  }
});

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}
