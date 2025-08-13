const MTProto = require('@mtproto/core');

class MTProtoService {
  constructor() {
    this.api_id = parseInt(process.env.TELEGRAM_API_ID);
    this.api_hash = process.env.TELEGRAM_API_HASH;
    this.phone = process.env.TELEGRAM_PHONE;
    
    if (!this.api_id || !this.api_hash || !this.phone) {
      throw new Error('Missing required environment variables: TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_PHONE');
    }
    
    this.mtproto = new MTProto({
      api_id: this.api_id,
      api_hash: this.api_hash,
      
      // Anti-detection
      device_model: this.getRandomDevice(),
      system_version: this.getRandomOS(),
      app_version: this.getRandomAppVersion(),
      lang_code: 'en',
      
      // Use memory storage for serverless
      storageOptions: {
        instance: 'memory',
      },
    });
    
    this.isAuthenticated = false;
    this.lastActivity = Date.now();
    this.rateLimits = new Map();
    
    console.log('🔧 MTProto Service initialized');
  }
  
  getRandomDevice() {
    const devices = [
      'Samsung Galaxy S21', 'iPhone 13 Pro', 'Pixel 6', 
      'OnePlus 9 Pro', 'Xiaomi Mi 11', 'iPhone 14'
    ];
    return devices[Math.floor(Math.random() * devices.length)];
  }
  
  getRandomOS() {
    const versions = [
      'Android 12.0', 'iOS 15.4', 'Android 11.0', 
      'iOS 14.8', 'Android 13.0', 'iOS 16.0'
    ];
    return versions[Math.floor(Math.random() * versions.length)];
  }
  
  getRandomAppVersion() {
    return `8.${Math.floor(Math.random() * 9)}.${Math.floor(Math.random() * 10)}`;
  }
  
  getRandomDelay(min = 1000, max = 5000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  checkRateLimit(userId) {
    const now = Date.now();
    const userLimits = this.rateLimits.get(userId) || [];
    
    // Clean old entries
    const recentRequests = userLimits.filter(time => now - time < 3600000);
    
    if (recentRequests.length >= 30) {
      return false;
    }
    
    recentRequests.push(now);
    this.rateLimits.set(userId, recentRequests);
    return true;
  }
  
  async simulateTyping(peer, message) {
    try {
      const typingDuration = Math.min(message.length * 50 + Math.random() * 1000, 5000);
      
      await this.mtproto.call('messages.setTyping', {
        peer: peer,
        action: { _: 'sendMessageTypingAction' }
      });
      
      await this.sleep(typingDuration);
      
      await this.mtproto.call('messages.setTyping', {
        peer: peer,
        action: { _: 'sendMessageCancelAction' }
      });
      
      await this.sleep(this.getRandomDelay(200, 800));
      
    } catch (error) {
      console.warn('⚠️ Typing simulation failed:', error.message);
    }
  }
  
  async initialize() {
    try {
      const authResult = await this.mtproto.call('users.getFullUser', {
        id: { _: 'inputUserSelf' }
      });
      
      this.isAuthenticated = true;
      console.log('✅ MTProto authenticated');
      return authResult;
      
    } catch (error) {
      if (error.error_message === 'AUTH_KEY_UNREGISTERED') {
        console.log('🔐 Authentication required');
        throw new Error('Authentication required');
      }
      throw error;
    }
  }
  
  async sendCode(phoneNumber) {
    console.log('📱 Sending auth code...');
    return await this.mtproto.call('auth.sendCode', {
      phone_number: phoneNumber,
      settings: { _: 'codeSettings' },
    });
  }
  
  async signIn(phoneNumber, phoneCodeHash, phoneCode) {
    console.log('🔐 Signing in...');
    const result = await this.mtproto.call('auth.signIn', {
      phone_number: phoneNumber,
      phone_code_hash: phoneCodeHash,
      phone_code: phoneCode,
    });
    
    this.isAuthenticated = true;
    return result;
  }
  
  async resolveUsername(username) {
    const cleanUsername = username.replace('@', '');
    console.log(`🔍 Resolving: ${cleanUsername}`);
    
    const result = await this.mtproto.call('contacts.resolveUsername', {
      username: cleanUsername
    });
    
    if (!result?.users?.[0]) {
      throw new Error('User not found');
    }
    
    return result.users[0];
  }
  
  async sendMessage(target, message, options = {}) {
    if (!this.checkRateLimit(target)) {
      throw new Error('Rate limit exceeded');
    }
    
    console.log(`📤 Sending to: ${target}`);
    
    // Resolve user
    const user = await this.resolveUsername(target);
    
    const peer = {
      _: 'inputPeerUser',
      user_id: user.id,
      access_hash: user.access_hash,
    };
    
    // Anti-detection: typing simulation
    if (options.simulateTyping !== false) {
      await this.simulateTyping(peer, message);
    }
    
    // Random delay
    await this.sleep(this.getRandomDelay(300, 1500));
    
    // Send message
    const result = await this.mtproto.call('messages.sendMessage', {
      peer: peer,
      message: message,
      random_id: BigInt(Math.floor(Math.random() * 0xFFFFFFFF)),
      no_webpage: Math.random() > 0.8,
      silent: Math.random() > 0.95,
    });
    
    console.log('✅ Message sent');
    await this.sleep(this.getRandomDelay(1000, 3000));
    
    return result;
  }
  
  getStatus() {
    return {
      authenticated: this.isAuthenticated,
      last_activity: new Date(this.lastActivity).toISOString(),
      device_model: this.mtproto.options.device_model,
      app_version: this.mtproto.options.app_version
    };
  }
}

module.exports = MTProtoService;
