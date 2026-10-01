import { Page } from 'playwright';
import { CookieOption, ViewportOption } from '../types/index.js';

export const DEFAULT_DESKTOP_VIEWPORT: ViewportOption = { width: 1920, height: 1080 };
export const DEFAULT_MOBILE_VIEWPORT: ViewportOption = { width: 390, height: 844 };

export const DEFAULT_DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

export const DEFAULT_MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

/**
 * Normalizes cookies from string header or object array format into Playwright Cookie format
 */
export function normalizeCookies(cookies: CookieOption[] | string, targetUrl: string): CookieOption[] {
  let fallbackUrl = targetUrl;
  try {
    fallbackUrl = new URL(targetUrl).origin;
  } catch {
    fallbackUrl = targetUrl;
  }

  if (typeof cookies === 'string') {
    return cookies
      .split(';')
      .map((pair) => pair.trim())
      .filter(Boolean)
      .map((pair) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) return null;
        const name = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim();
        return {
          name,
          value,
          url: fallbackUrl,
        };
      })
      .filter(Boolean) as CookieOption[];
  }

  return cookies.map((c) => {
    // If domain is explicitly given, ensure path is provided and strip url (Playwright expects either url or domain)
    if (c.domain) {
      const { url, ...rest } = c;
      return {
        ...rest,
        path: rest.path || '/',
      };
    }
    // If url is given, ensure domain is stripped
    if (c.url) {
      const { domain, ...rest } = c;
      return rest;
    }
    // Default: use targetUrl origin as url
    return {
      ...c,
      url: fallbackUrl,
    };
  });
}

/**
 * Resolves device viewport, scale factor, and user agent parameters
 */
export function resolveDeviceConfig(options: {
  isMobile?: boolean;
  viewport?: ViewportOption;
  userAgent?: string;
}) {
  const isMobile = options.isMobile ?? false;
  const viewport = options.viewport ?? (isMobile ? DEFAULT_MOBILE_VIEWPORT : DEFAULT_DESKTOP_VIEWPORT);
  const userAgent = options.userAgent ?? (isMobile ? DEFAULT_MOBILE_UA : DEFAULT_DESKTOP_UA);
  const deviceScaleFactor = isMobile ? 3 : 1;
  const hasTouch = isMobile;

  return {
    isMobile,
    viewport,
    userAgent,
    deviceScaleFactor,
    hasTouch,
  };
}

/**
 * Returns realistic browser client hints to evade anti-bot fingerprinting
 */
export function getStealthHeaders(isMobile: boolean = false): Record<string, string> {
  return {
    'sec-ch-ua': '"Chromium";v="133", "Google Chrome";v="133", "Not?A_Brand";v="99"',
    'sec-ch-ua-mobile': isMobile ? '?1' : '?0',
    'sec-ch-ua-platform': isMobile ? '"iOS"' : '"Linux"',
    'Upgrade-Insecure-Requests': '1',
    'Accept-Language': 'en-US,en;q=0.9',
  };
}

/**
 * In-browser init script evaluated before page scripts to mask automation indicators
 */
export function injectStealthScripts(): void {
  const win = window as any;

  // 1. Delete or undefine navigator.webdriver
  try {
    const proto = Object.getPrototypeOf(navigator);
    if (proto && 'webdriver' in proto) {
      delete proto.webdriver;
    }
  } catch {}
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
    });
  } catch {}

  // 2. Mock realistic window.chrome runtime object
  try {
    if (!win.chrome) {
      win.chrome = {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        runtime: {
          OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
          PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
        },
        loadTimes: () => {},
        csi: () => {},
      };
    }
  } catch {}

  // 3. Ensure realistic navigator.plugins
  try {
    if (!navigator.plugins || navigator.plugins.length === 0) {
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
        configurable: true,
      });
    }
  } catch {}

  // 4. Ensure realistic navigator.languages
  try {
    if (!navigator.languages || navigator.languages.length === 0) {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true,
      });
    }
  } catch {}
}

/**
 * Configures network routing to abort heavy non-essential resources to accelerate scanning
 */
export async function setupResourceInterception(
  page: Page,
  options: {
    blockMedia?: boolean;
    blockedResourceTypes?: ('image' | 'media' | 'font' | 'stylesheet' | 'other')[];
  }
): Promise<void> {
  const blockedTypes = new Set<string>(
    options.blockedResourceTypes || (options.blockMedia ? ['image', 'media', 'font'] : [])
  );

  if (blockedTypes.size === 0) {
    return;
  }

  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (blockedTypes.has(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });
}
