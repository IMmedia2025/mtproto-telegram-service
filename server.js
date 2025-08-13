require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch'); // Import node-fetch
const MTProtoService = require('./lib/mtproto-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Global MTProto service instance
let mtprotoService = null;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));

// Initialize MTProto service
async function initializeMTProto() {
  try {
    if (!mtprotoService) {
      console.log('🚀 Initializing MTProto service...');
      mtprotoService = new MTProtoService();
      await mtprotoService.initialize();
      console.log('✅ MTProto service ready');
    }
    return mtprotoService;
  } catch (error) {
    console.error('❌ MTProto initialization failed:', error);
    throw error;
  }
}

// Keep-alive endpoint (prevents Render sleep)
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const service = await initializeMTProto();
    const status = service.getStatus();
    
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      mtproto: status,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API key validation middleware
function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const apiKey = authHeader.substring(7);
  const validKey = process.env.API_SECRET_KEY;
  
  if (!validKey || apiKey !== validKey) {
    console.warn('⚠️ Invalid API key attempt:', apiKey.substring(0, 10) + '...');
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

// Send message endpoint
app.post('/api/send-message', validateApiKey, async (req, res) => {
  try {
    const { target, message, options = {} } = req.body;
    
    // Validate input
    if (!target || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['target', 'message']
      });
    }
    
    if (!target.match(/^@?[a-zA-Z0-9_]{5,32}$/)) {
      return res.status(400).json({
        error: 'Invalid target format. Use @username or username (5-32 characters)'
      });
    }
    
    if (message.length > 4096) {
      return res.status(400).json({
        error: 'Message too long. Maximum 4096 characters allowed.'
      });
    }
    
    console.log(`📤 Sending message to: ${target}`);
    
    // Get or initialize MTProto service
    const service = await initializeMTProto();
    
    // Send message using MTProto
    const result = await service.sendMessage(target, message, options);
    
    res.json({
      success: true,
      message_id: result.id,
      timestamp: new Date().toISOString(),
      metadata: {
        target: target,
        message_length: message.length,
        typing_simulated: options.simulateTyping !== false
      }
    });
    
  } catch (error) {
    console.error('❌ Send message error:', error);
    
    // Handle specific MTProto errors
    if (error.error_message) {
      if (error.error_message.includes('FLOOD_WAIT')) {
        const waitTime = parseInt(error.error_message.split('_')[2]) || 60;
        return res.status(429).json({
          error: 'Telegram rate limit exceeded',
          retry_after: waitTime,
          telegram_error: error.error_message
        });
      }
      
      if (error.error_message.includes('USER_BANNED')) {
        return res.status(403).json({
          error: 'Account banned',
          message: 'Telegram account has been banned',
          telegram_error: error.error_message
        });
      }
      
      if (error.error_message.includes('USERNAME_NOT_OCCUPIED')) {
        return res.status(404).json({
          error: 'User not found',
          telegram_error: error.error_message
        });
      }
      
      if (error.error_message.includes('AUTH_KEY_UNREGISTERED')) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please authenticate your Telegram account first',
          telegram_error: error.error_message
        });
      }
    }
    
    res.status(500).json({
      error: 'Failed to send message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication endpoints
app.post('/api/auth', validateApiKey, async (req, res) => {
  try {
    const { action, phone, code, phone_code_hash } = req.body;
    
    if (!action) {
      return res.status(400).json({
        error: 'Missing action parameter',
        valid_actions: ['send_code', 'sign_in', 'check_auth']
      });
    }
    
    const service = await initializeMTProto();
    
    switch (action) {
      case 'send_code':
        if (!phone) {
          return res.status(400).json({ error: 'Phone number required' });
        }
        
        console.log('📱 Attempting to send code to:', phone);
        const codeResult = await service.sendCode(phone);
        res.json({
          success: true,
          phone_code_hash: codeResult.phone_code_hash,
          message: 'Code sent to phone'
        });
        break;
        
      case 'sign_in':
        if (!phone || !code || !phone_code_hash) {
          return res.status(400).json({
            error: 'Missing required fields',
            required: ['phone', 'code', 'phone_code_hash']
          });
        }
        
        console.log('🔐 Attempting sign in for:', phone);
        const signInResult = await service.signIn(phone, phone_code_hash, code);
        res.json({
          success: true,
          message: 'Authentication successful',
          user: {
            id: signInResult.user.id,
            first_name: signInResult.user.first_name,
            username: signInResult.user.username
          }
        });
        break;
        
      case 'check_auth':
        console.log('🔍 Checking authentication status...');
        const status = service.getStatus();
        res.json({
          success: true,
          authenticated: status.authenticated,
          status: status
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
    
  } catch (error) {
    console.error('❌ Auth error:', error);
    
    if (error.error_message?.includes('PHONE_CODE_INVALID')) {
      return res.status(400).json({
        error: 'Invalid verification code',
        telegram_error: error.error_message
      });
    }
    
    if (error.error_message?.includes('PHONE_CODE_EXPIRED')) {
      return res.status(400).json({
        error: 'Verification code expired',
        message: 'Please request a new code',
        telegram_error: error.error_message
      });
    }
    
    if (error.error_message?.includes('SESSION_PASSWORD_NEEDED')) {
      return res.status(200).json({
        success: false,
        action: 'password_required',
        message: 'Two-factor authentication required'
      });
    }
    
    if (error.error_message?.includes('FLOOD_WAIT')) {
      const waitTime = parseInt(error.error_message.split('_')[2]) || 60;
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retry_after: waitTime,
        telegram_error: error.error_message
      });
    }
    
    res.status(500).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
});

// Keep-alive scheduler (prevents sleep)
if (process.env.NODE_ENV === 'production') {
  const keepAliveUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/ping`;
  
  setInterval(() => {
    // Self-ping to keep service alive
    fetch(keepAliveUrl)
      .then(response => {
        if (response.ok) {
          console.log('✅ Keep-alive ping successful');
        } else {
          console.warn('⚠️ Keep-alive ping failed:', response.status);
        }
      })
      .catch(err => {
        console.warn('⚠️ Keep-alive ping error:', err.message);
      });
  }, 14 * 60 * 1000); // Every 14 minutes
  
  console.log('🔄 Keep-alive scheduler started');
}

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /ping',
      'GET /api/health', 
      'POST /api/send-message',
      'POST /api/auth'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MTProto service running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 External hostname: ${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}`);
  
  // Initialize MTProto on startup
  initializeMTProto().catch(error => {
    console.error('❌ Failed to initialize MTProto on startup:', error);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  if (mtprotoService) {
    mtprotoService.cleanup();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  if (mtprotoService) {
    mtprotoService.cleanup();
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('🎯 Server setup complete, waiting for connections...');
