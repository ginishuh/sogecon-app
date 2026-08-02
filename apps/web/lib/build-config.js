const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function normalizedHostname(url) {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function parseAbsoluteHttpUrl(value) {
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('NEXT_PUBLIC_WEB_API_BASE must be an absolute http(s) URL.');
  }
  try {
    return new URL(value);
  } catch {
    throw new Error('NEXT_PUBLIC_WEB_API_BASE must be a valid absolute URL.');
  }
}

function isExplicitLocalHttp(url, allowInsecureLocalApi) {
  if (url.protocol !== 'http:') return false;
  if (allowInsecureLocalApi !== '1') return false;
  return LOOPBACK_HOSTS.has(normalizedHostname(url));
}

/**
 * Validate the public API URL that Next embeds into the browser bundle.
 *
 * HTTP is intentionally accepted only for an explicit build-only local
 * escape hatch and only when the target is a loopback host.
 */
function validateProductionWebApiBase({
  apiBase = process.env.NEXT_PUBLIC_WEB_API_BASE,
  allowInsecureLocalApi = process.env.WEB_BUILD_ALLOW_INSECURE_LOCAL_API,
} = {}) {
  const value = typeof apiBase === 'string' ? apiBase.trim() : '';
  if (!value) {
    throw new Error('NEXT_PUBLIC_WEB_API_BASE is required for a production Web build.');
  }

  const parsed = parseAbsoluteHttpUrl(value);

  const isHttps = parsed.protocol === 'https:';
  const isExplicitLocalHttpValue = isExplicitLocalHttp(parsed, allowInsecureLocalApi);

  if (!isHttps && !isExplicitLocalHttpValue) {
    if (parsed.protocol === 'http:' && allowInsecureLocalApi === '1') {
      throw new Error('WEB_BUILD_ALLOW_INSECURE_LOCAL_API=1 only permits HTTP loopback API URLs.');
    }
    throw new Error('NEXT_PUBLIC_WEB_API_BASE must use HTTPS for a production Web build.');
  }

  return value;
}

module.exports = { LOOPBACK_HOSTS, validateProductionWebApiBase };
