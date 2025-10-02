// Meetings page authentication and common functionality

// Authentication check and button handler
function checkAuth() {
    const authData = localStorage.getItem('courtorder_auth');
    if (!authData) {
        window.location.href = 'login.html';
        return false;
    }
    
    try {
        const auth = JSON.parse(authData);
        if (!auth.isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    } catch (e) {
        localStorage.removeItem('courtorder_auth');
        window.location.href = 'login.html';
        return false;
    }
}

function handleAuthButton() {
    const authData = localStorage.getItem('courtorder_auth');
    if (authData) {
        try {
            const auth = JSON.parse(authData);
            if (auth.isLoggedIn) {
                if (confirm('Do you want to sign out?')) {
                    localStorage.removeItem('courtorder_auth');
                    window.location.href = 'index.html';
                }
                return;
            }
        } catch (e) {
            localStorage.removeItem('courtorder_auth');
        }
    }
    window.location.href = 'login.html';
}

function updateAuthButton() {
    const authBtn = document.getElementById('auth-btn');
    const authData = localStorage.getItem('courtorder_auth');
    
    if (authData) {
        try {
            const auth = JSON.parse(authData);
            if (auth.isLoggedIn) {
                authBtn.textContent = `Sign Out (${auth.username})`;
                return;
            }
        } catch (e) {
            localStorage.removeItem('courtorder_auth');
        }
    }
    authBtn.textContent = 'Sign In';
}

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        updateAuthButton();
    }
});

// Make functions globally available
window.handleAuthButton = handleAuthButton;
