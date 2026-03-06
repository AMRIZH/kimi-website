const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'reciterecipe-secret-key-change-in-production';
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin-secret-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database tables
function initDatabase() {
    // Users table
    db.exec(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Recipes table
    db.exec(`CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        image_type TEXT DEFAULT 'upload',
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
}

initDatabase();

// Multer configuration for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed'));
    }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        stack: err.stack,
        details: err
    });
};

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res, next) => {
    try {
        const { username, email, password, adminCode } = req.body;

        if (!username || !email || !password) {
            throw new Error('Username, email, and password are required');
        }

        // Check if user exists
        const existingUser = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, email);

        if (existingUser) {
            throw new Error('Username or email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine role
        const role = (adminCode === ADMIN_CODE) ? 'admin' : 'user';

        // Insert user
        const result = db.prepare(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)'
        ).run(username, email, hashedPassword, role);

        // Generate token
        const token = jwt.sign(
            { id: result.lastInsertRowid, username, email, role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { id: result.lastInsertRowid, username, email, role }
        });
    } catch (err) {
        next(err);
    }
});

// Login
app.post('/api/auth/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            throw new Error('Username and password are required');
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            throw new Error('Invalid credentials');
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res, next) => {
    try {
        const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.user.id);

        if (!user) {
            throw new Error('User not found');
        }

        res.json({ user });
    } catch (err) {
        next(err);
    }
});

// ============ RECIPE ROUTES ============

// Get all recipes (with optional search)
app.get('/api/recipes', (req, res, next) => {
    try {
        const { search, userId } = req.query;
        let query = `
            SELECT r.*, u.username as author_name 
            FROM recipes r 
            JOIN users u ON r.user_id = u.id 
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND r.title LIKE ?`;
            params.push(`%${search}%`);
        }

        if (userId) {
            query += ` AND r.user_id = ?`;
            params.push(userId);
        }

        query += ` ORDER BY r.created_at DESC`;

        const recipes = db.prepare(query).all(...params);

        res.json({ recipes });
    } catch (err) {
        next(err);
    }
});

// Get single recipe
app.get('/api/recipes/:id', (req, res, next) => {
    try {
        const recipe = db.prepare(`
            SELECT r.*, u.username as author_name 
            FROM recipes r 
            JOIN users u ON r.user_id = u.id 
            WHERE r.id = ?
        `).get(req.params.id);

        if (!recipe) {
            throw new Error('Recipe not found');
        }

        res.json({ recipe });
    } catch (err) {
        next(err);
    }
});

// Create recipe
app.post('/api/recipes', authenticateToken, (req, res, next) => {
    try {
        const { title, description, image_url, image_type } = req.body;

        if (!title || !description) {
            throw new Error('Title and description are required');
        }

        const result = db.prepare(
            'INSERT INTO recipes (title, description, image_url, image_type, user_id) VALUES (?, ?, ?, ?, ?)'
        ).run(title, description, image_url || null, image_type || 'upload', req.user.id);

        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(result.lastInsertRowid);

        res.status(201).json({ message: 'Recipe created successfully', recipe });
    } catch (err) {
        next(err);
    }
});

// Update recipe
app.put('/api/recipes/:id', authenticateToken, (req, res, next) => {
    try {
        const { title, description, image_url, image_type } = req.body;

        // Check ownership
        const existingRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

        if (!existingRecipe) {
            throw new Error('Recipe not found');
        }

        if (existingRecipe.user_id !== req.user.id && req.user.role !== 'admin') {
            throw new Error('Not authorized to edit this recipe');
        }

        db.prepare(
            'UPDATE recipes SET title = ?, description = ?, image_url = ?, image_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(title, description, image_url || null, image_type || 'upload', req.params.id);

        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

        res.json({ message: 'Recipe updated successfully', recipe });
    } catch (err) {
        next(err);
    }
});

// Delete recipe
app.delete('/api/recipes/:id', authenticateToken, (req, res, next) => {
    try {
        // Check ownership
        const existingRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

        if (!existingRecipe) {
            throw new Error('Recipe not found');
        }

        if (existingRecipe.user_id !== req.user.id && req.user.role !== 'admin') {
            throw new Error('Not authorized to delete this recipe');
        }

        // Delete associated image if it's an upload
        if (existingRecipe.image_type === 'upload' && existingRecipe.image_url) {
            const imagePath = path.join(uploadsDir, path.basename(existingRecipe.image_url));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);

        res.json({ message: 'Recipe deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// Upload image
app.post('/api/upload', authenticateToken, upload.single('image'), (req, res, next) => {
    try {
        if (!req.file) {
            throw new Error('No image file uploaded');
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ imageUrl, filename: req.file.filename });
    } catch (err) {
        next(err);
    }
});

// Import image from URL
app.post('/api/import-image', authenticateToken, async (req, res, next) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            throw new Error('Image URL is required');
        }

        // Validate URL
        const url = new URL(imageUrl);
        const protocol = url.protocol === 'https:' ? https : http;

        // Download image
        const filename = `${uuidv4()}.jpg`;
        const filepath = path.join(uploadsDir, filename);

        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filepath);
            protocol.get(imageUrl, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(filepath, () => {});
                reject(err);
            });
        });

        const localImageUrl = `/uploads/${filename}`;
        res.json({ imageUrl: localImageUrl, filename });
    } catch (err) {
        next(err);
    }
});

// ============ ADMIN ROUTES ============

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res, next) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.email, u.role, u.created_at,
                   COUNT(r.id) as recipe_count
            FROM users u
            LEFT JOIN recipes r ON u.id = r.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `).all();

        res.json({ users });
    } catch (err) {
        next(err);
    }
});

// Get all recipes for admin (admin only)
app.get('/api/admin/recipes', authenticateToken, requireAdmin, (req, res, next) => {
    try {
        const recipes = db.prepare(`
            SELECT r.*, u.username as author_name 
            FROM recipes r 
            JOIN users u ON r.user_id = u.id 
            ORDER BY r.created_at DESC
        `).all();

        res.json({ recipes });
    } catch (err) {
        next(err);
    }
});

// Delete any recipe (admin only)
app.delete('/api/admin/recipes/:id', authenticateToken, requireAdmin, (req, res, next) => {
    try {
        const existingRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);

        if (!existingRecipe) {
            throw new Error('Recipe not found');
        }

        // Delete associated image if it's an upload
        if (existingRecipe.image_type === 'upload' && existingRecipe.image_url) {
            const imagePath = path.join(uploadsDir, path.basename(existingRecipe.image_url));
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);

        res.json({ message: 'Recipe deleted successfully by admin' });
    } catch (err) {
        next(err);
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res, next) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (parseInt(userId) === req.user.id) {
            throw new Error('Cannot delete your own admin account');
        }

        // Get all recipes by this user to delete images
        const recipes = db.prepare('SELECT * FROM recipes WHERE user_id = ?').all(userId);

        // Delete associated images
        for (const recipe of recipes) {
            if (recipe.image_type === 'upload' && recipe.image_url) {
                const imagePath = path.join(uploadsDir, path.basename(recipe.image_url));
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
        }

        // Delete user (recipes will be deleted via CASCADE)
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        res.json({ message: 'User and all their recipes deleted successfully' });
    } catch (err) {
        next(err);
    }
});

// ============ ERROR HANDLING ============

// Apply error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`ReciteRecipe server running on port ${PORT}`);
    console.log(`Database: ${dbPath}`);
    console.log(`Uploads directory: ${uploadsDir}`);
});

module.exports = app;
