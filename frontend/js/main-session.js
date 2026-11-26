import { api, viewer } from './writing-api.js';

const loginLink = document.querySelector('#login-link');
const logoutButton = document.querySelector('#logout-button');
const myPageLink = document.querySelector('#my-page-link');
const adminLink = document.querySelector('#admin-link');
const status = document.querySelector('#session-status');

viewer().then(user => {
    loginLink.hidden = Boolean(user);
    logoutButton.hidden = !user;
    myPageLink.hidden = !user;
    adminLink.hidden = user?.role !== 'ADMIN';
}).catch(error => {
    status.textContent = error.message;
});

logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
        await api('/api/auth/logout', 'POST');
        location.assign('/');
    } catch (error) {
        status.textContent = error.message;
        logoutButton.disabled = false;
    }
});
