import { env } from "../env.js";
import { redisConnection } from "../queue/redis.js";

type EbayOAuthResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

function getEbayOAuthUrl() {
  if (env.EBAY_ENVIRONMENT === "production") {
    return "https://api.ebay.com/identity/v1/oauth2/token";
  }

  return "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
}

function getRequiredEbayCredentials() {
  if (!env.EBAY_CLIENT_ID || !env.EBAY_CLIENT_SECRET) {
    throw new Error(
      "Missing eBay credentials. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env"
    );
  }

  return {
    clientId: env.EBAY_CLIENT_ID,
    clientSecret: env.EBAY_CLIENT_SECRET,
  };
}

/**
 * eBay OAuth application token.
 * Cached in Redis so we do not request a new token for every job.
 */
export async function getEbayAccessToken() {
  const cacheKey = `ebay:oauth:${env.EBAY_ENVIRONMENT}:access_token`;

  const cachedToken = await redisConnection.get(cacheKey);

  if (cachedToken) {
    return cachedToken;
  }

  const { clientId, clientSecret } = getRequiredEbayCredentials();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", "https://api.ebay.com/oauth/api_scope");

  const response = await fetch(getEbayOAuthUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `eBay OAuth failed with HTTP ${response.status}: ${responseText}`
    );
  }

  const json = JSON.parse(responseText) as EbayOAuthResponse;

  if (!json.access_token) {
    throw new Error("eBay OAuth response did not include access_token");
  }

  /**
   * Cache slightly shorter than the actual token expiry.
   */
  const ttlSeconds = Math.max(json.expires_in - 60, 60);

  await redisConnection.set(cacheKey, json.access_token, "EX", ttlSeconds);

  console.log({
    event: "ebay_oauth_token_cached",
    environment: env.EBAY_ENVIRONMENT,
    ttlSeconds,
  });

  return json.access_token;
}