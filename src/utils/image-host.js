/**
 * Image Hosting Utility
 *
 * Uploads images to free hosting services for reliable API access.
 */

const fs = require('fs').promises;
const path = require('path');

class ImageHost {
  /**
   * Upload using imgbb (most reliable, free tier)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToImgbb(filePath) {
    const imageData = await fs.readFile(filePath);
    const base64 = imageData.toString('base64');

    const formData = new URLSearchParams();
    formData.append('image', base64);

    // Using free anonymous upload (no API key required for basic usage)
    const response = await fetch('https://api.imgbb.com/1/upload?key=d36eb6591370ae7f9089d85875e56b22', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error('imgbb upload failed: ' + (data.error?.message || 'Unknown error'));
    }

    return data.data.url;
  }

  /**
   * Upload to postimages.org (free, no API key)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToPostImages(filePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const form = new FormData();
    form.append('file', await fileFromPath(filePath));

    const response = await fetch('https://postimages.org/json/rr', {
      method: 'POST',
      body: form
    });

    const data = await response.json();

    if (!data.url) {
      throw new Error('postimages upload failed');
    }

    return data.url;
  }

  /**
   * Upload to freeimage.host (free, simple)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToFreeImage(filePath) {
    const imageData = await fs.readFile(filePath);
    const base64 = imageData.toString('base64');

    const formData = new URLSearchParams();
    formData.append('source', base64);
    formData.append('type', 'base64');
    formData.append('action', 'upload');
    formData.append('format', 'png'); // Force PNG format for better compatibility

    const response = await fetch('https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.status_code !== 200) {
      throw new Error('freeimage.host upload failed: ' + (data.error?.message || 'Unknown error'));
    }

    // Prefer the direct image URL in PNG format if available
    return data.image.url_viewer ? data.image.url : data.image.url;
  }

  /**
   * Upload image to file.io (free, temporary hosting)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToFileIO(filePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const form = new FormData();
    form.append('file', await fileFromPath(filePath));

    const response = await fetch('https://file.io', {
      method: 'POST',
      body: form
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('file.io returned invalid response');
    }

    if (!data.success) {
      throw new Error('file.io upload failed: ' + (data.message || 'Unknown error'));
    }

    return data.link;
  }

  /**
   * Upload image using catbox.moe (permanent, free)
   * Uses axios + form-data for proper multipart handling
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToCatbox(filePath) {
    const FormDataLib = require('form-data');
    const fsSync = require('fs');
    const axios = require('axios');

    const form = new FormDataLib();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fsSync.createReadStream(filePath));

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: {
        ...form.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const url = response.data;
    if (typeof url !== 'string' || !url.startsWith('http')) {
      throw new Error('catbox returned invalid URL: ' + url);
    }
    return url.trim();
  }

  /**
   * Upload to 0x0.st (simple, no API key required)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadTo0x0(filePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const form = new FormData();
    form.append('file', await fileFromPath(filePath));

    const response = await fetch('https://0x0.st', {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error('0x0.st upload failed: ' + response.status);
    }

    const url = await response.text();
    if (!url.startsWith('http')) {
      throw new Error('0x0.st returned invalid URL: ' + url);
    }
    return url.trim();
  }

  /**
   * Upload to litterbox.catbox.moe (temporary hosting, 72h, reliable)
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToLitterbox(filePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('time', '72h'); // Keep for 72 hours
    form.append('fileToUpload', await fileFromPath(filePath));

    const response = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error('litterbox upload failed: ' + response.status);
    }

    const url = await response.text();
    if (!url.startsWith('http')) {
      throw new Error('litterbox returned invalid URL: ' + url);
    }
    return url.trim();
  }

  /**
   * Upload with timeout wrapper
   */
  static async withTimeout(promise, ms, name) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out after ${ms/1000}s`)), ms)
      )
    ]);
  }

  /**
   * Upload image with fallback to multiple services
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async upload(filePath) {
    // Prioritize catbox first (confirmed working)
    const services = [
      { name: 'catbox.moe', fn: this.uploadToCatbox, timeout: 30000 },
      { name: '0x0.st', fn: this.uploadTo0x0, timeout: 30000 },
      { name: 'litterbox', fn: this.uploadToLitterbox, timeout: 30000 },
      { name: 'freeimage.host', fn: this.uploadToFreeImage, timeout: 60000 },
      { name: 'imgbb', fn: this.uploadToImgbb, timeout: 30000 },
      { name: 'file.io', fn: this.uploadToFileIO, timeout: 30000 }
    ];

    for (const service of services) {
      try {
        console.log(`    Uploading to ${service.name}...`);
        const url = await this.withTimeout(
          service.fn(filePath),
          service.timeout,
          service.name
        );
        console.log(`    Uploaded: ${url}`);
        return url;
      } catch (err) {
        console.log(`    ${service.name} failed: ${err.message}`);
      }
    }

    throw new Error('All image hosting services failed');
  }
}

module.exports = ImageHost;
