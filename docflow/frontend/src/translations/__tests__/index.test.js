import { translations } from '../index';

describe('Translations structure', () => {
  test('has both ES and EN sections', () => {
    expect(translations).toHaveProperty('es');
    expect(translations).toHaveProperty('en');
  });

  test('ES and EN have the same keys', () => {
    const esKeys = Object.keys(translations.es).sort();
    const enKeys = Object.keys(translations.en).sort();

    const missingInEn = esKeys.filter(k => !enKeys.includes(k));
    const missingInEs = enKeys.filter(k => !esKeys.includes(k));

    if (missingInEn.length > 0) {
      console.warn('Keys missing in EN:', missingInEn);
    }
    if (missingInEs.length > 0) {
      console.warn('Keys missing in ES:', missingInEs);
    }

    expect(missingInEn).toEqual([]);
    expect(missingInEs).toEqual([]);
  });

  test('no empty string translation values in ES', () => {
    const emptyKeys = Object.entries(translations.es)
      .filter(([, val]) => val === '')
      .map(([key]) => key);
    expect(emptyKeys).toEqual([]);
  });

  test('no empty string translation values in EN', () => {
    const emptyKeys = Object.entries(translations.en)
      .filter(([, val]) => val === '')
      .map(([key]) => key);
    expect(emptyKeys).toEqual([]);
  });
});

describe('Navigation keys', () => {
  const navKeys = [
    'navInicio', 'navProyectos', 'navDocumentos', 'navComunicaciones',
    'navInformes', 'navErp', 'navFlujos', 'navConfiguracion',
  ];

  test.each(navKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Workflow keys', () => {
  const wfKeys = [
    'wfCreateFlow', 'wfEditFlow', 'wfDeleteFlow',
    'wfTrigger', 'wfConditions', 'wfActions',
    'wfApprove', 'wfReject',
  ];

  test.each(wfKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Status keys', () => {
  const statusKeys = [
    'aprobado', 'com_menores', 'com_mayores',
    'enviado', 'comentado', 'rechazado', 'sin_enviar',
  ];

  test.each(statusKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Settings keys', () => {
  const settingsKeys = [
    'settingsAccount', 'settingsTeam', 'settingsTemplates',
    'settingsIntegrations', 'settingsSystem', 'settingsActivity',
    'settingsBilling',
  ];

  test.each(settingsKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Common UI keys', () => {
  const uiKeys = [
    'search', 'filter', 'export', 'send', 'cancel',
    'save', 'close', 'confirm', 'loading', 'noData',
  ];

  test.each(uiKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Billing keys', () => {
  const billingKeys = [
    'billingCurrentPlan', 'billingStatus', 'billingPeriod',
    'billingManagePlan', 'billingUpgrade', 'billingFree',
  ];

  test.each(billingKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Fase 4 keys', () => {
  const fase4Keys = [
    'classPublic', 'classInternal', 'classConfidential', 'classRestricted',
    'classLabel', 'classChanged',
    'portalTitle', 'portalGenerateLink', 'portalClientName',
    'portalContactEmail', 'portalNoAccess', 'portalAccessRevoked',
    'rtTemplates', 'rtNewTemplate', 'rtSaved', 'rtDeleted', 'rtNoTemplates',
    'dashAtRisk', 'predRiskScore', 'predHigh', 'predMedium', 'predLow',
    'pdTraceability', 'traceCoverage', 'traceMaterials', 'traceDocTypes',
    'eaUseTemplate', 'eaTemplatePreview',
  ];

  test.each(fase4Keys)('Fase 4 key "%s" exists in ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});

describe('Admin keys', () => {
  const adminKeys = [
    'adminTitle', 'adminActiveTenants', 'adminTotalUsers',
    'adminTotalDocs', 'adminMrr', 'adminOrganizations',
  ];

  test.each(adminKeys)('"%s" exists in both ES and EN', (key) => {
    expect(translations.es[key]).toBeDefined();
    expect(translations.en[key]).toBeDefined();
  });
});
