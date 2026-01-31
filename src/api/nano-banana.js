/**
 * Kie.ai Nano Banana Pro API Integration
 *
 * Handles all communication with the Nano Banana Pro image generation API.
 */

const KIE_API_URL = 'https://api.kie.ai/api/v1';

class NanoBananaAPI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate an image from a prompt
   * @param {Object} options
   * @param {string} options.prompt - The generation prompt
   * @param {string} options.referenceImageUrl - Public URL to reference image
   * @param {string} options.logoUrl - Public URL to logo image (optional)
   * @param {string} options.aspectRatio - Aspect ratio (1:1, 9:16, 16:9, 4:3, etc.)
   * @returns {Promise<Object>} - Generated image data
   */
  async generateImage({ prompt, referenceImageUrl, logoUrl = null, aspectRatio = '1:1' }) {
    // Build input payload
    const input = {
      prompt,
      aspect_ratio: aspectRatio,
      resolution: '2K',
      output_format: 'png',
      style_strength: 0.95,  // Maximum reference adherence
      creativity: 0.15       // Minimal deviation from reference
    };

    // Add reference image URLs if provided (product + optional logo)
    const imageInputs = [];
    if (referenceImageUrl) imageInputs.push(referenceImageUrl);
    if (logoUrl) imageInputs.push(logoUrl);

    if (imageInputs.length > 0) {
      input.image_input = imageInputs;
      input.image_strength = 0.95;  // Maximum reference adherence
    }

    const payload = {
      model: 'nano-banana-pro',
      input
    };

    try {
      console.log('    Sending to Kie.ai Nano Banana Pro API...');
      const response = await fetch(`${KIE_API_URL}/jobs/createTask`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kie.ai API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(`Kie.ai API Error: ${data.msg || data.message}`);
      }

      const taskId = data.data.taskId;
      console.log(`    Task created: ${taskId}`);

      // Poll for completion
      const result = await this.pollForResult(taskId);
      return result;

    } catch (error) {
      console.error('Nano Banana generation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Poll for task completion
   * @param {string} taskId - Task ID to poll
   * @param {number} maxAttempts - Maximum polling attempts
   * @param {number} interval - Polling interval in ms
   * @returns {Promise<Object>} - Result with image URL
   */
  async pollForResult(taskId, maxAttempts = 120, interval = 2000) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(
          `${KIE_API_URL}/jobs/recordInfo?taskId=${taskId}`,
          {
            method: 'GET',
            headers: this.headers
          }
        );

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.code !== 200) {
          throw new Error(`Status check error: ${data.msg || data.message}`);
        }

        const task = data.data;
        const state = task.state;

        // Check if completed successfully
        if (state === 'success') {
          console.log('    Generation complete!');

          // Parse resultJson to get image URLs
          let imageUrl = null;
          if (task.resultJson) {
            try {
              const result = JSON.parse(task.resultJson);
              if (result.resultUrls && result.resultUrls.length > 0) {
                imageUrl = result.resultUrls[0];
              }
            } catch (e) {
              console.error('Failed to parse resultJson:', e);
            }
          }

          return {
            success: true,
            imageUrl,
            generationId: taskId
          };
        }

        // Check if failed
        if (state === 'fail') {
          throw new Error(task.failMsg || 'Generation failed');
        }

        // Still processing (waiting, queuing, generating)
        if (attempt % 5 === 0) {
          console.log(`    Status: ${state}... (attempt ${attempt + 1}/${maxAttempts})`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));

      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    throw new Error('Generation timed out');
  }

  /**
   * Generate multiple images in batch
   * @param {Object[]} requests - Array of generation requests
   * @returns {Promise<Object[]>} - Array of results
   */
  async generateBatch(requests) {
    const results = await Promise.all(
      requests.map(req => this.generateImage(req))
    );
    return results;
  }

  /**
   * Check API connection and credits
   * @returns {Promise<Object>} - API status
   */
  async checkStatus() {
    try {
      const response = await fetch(`${KIE_API_URL}/common/credits`, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error('API connection failed');
      }

      const data = await response.json();
      return {
        connected: true,
        credits: data.data?.credits
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Convert image file to base64
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} - Base64 encoded image
   */
  static async imageToBase64(filePath) {
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  }

  /**
   * Convert base64 to image file
   * @param {string} base64 - Base64 encoded image
   * @param {string} outputPath - Path to save image
   * @returns {Promise<void>}
   */
  static async base64ToImage(base64, outputPath) {
    const fs = require('fs').promises;
    const buffer = Buffer.from(base64, 'base64');
    await fs.writeFile(outputPath, buffer);
  }
}

module.exports = NanoBananaAPI;
