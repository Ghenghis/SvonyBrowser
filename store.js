const electron = require('electron');
const path = require('path');
const fs = require('fs');

class Store {
  constructor(opts) {
    const userDataPath = (electron.app || electron.remote.app).getPath('userData');
    this.path = path.join(userDataPath, opts.configName + '.json');
    this.defaults = opts.defaults || {};
    this.data = parseDataFile(this.path, this.defaults);
  }
  
  get(key) {
    return this.data[key];
  }
  
  getAll() {
    return this.data;
  }
  
  set(key, val) {
    this.data[key] = val;
    this.save();
  }
  
  setMultiple(obj) {
    Object.assign(this.data, obj);
    this.save();
  }
  
  delete(key) {
    delete this.data[key];
    this.save();
  }
  
  clear() {
    this.data = {};
    this.save();
  }
  
  reset() {
    this.data = JSON.parse(JSON.stringify(this.defaults));
    this.save();
    return this.data;
  }
  
  has(key) {
    return key in this.data;
  }
  
  save() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Failed to save store:', error);
    }
  }
}

function parseDataFile(filePath, defaults) {
  try {
    return JSON.parse(fs.readFileSync(filePath));
  } catch(error) {
    return defaults;
  }
}

module.exports = Store;