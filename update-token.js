/**
 * Quick script to update Facebook access token
 * Run with: node update-token.js
 */

require('dotenv').config();

const { getDb } = require('./src/database/db');
const { encrypt } = require('./src/database/encryption');

const NEW_TOKEN = 'EAAaFRqufjqEBQsfSakAV8adVFUjuysgSJ0nRt2uzWfqB4sNHdoo6zcYxRCtQJZCFlhzwVZCM1JbPI3ZCOgZCg8t5uzw6ZCBulpZCZCxoSC2wtl9vzPlNUe2xcXm8FxNLJ6u2ccoeecrkHZBuqMLXdtt5VoLQHmj3zipVESTF8zAEbYbuJ2CxG9rlNSG7lKSeUOhvmnekD1FVEjlPRapigIOAVFnmtt29Rq2OjZAZAv';

try {
  const db = getDb();
  const encrypted = encrypt(NEW_TOKEN);

  // Update all active connections (or you can specify a brand_id)
  const result = db.prepare(`
    UPDATE fb_connections
    SET access_token_encrypted = ?, updated_at = datetime('now')
    WHERE status = 'active'
  `).run(encrypted);

  console.log(`Updated ${result.changes} connection(s) with new token`);
  process.exit(0);
} catch (err) {
  console.error('Error updating token:', err.message);
  process.exit(1);
}
