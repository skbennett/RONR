// Meetings page authentication and common functionality

// Authentication check (no redirect - let access-control.js handle it)
function checkAuth() {
    const authData = localStorage.getItem('courtorder_auth');
    if (!authData) {
        return false;
    }
    
    try {
        const auth = JSON.parse(authData);
        if (!auth.isLoggedIn) {
            return false;
        }
        return true;
    } catch (e) {
        localStorage.removeItem('courtorder_auth');
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

// Check authentication on page load (only update button if authenticated)
document.addEventListener('DOMContentLoaded', () => {
    // Only update auth button if user is authenticated
    // If not authenticated, access-control.js will handle showing access denied page
    if (checkAuth()) {
        updateAuthButton();
    }
});

// Make functions globally available
window.handleAuthButton = handleAuthButton;
