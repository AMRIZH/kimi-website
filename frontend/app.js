// ReciteRecipe Frontend Application
const API_URL = window.location.origin;

// State management
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadView();
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', loadView);
});

// ============ AUTHENTICATION ============

async function checkAuth() {
    if (!authToken) {
        updateUIForGuest();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateUIForUser();
        } else {
            logout();
        }
    } catch (error) {
        showError(error);
        logout();
    }
}

function updateUIForUser() {
    document.getElementById('auth-nav').style.display = 'none';
    document.getElementById('user-nav').style.display = 'block';
    document.getElementById('nav-my-recipes-item').style.display = 'block';
    document.getElementById('username-display').textContent = currentUser.username;
    
    const createBtn = document.getElementById('create-recipe-btn');
    if (createBtn) createBtn.style.display = 'block';
    
    if (currentUser.role === 'admin') {
        document.getElementById('nav-admin-item').style.display = 'block';
    }
}

function updateUIForGuest() {
    document.getElementById('auth-nav').style.display = 'flex';
    document.getElementById('user-nav').style.display = 'none';
    document.getElementById('nav-my-recipes-item').style.display = 'none';
    document.getElementById('nav-admin-item').style.display = 'none';
    
    const createBtn = document.getElementById('create-recipe-btn');
    if (createBtn) createBtn.style.display = 'none';
}

async function handleLogin(event) {
    event.preventDefault();
    hideError();
    
    const formData = new FormData(event.target);
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            updateUIForUser();
            showToast('Login successful!', 'success');
            showHome();
        } else {
            throw new Error(result.error || 'Login failed');
        }
    } catch (error) {
        showError(error);
    }
}

async function handleRegister(event) {
    event.preventDefault();
    hideError();
    
    const formData = new FormData(event.target);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        adminCode: formData.get('adminCode') || undefined
    };
    
    try {
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            updateUIForUser();
            showToast('Registration successful! Welcome to ReciteRecipe!', 'success');
            showHome();
        } else {
            throw new Error(result.error || 'Registration failed');
        }
    } catch (error) {
        showError(error);
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateUIForGuest();
    showToast('Logged out successfully', 'info');
    showHome();
}

// ============ VIEW MANAGEMENT ============

function loadView() {
    const hash = window.location.hash.slice(1);
    const path = hash.split('/')[0];
    
    switch(path) {
        case 'login':
            showLogin();
            break;
        case 'register':
            showRegister();
            break;
        case 'create-recipe':
            showCreateRecipe();
            break;
        case 'edit-recipe':
            const editId = hash.split('/')[1];
            if (editId) showEditRecipe(editId);
            else showHome();
            break;
        case 'recipe':
            const recipeId = hash.split('/')[1];
            if (recipeId) showRecipeDetail(recipeId);
            else showHome();
            break;
        case 'my-recipes':
            showMyRecipes();
            break;
        case 'admin':
            showAdminPanel();
            break;
        default:
            showHome();
    }
}

function renderTemplate(templateId) {
    const template = document.getElementById(templateId);
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
}

function showHome() {
    window.history.pushState({}, '', '#');
    renderTemplate('home-template');
    loadRecipes();
    if (authToken) {
        setTimeout(() => {
            const createBtn = document.getElementById('create-recipe-btn');
            if (createBtn) createBtn.style.display = 'block';
        }, 100);
    }
}

function showLogin() {
    if (authToken) {
        showHome();
        return;
    }
    window.history.pushState({}, '', '#login');
    renderTemplate('login-template');
}

function showRegister() {
    if (authToken) {
        showHome();
        return;
    }
    window.history.pushState({}, '', '#register');
    renderTemplate('register-template');
}

function showCreateRecipe() {
    if (!authToken) {
        showToast('Please login to create a recipe', 'warning');
        showLogin();
        return;
    }
    window.history.pushState({}, '', '#create-recipe');
    renderTemplate('recipe-form-template');
}

