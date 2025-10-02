class AuthManager {
    constructor() {
        this.USERS_KEY = 'courtorder_users';
        this.AUTH_KEY = 'courtorder_auth';
        
        // Initialize with default user if no users exist
        this.initializeDefaultUser();
    }

    initializeDefaultUser() {
        const users = this.getUsers();
        if (Object.keys(users).length === 0) {
            users['admin'] = 'password123';
            localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        }
    }

    getUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.USERS_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    addUser(username, password) {
        const users = this.getUsers();
        
        if (users[username]) {
            console.warn(`Username "${username}" already exists.`);
            return false;
        }
        
        users[username] = password;
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
        console.log(`Account for "${username}" created.`);
        return true;
    }

    validateUser(username, password) {
        const users = this.getUsers();
        return users[username] && users[username] === password;
    }

    login(username) {
        const authData = {
            isLoggedIn: true,
            username: username,
            loginTime: new Date().toISOString()
        };
        localStorage.setItem(this.AUTH_KEY, JSON.stringify(authData));
    }

    logout() {
        localStorage.removeItem(this.AUTH_KEY);
    }

    isLoggedIn() {
        try {
            const authData = JSON.parse(localStorage.getItem(this.AUTH_KEY));
            return authData && authData.isLoggedIn;
        } catch (e) {
            return false;
        }
    }

    getCurrentUser() {
        try {
            const authData = JSON.parse(localStorage.getItem(this.AUTH_KEY));
            return authData && authData.isLoggedIn ? authData.username : null;
        } catch (e) {
            return null;
        }
    }
}

// --- Main Application Logic ---

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    const authData = localStorage.getItem('courtorder_auth');
    if (authData) {
        try {
            const auth = JSON.parse(authData);
            if (auth.isLoggedIn) {
                // User is already logged in, redirect to home
                window.location.href = 'index.html';
                return;
            }
        } catch (e) {
            // Invalid auth data, clear it
            localStorage.removeItem('courtorder_auth');
        }
    }
});

// 1. Create an instance of our auth manager.
const authManager = new AuthManager();

// 2. Get references to the HTML elements.
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const createAccountBtn = document.getElementById('create-account-btn');

// 3. Add an event listener for the "Create Account" button.
createAccountBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // Ensure fields are not empty.
    if (!username || !password) {
        alert('Please fill out both username and password fields.');
        return;
    }

    // Try to add the user.
    if (authManager.addUser(username, password)) {
        alert('Account created successfully! You can now log in.');
        // Clear the input fields for a better user experience.
        usernameInput.value = '';
        passwordInput.value = '';
    } else {
        alert('This username is already taken. Please choose another.');
    }
});

// 4. Add an event listener for the form's "submit" event.
loginForm.addEventListener('submit', (event) => {
    // Prevent the default form submission (which would redirect without validation).
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // Validate the user's credentials.
    if (authManager.validateUser(username, password)) {
        // Log the user in
        authManager.login(username);
        alert(`Welcome, ${username}!`);
        // If validation is successful, redirect to the main page.
        window.location.href = 'index.html';
    } else {
        alert('Invalid username or password.');
    }
});