import {
  STATUS_COLORS,
  getStatusColor,
  STATUS_COLORS_DISPLAY,
  DASHBOARD_COLORS,
  CLAIM_STATUS_COLORS,
  DOCUSIGN_STATUS_COLORS,
  TAG_STATUS_COLORS,
  SUB_STATUS_COLORS,
  SEGUIMIENTO_STATUS_COLORS,
  ROLE_COLORS,
} from '../status';

describe('STATUS_COLORS', () => {
  const expectedKeys = [
    'aprobado', 'com_menores', 'com_mayores', 'enviado',
    'comentado', 'rechazado', 'informativo', 'sin_enviar',
  ];

  test('contains all expected status keys', () => {
    for (const key of expectedKeys) {
      expect(STATUS_COLORS[key]).toBeDefined();
    }
  });

  test('each status has bg, text, color, dot, and border properties', () => {
    for (const key of expectedKeys) {
      const status = STATUS_COLORS[key];
      expect(status).toHaveProperty('bg');
      expect(status).toHaveProperty('text');
      expect(status).toHaveProperty('color');
      expect(status).toHaveProperty('dot');
      expect(status).toHaveProperty('border');
    }
  });
});

describe('getStatusColor', () => {
  test('returns correct color for lowercase keys', () => {
    const result = getStatusColor('aprobado');
    expect(result).toBe(STATUS_COLORS.aprobado);
  });

  test('normalizes display-case status with dots and spaces', () => {
    const result = getStatusColor('Com. Menores');
    expect(result).toBe(STATUS_COLORS.com_menores);
  });

  test('normalizes "Com. Mayores"', () => {
    expect(getStatusColor('Com. Mayores')).toBe(STATUS_COLORS.com_mayores);
  });

  test('returns sin_enviar for null/undefined/empty', () => {
    expect(getStatusColor(null)).toBe(STATUS_COLORS.sin_enviar);
    expect(getStatusColor(undefined)).toBe(STATUS_COLORS.sin_enviar);
    expect(getStatusColor('')).toBe(STATUS_COLORS.sin_enviar);
  });

  test('returns sin_enviar for unknown status', () => {
    expect(getStatusColor('desconocido_xyz')).toBe(STATUS_COLORS.sin_enviar);
  });

  test('handles status with extra whitespace', () => {
    expect(getStatusColor('  Aprobado  ')).toBe(STATUS_COLORS.aprobado);
  });
});

describe('STATUS_COLORS_DISPLAY', () => {
  test('maps display-cased keys to STATUS_COLORS values', () => {
    expect(STATUS_COLORS_DISPLAY['Aprobado']).toBe(STATUS_COLORS.aprobado);
    expect(STATUS_COLORS_DISPLAY['Enviado']).toBe(STATUS_COLORS.enviado);
    expect(STATUS_COLORS_DISPLAY['Com. Menores']).toBe(STATUS_COLORS.com_menores);
    expect(STATUS_COLORS_DISPLAY['Com. Mayores']).toBe(STATUS_COLORS.com_mayores);
    expect(STATUS_COLORS_DISPLAY['Rechazado']).toBe(STATUS_COLORS.rechazado);
    expect(STATUS_COLORS_DISPLAY['Sin Enviar']).toBe(STATUS_COLORS.sin_enviar);
  });
});

describe('DASHBOARD_COLORS', () => {
  test('has expected aggregate keys', () => {
    expect(DASHBOARD_COLORS).toHaveProperty('aprobados');
    expect(DASHBOARD_COLORS).toHaveProperty('enviados');
    expect(DASHBOARD_COLORS).toHaveProperty('devoluciones');
    expect(DASHBOARD_COLORS).toHaveProperty('sin_enviar');
    expect(DASHBOARD_COLORS).toHaveProperty('criticos');
  });

  test('values are hex color strings', () => {
    for (const val of Object.values(DASHBOARD_COLORS)) {
      expect(val).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('DOCUSIGN_STATUS_COLORS', () => {
  test('has expected envelope status keys', () => {
    const expectedKeys = ['sent', 'delivered', 'completed', 'declined', 'voided', 'created', 'timed_out'];
    for (const key of expectedKeys) {
      expect(DOCUSIGN_STATUS_COLORS[key]).toBeDefined();
      expect(DOCUSIGN_STATUS_COLORS[key]).toHaveProperty('bg');
      expect(DOCUSIGN_STATUS_COLORS[key]).toHaveProperty('text');
      expect(DOCUSIGN_STATUS_COLORS[key]).toHaveProperty('label');
    }
  });
});

describe('TAG_STATUS_COLORS', () => {
  test('maps tag statuses to hex color strings', () => {
    for (const val of Object.values(TAG_STATUS_COLORS)) {
      expect(val).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('ROLE_COLORS', () => {
  test('has colors for all three roles', () => {
    expect(ROLE_COLORS['Document Controller']).toBeDefined();
    expect(ROLE_COLORS['Project Manager']).toBeDefined();
    expect(ROLE_COLORS['Comercial']).toBeDefined();
  });

  test('values are hex color strings', () => {
    for (const val of Object.values(ROLE_COLORS)) {
      expect(val).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