async function showEditRecipe(recipeId) {
    if (!authToken) {
        showToast('Please login to edit a recipe', 'warning');
        showLogin();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/recipes/${recipeId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Recipe not found');
        }
        
        const data = await response.json();
        const recipe = data.recipe;
        
        // Check authorization
        if (recipe.user_id !== currentUser.id && currentUser.role !== 'admin') {
            showToast('Not authorized to edit this recipe', 'danger');
            showHome();
            return;
        }
        
        window.history.pushState({}, '', `#edit-recipe/${recipeId}`);
        renderTemplate('recipe-form-template');
        
        document.getElementById('recipe-form-title').textContent = 'Edit Recipe';
        document.getElementById('recipe-id').value = recipe.id;
        document.querySelector('[name="title"]').value = recipe.title;
        document.getElementById('description-editor').innerHTML = recipe.description;
        
        if (recipe.image_url) {
            document.getElementById('image-url-hidden').value = recipe.image_url;
            document.getElementById('image-type-hidden').value = recipe.image_type;
            showImagePreview(recipe.image_url);
        }
    } catch (error) {
        showError(error);
        showHome();
    }
}

async function showRecipeDetail(recipeId) {
    window.history.pushState({}, '', `#recipe/${recipeId}`);
    renderTemplate('recipe-detail-template');
    
    try {
        const response = await fetch(`${API_URL}/api/recipes/${recipeId}`);
        
        if (!response.ok) {
            throw new Error('Recipe not found');
        }
        
        const data = await response.json();
        const recipe = data.recipe;
        
        document.getElementById('recipe-detail-title').textContent = recipe.title;
        
        const canEdit = currentUser && (recipe.user_id === currentUser.id || currentUser.role === 'admin');
        
        document.getElementById('recipe-detail-content').innerHTML = `
            <div class="card shadow">
                ${recipe.image_url ? `
                    <img src="${recipe.image_url}" class="recipe-detail-image" alt="${recipe.title}">
                ` : ''}
                <div class="card-body p-5">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <div>
                            <h1>${recipe.title}</h1>
                            <p class="text-muted">
                                <i class="bi bi-person"></i> By ${recipe.author_name}
                                <span class="mx-2">|</span>
                                <i class="bi bi-calendar"></i> ${new Date(recipe.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        ${canEdit ? `
                            <div class="dropdown">
                                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    <i class="bi bi-three-dots-vertical"></i>
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><a class="dropdown-item" href="#" onclick="showEditRecipe(${recipe.id})">
                                        <i class="bi bi-pencil"></i> Edit
                                    </a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item text-danger" href="#" onclick="deleteRecipe(${recipe.id})">
                                        <i class="bi bi-trash"></i> Delete
                                    </a></li>
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                    <hr>
                    <div class="recipe-description">
                        ${recipe.description}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        showError(error);
        showHome();
    }
}

async function showMyRecipes() {
    if (!authToken) {
        showToast('Please login to view your recipes', 'warning');
        showLogin();
        return;
    }
    
    window.history.pushState({}, '', '#my-recipes');
    renderTemplate('home-template');
    
    document.querySelector('.hero-section').style.display = 'none';
    document.querySelector('h2').textContent = 'My Recipes';
    
    loadRecipes(currentUser.id);
}

async function showAdminPanel() {
    if (!authToken || currentUser?.role !== 'admin') {
        showToast('Admin access required', 'danger');
        showHome();
        return;
    }
    
    window.history.pushState({}, '', '#admin');
    renderTemplate('admin-template');
    
    await loadAdminData();
}

// ============ RECIPE OPERATIONS ============

