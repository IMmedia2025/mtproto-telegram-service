const MTProto = require('@mtproto/core');

class MTProtoService {
  constructor() {
    console.log('🔧 Initializing MTProto Service...');
    
    // Verify polyfills are available
    console.log('🔍 Checking global.localStorage:', typeof global.localStorage);
    console.log('🔍 Checking global.localStorage.get:', typeof global.localStorage?.get);
    console.log('🔍 Checking global.sessionStorage:', typeof global.sessionStorage);
    
    this.api_id = parseInt(process.env.TELEGRAM_API_ID);
    this.api_hash = process.env.TELEGRAM_API_HASH;
    this.phone = process.env.TELEGRAM_PHONE;
    
    console.log('📋 Environment check:', {
      api_id: this.api_id ? 'Set' : 'Missing',
      api_hash: this.api_hash ? 'Set' : 'Missing',
      phone: this.phone ? 'Set' : 'Missing'
    });
    
    if (!this.api_id || !this.api_hash || !this.phone) {
      const missing = [];
      if (!this.api_id) missing.push('TELEGRAM_API_ID');
      if (!this.api_hash) missing.push('TELEGRAM_API_HASH');
      if (!this.phone) missing.push('TELEGRAM_PHONE');
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Store device info for later use
    this.deviceModel = this.getRandomDevice();
    this.systemVersion = this.getRandomOS();
    this.appVersion = this.getRandomAppVersion();
    
    // Create in-memory storage for MTProto
    this.inMemoryStorage = new Map();
    
    try {
      console.log('🚀 Creating MTProto instance...');
      
      this.mtproto = new MTProto({
        api_id: this.api_id,
        api_hash: this.api_hash,
        
        // Anti-detection
        device_model: this.deviceModel,
        system_version: this.systemVersion,
        app_version: this.appVersion,
        lang_code: 'en',
        system_lang_code: 'en',
        
        // Use custom storage implementation
        storageOptions: {
          instance: this.createCustomStorage(),
        },
        
        // Additional options for stability
        server: {
          dev: false,
        },
      });
      
      console.log('✅ MTProto instance created successfully');
      console.log('📱 Device:', this.deviceModel);
      console.log('💾 App version:', this.appVersion);
      
    } catch (error) {
      console.error('❌ Failed to create MTProto instance:', error);
      throw new Error(`MTProto initialization failed: ${error.message}`);
    }
    
    this.isAuthenticated = false;
    this.lastActivity = Date.now();
    this.rateLimits = new Map();
    
    console.log('🎉 MTProto Service initialized successfully');
  }
  
  // Create custom storage implementation that doesn't rely on localStorage
  createCustomStorage() {
    const storage = this.inMemoryStorage;
    
    return {
      get: (key) => {
        console.log('🔍 Custom storage GET called with key:', key);
        const value = storage.get(key);
        console.log('🔍 Custom storage GET returning:', value ? 'data found' : 'null');
        return value || null;
      },
      
      set: (key, value) => {
        console.log('🔍 Custom storage SET called with key:', key);
        storage.set(key, value);
        return value;
      },
      
      delete: (key) => {
        console.log('🔍 Custom storage DELETE called with key:', key);
        return storage.delete(key);
      },
      
      clear: () => {
        console.log('🔍 Custom storage CLEAR called');
        storage.clear();
      },
      
      // Additional methods that might be needed
      getItem: (key) => {
        return storage.get(key) || null;
      },
      
      setItem: (key, value) => {
        storage.set(key, value);
      },
      
      removeItem: (key) => {
        storage.delete(key);
      },
      
      key: (index) => {
        const keys = Array.from(storage.keys());
        return keys[index] || null;
      },
      
      get length() {
        return storage.size;
      }
    };
  }
  
  getRandomDevice() {
    const devices = [
      'Samsung Galaxy S21', 
      'Samsung Galaxy S22',
      'iPhone 13 Pro', 
      'iPhone 14',
      'Pixel 6', 
      'Pixel 7',
      'OnePlus 9 Pro', 
      'OnePlus 10 Pro',
      'Xiaomi Mi 11', 
      'Xiaomi 12 Pro'
    ];
    return devices[Math.floor(Math.random() * devices.length)];
  }
  
  getRandomOS() {
    const androidVersions = [
      'Android 12.0', 
      'Android 11.0', 
      'Android 13.0',
      'Android 12.1',
      'Android 11.1'
    ];
    
    const iosVersions = [
      'iOS 15.4', 
      'iOS 15.5',
      'iOS 16.0',
      'iOS 15.6',
      'iOS 16.1'
    ];
    
    const allVersions = [...androidVersions, ...iosVersions];
    return allVersions[Math.floor(Math.random() * allVersions.length)];
  }
  
  getRandomAppVersion() {
    const major = Math.floor(Math.random() * 3) + 8; // 8-10
    const minor = Math.floor(Math.random() * 10); // 0-9
    const patch = Math.floor(Math.random() * 10); // 0-9
    return `${major}.${minor}.${patch}`;
  }
  
  getRandomDelay(min = 1000, max = 5000) {
    const baseDelay = Math.floor(Math.random() * (max - min + 1)) + min;
    const variance = Math.floor(Math.random() * 500) - 250; // ±250ms variance
    return Math.max(100, baseDelay + variance);
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  checkRateLimit(userId) {
    const now = Date.now();
    const userLimits = this.rateLimits.get(userId) || [];
    
    // Clean old entries (older than 1 hour)
    const recentRequests = userLimits.filter(time => now - time < 3600000);
    
    if (recentRequests.length >= 30) {
      console.warn(`⚠️ Rate limit exceeded for user: ${userId}`);
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimits.set(userId, recentRequests);
    return true;
  }
  
  async simulateTyping(peer, message) {
    try {
      // Calculate typing duration based on message length (human-like)
      const baseTypingTime = message.length * 50; // ~50ms per character
      const variance = Math.random() * 1000; // Random variance
      const typingDuration = Math.min(Math.max(baseTypingTime + variance, 1000), 5000);
      
      console.log(`💭 Simulating typing for ${typingDuration}ms...`);
      
      // Start typing indicator
      await this.mtproto.call('messages.setTyping', {
        peer: peer,
        action: { _: 'sendMessageTypingAction' }
      });
      
      // Wait for realistic typing duration
      await this.sleep(typingDuration);
      
      // Cancel typing indicator
      await this.mtproto.call('messages.setTyping', {
        peer: peer,
        action: { _: 'sendMessageCancelAction' }
      });
      
      // Small delay after stopping typing (human behavior)
      await this.sleep(this.getRandomDelay(200, 800));
      
    } catch (error) {
      console.warn('⚠️ Typing simulation failed:', error.message);
      // Don't throw error - typing simulation is optional
    }
  }
  
  async initialize() {
    try {
      console.log('🔄 Checking authentication status...');
      
      const authResult = await this.mtproto.call('users.getFullUser', {
        id: { _: 'inputUserSelf' }
      });
      
      this.isAuthenticated = true;
      console.log('✅ Already authenticated as:', authResult.users[0].first_name);
      return authResult;
      
    } catch (error) {
      console.log('🔐 Authentication check result:', error.error_message || error.message);
      
      if (error.error_message === 'AUTH_KEY_UNREGISTERED') {
        console.log('🔐 Authentication required - need to sign in first');
        this.isAuthenticated = false;
        throw new Error('Authentication required');
      }
      
      console.error('❌ MTProto initialization failed:', error);
      throw error;
    }
  }
  
  async sendCode(phoneNumber) {
    try {
      console.log('📱 Sending authentication code to:', phoneNumber);
      console.log('🔍 MTProto instance available:', !!this.mtproto);
      console.log('🔍 Storage available:', !!this.inMemoryStorage);
      
      const result = await this.mtproto.call('auth.sendCode', {
        phone_number: phoneNumber,
        settings: {
          _: 'codeSettings',
        },
      });
      
      console.log('✅ Code sent successfully');
      console.log('🔍 Result keys:', Object.keys(result));
      return result;
      
    } catch (error) {
      console.error('❌ Failed to send code:', error);
      console.error('❌ Error details:', {
        message: error.message,
        error_message: error.error_message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  async signIn(phoneNumber, phoneCodeHash, phoneCode) {
    try {
      console.log('🔐 Signing in with verification code...');
      
      const result = await this.mtproto.call('auth.signIn', {
        phone_number: phoneNumber,
        phone_code_hash: phoneCodeHash,
        phone_code: phoneCode,
      });
      
      this.isAuthenticated = true;
      console.log('✅ Signed in successfully as:', result.user.first_name);
      return result;
      
    } catch (error) {
      console.error('❌ Sign in failed:', error);
      throw error;
    }
  }
  
  async resolveUsername(username) {
    try {
      const cleanUsername = username.replace('@', '');
      console.log(`🔍 Resolving username: @${cleanUsername}`);
      
      const result = await this.mtproto.call('contacts.resolveUsername', {
        username: cleanUsername
      });
      
      if (!result || !result.users || result.users.length === 0) {
        throw new Error(`User @${cleanUsername} not found`);
      }
      
      console.log('✅ User resolved:', result.users[0].first_name || `@${cleanUsername}`);
      return result.users[0];
      
    } catch (error) {
      console.error(`❌ Failed to resolve username ${username}:`, error);
      throw error;
    }
  }
  
  async sendMessage(target, message, options = {}) {
    try {
      // Check rate limiting first
      const cleanTarget = target.replace('@', '');
      if (!this.checkRateLimit(cleanTarget)) {
        throw new Error('Rate limit exceeded. Max 30 messages per hour per recipient.');
      }
      
      console.log(`📤 Preparing to send message to: ${target}`);
      console.log(`📝 Message: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
      
      // Resolve target user
      const user = await this.resolveUsername(target);
      
      const peer = {
        _: 'inputPeerUser',
        user_id: user.id,
        access_hash: user.access_hash,
      };
      
      // Anti-detection: Simulate human behavior
      if (options.simulateTyping !== false) {
        await this.simulateTyping(peer, message);
      }
      
      // Anti-detection: Random pre-send delay
      const preSendDelay = this.getRandomDelay(300, 1500);
      console.log(`⏳ Pre-send delay: ${preSendDelay}ms`);
      await this.sleep(preSendDelay);
      
      // Send the message
      const result = await this.mtproto.call('messages.sendMessage', {
        peer: peer,
        message: message,
        random_id: BigInt(Math.floor(Math.random() * 0xFFFFFFFF)),
        
        // Anti-detection: Random message attributes
        no_webpage: Math.random() > 0.8, // Sometimes prevent link previews
        silent: Math.random() > 0.95,    // Rarely send silent messages
      });
      
      console.log('✅ Message sent successfully, ID:', result.id);
      
      // Anti-detection: Random post-send delay
      const postSendDelay = this.getRandomDelay(1000, 3000);
      console.log(`⏳ Post-send delay: ${postSendDelay}ms`);
      await this.sleep(postSendDelay);
      
      // Update last activity
      this.lastActivity = Date.now();
      
      return result;
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      throw error;
    }
  }
  
  async getDialogs(limit = 50) {
    try {
      console.log('📋 Fetching dialogs...');
      
      const result = await this.mtproto.call('messages.getDialogs', {
        offset_date: 0,
        offset_id: 0,
        offset_peer: { _: 'inputPeerEmpty' },
        limit: limit,
        hash: 0,
      });
      
      console.log(`✅ Retrieved ${result.dialogs.length} dialogs`);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to get dialogs:', error);
      throw error;
    }
  }
  
  getStatus() {
    try {
      return {
        authenticated: this.isAuthenticated,
        last_activity: new Date(this.lastActivity).toISOString(),
        device_model: this.deviceModel || 'Unknown',
        app_version: this.appVersion || 'Unknown',
        system_version: this.systemVersion || 'Unknown',
        mtproto_ready: !!this.mtproto,
        api_configured: !!(this.api_id && this.api_hash && this.phone),
        rate_limits_active: this.rateLimits.size,
        storage_entries: this.inMemoryStorage.size,
        localStorage_available: typeof global.localStorage !== 'undefined',
        custom_storage_available: true
      };
    } catch (error) {
      console.error('❌ Error getting status:', error);
      return {
        authenticated: false,
        last_activity: new Date().toISOString(),
        device_model: 'Error',
        app_version: 'Error',
        mtproto_ready: false,
        error: error.message
      };
    }
  }
  
  async cleanup() {
    try {
      console.log('🧹 Cleaning up MTProto service...');
      
      if (this.mtproto) {
        // Gracefully disconnect if needed
        // Note: @mtproto/core doesn't have a cleanup method
      }
      
      // Clear rate limits
      this.rateLimits.clear();
      
      // Clear storage
      this.inMemoryStorage.clear();
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

module.exports = MTProtoService;
