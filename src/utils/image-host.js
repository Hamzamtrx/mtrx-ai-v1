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
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async uploadToCatbox(filePath) {
    const FormData = (await import('formdata-node')).FormData;
    const { fileFromPath } = await import('formdata-node/file-from-path');

    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', await fileFromPath(filePath));

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form
    });

    if (!response.ok) {
      throw new Error('catbox upload failed: ' + response.status);
    }

    const url = await response.text();
    if (!url.startsWith('http')) {
      throw new Error('catbox returned invalid URL: ' + url);
    }
    return url.trim();
  }

  /**
   * Upload image with fallback to multiple services
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Public URL
   */
  static async upload(filePath) {
    const services = [
      { name: 'imgbb', fn: this.uploadToImgbb },
      { name: 'freeimage.host', fn: this.uploadToFreeImage },
      { name: 'catbox.moe', fn: this.uploadToCatbox },
      { name: 'file.io', fn: this.uploadToFileIO }
    ];

    for (const service of services) {
      try {
        console.log(`    Uploading to ${service.name}...`);
        const url = await service.fn(filePath);
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
