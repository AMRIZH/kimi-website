# ReciteRecipe - Recipe Sharing Web Application

A production-ready, full-stack recipe sharing web application built with Node.js, Express, SQLite, and Bootstrap 5.

## Features

### Core Features
- **User Authentication**: Secure registration and login with JWT tokens
- **Two User Roles**: Regular users and administrators
- **Recipe Management**: Create, read, update, and delete recipes
- **Rich Text Editor**: Format recipe descriptions with bold, italic, links, lists
- **Image Support**: Upload images or import from external URLs
- **Search Functionality**: Search recipes by title
- **Admin Panel**: Manage all users and recipes at `/admin`

### Security Features
- Password hashing with bcrypt
- JWT-based authentication
- Protected API endpoints
- Role-based access control
- Input validation
- Secure file uploads

### Production Features
- Docker containerization
- Health checks
- Nginx reverse proxy (optional)
- Rate limiting
- Gzip compression
- Static file caching

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens), bcrypt
- **File Uploads**: Multer
- **Frontend**: HTML5, Bootstrap 5 (CDN), Vanilla JavaScript
- **Containerization**: Docker, Docker Compose

## Quick Start

### Using Docker (Recommended)

1. **Clone and navigate to the project:**
   ```bash
   cd reciterecipe
   ```

2. **Set environment variables (optional):**
   ```bash
   export JWT_SECRET="your-secure-jwt-secret"
   export ADMIN_CODE="your-admin-registration-code"
   ```

3. **Build and run with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - App: http://localhost:3000
   - API: http://localhost:3000/api

5. **To stop:**
   ```bash
   docker-compose down
   ```

### Running Locally (Development)

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

3. **Access the application:**
   - Open http://localhost:3000 in your browser

## Usage Guide

### Regular User

1. **Register**: Create an account at `/register`
2. **Login**: Sign in at `/login`
3. **Browse Recipes**: View all recipes on the home page
4. **Search**: Use the search bar to find recipes by title
5. **Create Recipe**: Click "Add Recipe" to create a new recipe
   - Add title and formatted description
   - Upload an image or paste an external URL
6. **Manage Your Recipes**: View and edit your recipes from "My Recipes"

### Admin User

1. **Register as Admin**: Use the admin code during registration
2. **Access Admin Panel**: Navigate to `/admin`
3. **Manage Users**: View all users, see their recipe counts, delete users
4. **Manage All Recipes**: View and delete any recipe on the platform

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Recipes
- `GET /api/recipes` - Get all recipes (optional: `?search=term&userId=id`)
- `GET /api/recipes/:id` - Get single recipe
- `POST /api/recipes` - Create recipe (requires auth)
- `PUT /api/recipes/:id` - Update recipe (requires auth, owner or admin)
- `DELETE /api/recipes/:id` - Delete recipe (requires auth, owner or admin)

### Image Handling
- `POST /api/upload` - Upload image file (requires auth)
- `POST /api/import-image` - Import image from URL (requires auth)

### Admin (requires admin role)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/recipes` - Get all recipes
- `DELETE /api/admin/users/:id` - Delete any user
- `DELETE /api/admin/recipes/:id` - Delete any recipe

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `DB_PATH` | SQLite database file path | ./backend/database.sqlite |
| `JWT_SECRET` | Secret key for JWT tokens | Change in production |
| `ADMIN_CODE` | Code required for admin registration | admin-secret-2024 |
| `NODE_ENV` | Environment mode | production |

## Docker Configuration

### Basic Setup
```bash
docker-compose up -d
```

### With Nginx Reverse Proxy
```bash
docker-compose --profile with-nginx up -d
```

### Rebuild after changes
```bash
docker-compose up -d --build
```

### View logs
```bash
docker-compose logs -f reciterecipe
```

## Project Structure

```
reciterecipe/
├── backend/
│   ├── server.js          # Main Express application
│   ├── package.json       # Backend dependencies
│   └── database.sqlite    # SQLite database (created on first run)
├── frontend/
│   ├── index.html         # Main HTML file
│   └── app.js             # Frontend JavaScript
├── uploads/               # Uploaded images
├── data/                  # Persistent data (Docker)
├── nginx/
│   └── nginx.conf         # Nginx configuration
├── Dockerfile             # Docker build instructions
├── docker-compose.yaml    # Docker Compose configuration
└── README.md              # This file
```

## Error Handling

The application displays full error stack traces and details directly to the user for debugging purposes. This includes:
- Database errors
- Validation errors
- File upload errors
- Network errors
- Authentication errors

## Security Considerations

For production deployment:

1. **Change default secrets:**
   - Set a strong `JWT_SECRET`
   - Change the `ADMIN_CODE`

2. **Use HTTPS:**
   - Configure SSL certificates in Nginx
   - Or use a reverse proxy with SSL termination

3. **Database:**
   - Consider migrating to PostgreSQL or MySQL for high traffic
   - Regular backups of the SQLite database

4. **File uploads:**
   - Uploaded files are stored in `/uploads`
   - File types are validated (jpg, png, gif, webp)
   - File size limit: 10MB

## Troubleshooting

### Database locked error
- SQLite doesn't handle concurrent writes well
- Consider using PostgreSQL for high-traffic production

### File upload fails
- Check uploads directory permissions
- Verify file size is under 10MB
- Ensure file type is supported

### Cannot connect to server
- Verify port 3000 is not in use
- Check Docker container is running: `docker ps`
- View logs: `docker-compose logs reciterecipe`

## License

MIT License - Feel free to use and modify as needed.

## Support

For issues or questions, please check the logs first using the error display feature built into the application.
