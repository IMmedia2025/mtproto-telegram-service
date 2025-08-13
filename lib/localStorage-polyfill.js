// lib/localStorage-polyfill.js
// LocalStorage polyfill for Node.js environment

class LocalStoragePolyfill {
  constructor() {
    this.data = new Map();
    console.log('📦 LocalStorage polyfill initialized');
  }

  getItem(key) {
    const value = this.data.get(key);
    return value !== undefined ? value : null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }

  key(index) {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }

  get length() {
    return this.data.size;
  }

  // Additional methods that MTProto might need
  get(key) {
    return this.getItem(key);
  }

  set(key, value) {
    this.setItem(key, value);
  }
}

// Create global localStorage and sessionStorage if they don't exist
if (typeof global !== 'undefined') {
  if (!global.localStorage) {
    global.localStorage = new LocalStoragePolyfill();
    console.log('✅ Global localStorage polyfill created');
  }
  
  if (!global.sessionStorage) {
    global.sessionStorage = new LocalStoragePolyfill();
    console.log('✅ Global sessionStorage polyfill created');
  }

  // Also add to globalThis for modern Node.js
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.localStorage) {
      globalThis.localStorage = global.localStorage;
    }
    if (!globalThis.sessionStorage) {
      globalThis.sessionStorage = global.sessionStorage;
    }
  }
}

module.exports = LocalStoragePolyfill;