async function loadRecipes(userId = null) {
    const loadingEl = document.getElementById('recipes-loading');
    const containerEl = document.getElementById('recipes-container');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (containerEl) containerEl.innerHTML = '';
    
    try {
        let url = `${API_URL}/api/recipes`;
        if (userId) url += `?userId=${userId}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (data.recipes.length === 0) {
            if (containerEl) {
                containerEl.innerHTML = `
                    <div class="col-12">
                        <div class="empty-state">
                            <i class="bi bi-journal-x"></i>
                            <h4>No recipes found</h4>
                            <p>${userId ? 'You haven\'t created any recipes yet.' : 'Be the first to share a recipe!'}</p>
                            ${authToken ? `<button class="btn btn-primary" onclick="showCreateRecipe()">Create Recipe</button>` : ''}
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        if (containerEl) {
            containerEl.innerHTML = data.recipes.map(recipe => `
                <div class="col-md-4 col-lg-3">
                    <div class="card recipe-card h-100" onclick="showRecipeDetail(${recipe.id})" style="cursor: pointer;">
                        <div class="recipe-image-container">
                            ${recipe.image_url ? 
                                `<img src="${recipe.image_url}" class="card-img-top" alt="${recipe.title}">` :
                                `<div class="bg-light d-flex align-items-center justify-content-center" style="height: 200px;">
                                    <i class="bi bi-image text-muted" style="font-size: 3rem;"></i>
                                </div>`
                            }
                        </div>
                        <div class="card-body">
                            <h5 class="card-title">${recipe.title}</h5>
                            <p class="card-text text-muted small">
                                <i class="bi bi-person"></i> ${recipe.author_name}
                            </p>
                            <p class="card-text text-muted small">
                                <i class="bi bi-calendar"></i> ${new Date(recipe.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        if (loadingEl) loadingEl.style.display = 'none';
        showError(error);
    }
}

async function searchRecipes() {
    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        loadRecipes();
        return;
    }
    
    const containerEl = document.getElementById('recipes-container');
    const loadingEl = document.getElementById('recipes-loading');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (containerEl) containerEl.innerHTML = '';
    
    try {
        const response = await fetch(`${API_URL}/api/recipes?search=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (data.recipes.length === 0) {
            if (containerEl) {
                containerEl.innerHTML = `
                    <div class="col-12">
                        <div class="empty-state">
                            <i class="bi bi-search"></i>
                            <h4>No recipes found</h4>
                            <p>No recipes match "${searchTerm}"</p>
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        if (containerEl) {
            containerEl.innerHTML = data.recipes.map(recipe => `
                <div class="col-md-4 col-lg-3">
                    <div class="card recipe-card h-100" onclick="showRecipeDetail(${recipe.id})" style="cursor: pointer;">
                        <div class="recipe-image-container">
                            ${recipe.image_url ? 
                                `<img src="${recipe.image_url}" class="card-img-top" alt="${recipe.title}">` :
                                `<div class="bg-light d-flex align-items-center justify-content-center" style="height: 200px;">
                                    <i class="bi bi-image text-muted" style="font-size: 3rem;"></i>
                                </div>`
                            }
                        </div>
                        <div class="card-body">
                            <h5 class="card-title">${recipe.title}</h5>
                            <p class="card-text text-muted small">
                                <i class="bi bi-person"></i> ${recipe.author_name}
                            </p>
                            <p class="card-text text-muted small">
                                <i class="bi bi-calendar"></i> ${new Date(recipe.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        if (loadingEl) loadingEl.style.display = 'none';
        showError(error);
    }
}

async function handleRecipeSubmit(event) {
    event.preventDefault();
    hideError();
    
    const formData = new FormData(event.target);
    const description = document.getElementById('description-editor').innerHTML;
    document.getElementById('description-input').value = description;
    
    const recipeId = formData.get('recipeId');
    const data = {
        title: formData.get('title'),
        description: description,
        image_url: formData.get('image_url') || null,
        image_type: formData.get('image_type') || 'upload'
    };
    
    try {
        const url = recipeId ? `${API_URL}/api/recipes/${recipeId}` : `${API_URL}/api/recipes`;
        const method = recipeId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(recipeId ? 'Recipe updated successfully!' : 'Recipe created successfully!', 'success');
            showHome();
        } else {
            throw new Error(result.error || 'Failed to save recipe');
        }
    } catch (error) {
        showError(error);
    }
}

async function deleteRecipe(recipeId) {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/recipes/${recipeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Recipe deleted successfully', 'success');
            showHome();
        } else {
            throw new Error(result.error || 'Failed to delete recipe');
        }
    } catch (error) {
        showError(error);
    }
}

// ============ IMAGE HANDLING ============

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    hideError();
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const response = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('image-url-hidden').value = result.imageUrl;
            document.getElementById('image-type-hidden').value = 'upload';
            showImagePreview(result.imageUrl);
            showToast('Image uploaded successfully', 'success');
        } else {
            throw new Error(result.error || 'Failed to upload image');
        }
    } catch (error) {
        showError(error);
    }
}

async function importImageFromUrl() {
    const urlInput = document.getElementById('image-url-input');
    const imageUrl = urlInput.value.trim();
    
    if (!imageUrl) {
        showToast('Please enter an image URL', 'warning');
        return;
    }
    
    hideError();
    
    try {
        const response = await fetch(`${API_URL}/api/import-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ imageUrl })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('image-url-hidden').value = result.imageUrl;
            document.getElementById('image-type-hidden').value = 'upload';
            showImagePreview(result.imageUrl);
            showToast('Image imported successfully', 'success');
            urlInput.value = '';
        } else {
            throw new Error(result.error || 'Failed to import image');
        }
    } catch (error) {
        showError(error);
    }
}

function showImagePreview(imageUrl) {
    const container = document.getElementById('image-preview-container');
    container.innerHTML = `
        <div class="mt-3">
            <label class="form-label">Image Preview</label>
            <img src="${imageUrl}" class="image-preview" alt="Preview">
            <button type="button" class="btn btn-sm btn-outline-danger mt-2" onclick="removeImage()">
                <i class="bi bi-trash"></i> Remove Image
            </button>
        </div>
    `;
}

function removeImage() {
    document.getElementById('image-url-hidden').value = '';
    document.getElementById('image-type-hidden').value = 'upload';
    document.getElementById('image-preview-container').innerHTML = '';
    document.getElementById('image-file').value = '';
    document.getElementById('image-url-input').value = '';
}

// ============ RICH TEXT EDITOR ============

function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('description-editor').focus();
}

function createLink() {
    const url = prompt('Enter URL:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
    document.getElementById('description-editor').focus();
}

// ============ ADMIN PANEL ============

async function loadAdminData() {
    try {
        // Load users
        const usersResponse = await fetch(`${API_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!usersResponse.ok) {
            throw new Error('Failed to load users');
        }
        
        const usersData = await usersResponse.json();
        renderUsersTable(usersData.users);
        
        // Load all recipes
        const recipesResponse = await fetch(`${API_URL}/api/admin/recipes`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!recipesResponse.ok) {
            throw new Error('Failed to load recipes');
        }
        
        const recipesData = await recipesResponse.json();
        renderAdminRecipesTable(recipesData.recipes);
        
    } catch (error) {
        showError(error);
    }
}

function renderUsersTable(users) {
    const totalUsers = users.length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalRegularUsers = totalUsers - totalAdmins;
    
    document.getElementById('total-users').textContent = totalUsers;
    document.getElementById('total-admins').textContent = totalAdmins;
    document.getElementById('total-regular-users').textContent = totalRegularUsers;
    
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>
                ${user.role === 'admin' ? 
                    `<span class="admin-badge">Admin</span>` : 
                    `<span class="user-badge">User</span>`
                }
            </td>
            <td>${user.recipe_count}</td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
            <td>
                ${user.id !== currentUser.id ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                ` : '<span class="text-muted">You</span>'}
            </td>
        </tr>
    `).join('');
}

function renderAdminRecipesTable(recipes) {
    document.getElementById('admin-total-recipes').textContent = recipes.length;
    
    const tbody = document.getElementById('admin-recipes-table-body');
    tbody.innerHTML = recipes.map(recipe => `
        <tr>
            <td>${recipe.id}</td>
            <td>
                ${recipe.image_url ? 
                    `<img src="${recipe.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` :
                    '<span class="text-muted">No image</span>'
                }
            </td>
            <td>${recipe.title}</td>
            <td>${recipe.author_name}</td>
            <td>${new Date(recipe.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="adminDeleteRecipe(${recipe.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? All their recipes will also be deleted. This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('User deleted successfully', 'success');
            loadAdminData();
        } else {
            throw new Error(result.error || 'Failed to delete user');
        }
    } catch (error) {
        showError(error);
    }
}

async function adminDeleteRecipe(recipeId) {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/admin/recipes/${recipeId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Recipe deleted successfully', 'success');
            loadAdminData();
        } else {
            throw new Error(result.error || 'Failed to delete recipe');
        }
    } catch (error) {
        showError(error);
    }
}

// ============ ERROR HANDLING ============

function showError(error) {
    console.error('Error:', error);
    
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    
    let errorText = '';
    if (typeof error === 'string') {
        errorText = error;
    } else if (error.message) {
        errorText = `Message: ${error.message}\n\n`;
        if (error.stack) {
            errorText += `Stack Trace:\n${error.stack}`;
        }
    } else {
        errorText = JSON.stringify(error, null, 2);
    }
    
    errorMessage.textContent = errorText;
    errorContainer.style.display = 'block';
    
    // Scroll to error
    errorContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideError() {
    const errorContainer = document.getElementById('error-container');
    errorContainer.style.display = 'none';
}

// ============ TOAST NOTIFICATIONS ============

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    const toastId = 'toast-' + Date.now();
    
    const bgClass = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning text-dark',
        'info': 'bg-info text-dark'
    }[type] || 'bg-info';
    
    const icon = {
        'success': 'bi-check-circle',
        'danger': 'bi-exclamation-circle',
        'warning': 'bi-exclamation-triangle',
        'info': 'bi-info-circle'
    }[type] || 'bi-info-circle';
    
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center ${bgClass} text-white border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi ${icon}"></i> ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Handle Enter key in search
window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'search-input') {
        searchRecipes();
    }
});
