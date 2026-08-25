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

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            loginError.textContent = error.message;
            return;
        }

        const { data: vinculo, error: vinculoError } = await supabase
            .from('usuarios_empresa')
            .select('id')
            .eq('user_id', data.user.id)
            .maybeSingle();

        if (vinculoError || !vinculo) {
            await supabase.auth.signOut();
            loginError.textContent =
                'A conta foi autenticada, mas ainda não está vinculada a uma empresa.';
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