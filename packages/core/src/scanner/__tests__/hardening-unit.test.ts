import { describe, it, expect } from 'vitest';
import {
  normalizeCookies,
  resolveDeviceConfig,
  getStealthHeaders,
  DEFAULT_DESKTOP_VIEWPORT,
  DEFAULT_MOBILE_VIEWPORT,
  DEFAULT_DESKTOP_UA,
  DEFAULT_MOBILE_UA,
} from '../hardening.js';

describe('Hardening Helpers Unit Tests', () => {
  describe('normalizeCookies', () => {
    it('parses cookie string into Playwright-compatible cookie objects with origin URL', () => {
      const cookieStr = 'sessionId=xyz123; user_tier=premium; theme=dark';
      const targetUrl = 'https://example.com/dashboard/settings';
      const cookies = normalizeCookies(cookieStr, targetUrl);

      expect(cookies).toHaveLength(3);
      expect(cookies[0]).toEqual({
        name: 'sessionId',
        value: 'xyz123',
        url: 'https://example.com',
      });
      expect(cookies[1]).toEqual({
        name: 'user_tier',
        value: 'premium',
        url: 'https://example.com',
      });
      expect(cookies[2]).toEqual({
        name: 'theme',
        value: 'dark',
        url: 'https://example.com',
      });
    });

    it('handles empty or malformed cookie string without errors', () => {
      expect(normalizeCookies('', 'https://example.com')).toEqual([]);
      expect(normalizeCookies('   ;  ;  ', 'https://example.com')).toEqual([]);
      expect(normalizeCookies('invalid_no_equal', 'https://example.com')).toEqual([]);
    });

    it('preserves domain and path when domain is explicitly set', () => {
      const input = [
        { name: 'token', value: 'secret', domain: 'sub.example.com', path: '/api' },
        { name: 'pref', value: 'dark' },
      ];
      const cookies = normalizeCookies(input, 'https://example.com');

      expect(cookies[0]).toEqual({
        name: 'token',
        value: 'secret',
        domain: 'sub.example.com',
        path: '/api',
      });
      // The second item should have the target origin url attached
      expect(cookies[1]!.url).toBe('https://example.com');
      expect(cookies[1]!.domain).toBeUndefined();
    });
  });

  describe('resolveDeviceConfig', () => {
    it('returns desktop defaults when isMobile is false or omitted', () => {
      const config = resolveDeviceConfig({});
      expect(config.isMobile).toBe(false);
      expect(config.viewport).toEqual(DEFAULT_DESKTOP_VIEWPORT);
      expect(config.userAgent).toBe(DEFAULT_DESKTOP_UA);
      expect(config.deviceScaleFactor).toBe(1);
      expect(config.hasTouch).toBe(false);
    });

    it('returns mobile defaults when isMobile is true', () => {
      const config = resolveDeviceConfig({ isMobile: true });
      expect(config.isMobile).toBe(true);
      expect(config.viewport).toEqual(DEFAULT_MOBILE_VIEWPORT);
      expect(config.userAgent).toBe(DEFAULT_MOBILE_UA);
      expect(config.deviceScaleFactor).toBe(3);
      expect(config.hasTouch).toBe(true);
    });

    it('allows custom viewport and user agent overrides', () => {
      const customVp = { width: 1280, height: 720 };
      const customUa = 'CustomAgent/1.0';
      const config = resolveDeviceConfig({
        isMobile: false,
        viewport: customVp,
        userAgent: customUa,
      });

      expect(config.viewport).toEqual(customVp);
      expect(config.userAgent).toBe(customUa);
    });
  });

  describe('getStealthHeaders', () => {
    it('returns desktop client hints with sec-ch-ua-mobile: ?0', () => {
      const headers = getStealthHeaders(false);
      expect(headers['sec-ch-ua-mobile']).toBe('?0');
      expect(headers['sec-ch-ua-platform']).toBe('"Linux"');
      expect(headers['Upgrade-Insecure-Requests']).toBe('1');
    });

    it('returns mobile client hints with sec-ch-ua-mobile: ?1', () => {
      const headers = getStealthHeaders(true);
      expect(headers['sec-ch-ua-mobile']).toBe('?1');
      expect(headers['sec-ch-ua-platform']).toBe('"iOS"');
    });
  });
});
