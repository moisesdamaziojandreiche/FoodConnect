import { supabase } from '../config/supabase.js';

const loginForm = document.getElementById('loginForm');
const logoutButton = document.getElementById('logout');


// =========================================================
// LOGIN
// =========================================================

if (loginForm) {
    loginForm.onsubmit = async (event) => {
        event.preventDefault();

        const loginError = document.getElementById('loginError');
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        loginError.textContent = 'Entrando...';

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            loginError.textContent = error.message;
            return;
        }

        location.href = 'dashboard.html';
    };
}


// =========================================================
// LOGOUT
// =========================================================

if (logoutButton) {
    logoutButton.onclick = async () => {
        await supabase.auth.signOut();

        location.href = 'login.html';
    };
}