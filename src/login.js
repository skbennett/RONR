class Data {
    constructor() {
        // A Map is used to store usernames and passwords for efficient lookups.
        this.users = new Map();
        // For testing, let's add a default user.
        this.users.set('admin', 'password123');
    }

    addUser(username, password) {
        if (this.users.has(username)) {
            console.warn(`Username "${username}" already exists.`);
            return false;
        }
        this.users.set(username, password);
        console.log(`Account for "${username}" created.`);
        return true;
    }

    validateUser(username, password) {
        // Check if the user exists and if the provided password matches the stored one.
        return this.users.has(username) && this.users.get(username) === password;
    }
}

// --- Main Application Logic ---

// 1. Create an instance of our data manager.
const userData = new Data();

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
    if (userData.addUser(username, password)) {
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
    if (userData.validateUser(username, password)) {
        alert(`Welcome, ${username}!`);
        // If validation is successful, redirect to the main page.
        window.location.href = 'index.html';
    } else {
        alert('Invalid username or password.');
    }
});