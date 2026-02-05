/**
 * Facebook OAuth — login URL generation, code→token exchange,
 * short→long-lived token, token refresh, ad account listing
 */

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const OAUTH_BASE = 'https://www.facebook.com/v21.0/dialog/oauth';

const SCOPES = ['ads_read', 'ads_management', 'pages_read_engagement', 'pages_show_list'];

function getAppCredentials() {
  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  const redirectUri = process.env.FB_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error('Missing FB_APP_ID, FB_APP_SECRET, or FB_REDIRECT_URI in environment');
  }
  return { appId, appSecret, redirectUri };
}

/**
 * Generate the Facebook OAuth login URL
 * @param {string} state - CSRF state param (e.g. brandId)
 */
function getLoginUrl(state) {
  const { appId, redirectUri } = getAppCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: SCOPES.join(','),
    response_type: 'code',
    state: state || '',
  });
  return `${OAUTH_BASE}?${params.toString()}`;
}

/**
 * Exchange authorization code for short-lived access token
 */
async function exchangeCodeForToken(code) {
  const { appId, appSecret, redirectUri } = getAppCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error.message}`);
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in, // seconds
  };
}

/**
 * Exchange short-lived token for long-lived token (~60 days)
 */
async function getLongLivedToken(shortToken) {
  const { appId, appSecret } = getAppCredentials();
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  });

  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Long-lived token exchange failed: ${data.error.message}`);
  }
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000, // ~60 days default
  };
}

/**
 * Refresh a long-lived token (returns new long-lived token)
 */
async function refreshToken(longLivedToken) {
  // Facebook long-lived tokens can be refreshed via the same exchange endpoint
  // as long as the token is still valid
  return getLongLivedToken(longLivedToken);
}

/**
 * Get the authenticated user's info
 */
async function getUserInfo(accessToken) {
  const res = await fetch(`${GRAPH_BASE}/me?fields=id,name&access_token=${accessToken}`);
  const data = await res.json();
  if (data.error) {
    throw new Error(`Failed to get user info: ${data.error.message}`);
  }
  return { id: data.id, name: data.name };
}

/**
 * List all ad accounts the user has access to
 */
async function listAdAccounts(accessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&limit=100&access_token=${accessToken}`
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(`Failed to list ad accounts: ${data.error.message}`);
  }
  return (data.data || []).map(acc => ({
    id: acc.id,               // act_XXXXX format
    accountId: acc.account_id, // numeric
    name: acc.name,
    status: acc.account_status,
    currency: acc.currency,
    timezone: acc.timezone_name,
  }));
}

module.exports = {
  getLoginUrl,
  exchangeCodeForToken,
  getLongLivedToken,
  refreshToken,
  getUserInfo,
  listAdAccounts,
};
