import React from 'react';

// Mock all contexts — use require() inside factories to avoid out-of-scope variable errors
jest.mock('./contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
  useTheme: () => ({ theme: 'light', toggleTheme: jest.fn() }),
}));

jest.mock('./contexts/I18nContext', () => ({
  I18nProvider: ({ children }) => children,
  useI18n: () => ({ t: (key) => key, lang: 'es', toggleLang: jest.fn() }),
}));

jest.mock('./contexts/ToastContext', () => ({
  ToastProvider: ({ children }) => children,
  useToast: () => ({ showToast: jest.fn() }),
}));

jest.mock('./contexts/TenantContext', () => ({
  TenantProvider: ({ children }) => children,
  useTenant: () => ({
    hasFeature: () => true,
    tenant: { plan: 'enterprise', name: 'Test Org' },
    limits: { max_users: 999, max_docs: 999999 },
  }),
}));

jest.mock('./services/api', () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
  defaults: { headers: { common: {} } },
}));

// Mock framer-motion — require inside factory
jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: new Proxy({}, {
      get: (_target, prop) => {
        return R.forwardRef(({ children, ...props }, ref) => {
          const domProps = {};
          for (const [key, val] of Object.entries(props)) {
            if (!['animate', 'initial', 'exit', 'transition', 'variants',
                  'whileHover', 'whileTap', 'whileFocus', 'whileInView',
                  'layout', 'layoutId', 'onAnimationComplete'].includes(key)) {
              domProps[key] = val;
            }
          }
          return R.createElement(prop, { ref, ...domProps }, children);
        });
      },
    }),
    AnimatePresence: ({ children }) => {
      const R = require('react');
      return R.createElement(R.Fragment, null, children);
    },
    useMotionValue: () => ({ set: jest.fn(), get: () => 0 }),
    useTransform: () => ({ set: jest.fn(), get: () => 0 }),
    useSpring: () => ({ set: jest.fn(), get: () => 0 }),
    useAnimation: () => ({ start: jest.fn(), stop: jest.fn() }),
  };
});

describe('App', () => {
  test('module can be imported without errors', () => {
    expect(() => require('./App')).not.toThrow();
  });
});
