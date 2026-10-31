const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const ApiError = require('./utils/apiError');

const app = express();

// 1. Security Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to allow CDN styles (e.g. Google Fonts) and inline scripts in vanilla client
  })
);

// 2. CORS Configuration
const allowedOrigins = [env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5000'];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin static files)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// 3. Body and Cookie Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.COOKIE_SECRET));

// 4. Static Frontend Assets Serving
const clientPath = path.resolve(__dirname, '../../client');
app.use(express.static(clientPath));

// 5. API Routes
app.use('/api', apiRoutes);

// 6. Handle 404 for undefined API endpoints
app.use('/api', (req, res, next) => {
  next(ApiError.notFound(`API endpoint ${req.method} ${req.originalUrl} not found`));
});

// 7. Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
