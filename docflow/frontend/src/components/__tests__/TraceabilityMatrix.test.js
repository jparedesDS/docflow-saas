import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }, ref) => (
        <div ref={ref} {...props}>{children}</div>
      )),
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

// Mock Phosphor icons
jest.mock('@phosphor-icons/react', () => ({
  Table: (props) => <span data-testid="table-icon" {...props} />,
  CheckCircle: (props) => <span data-testid="check-icon" {...props} />,
  XCircle: (props) => <span data-testid="x-icon" {...props} />,
  Info: (props) => <span data-testid="info-icon" {...props} />,
}));

// Mock I18nContext
jest.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({
    t: (key) => {
      const map = {
        loading: 'Cargando...',
        traceCoverage: 'Cobertura',
        traceMaterials: 'materiales',
        traceDocTypes: 'tipos de doc.',
        traceNoMaterials: 'Sin materiales para este pedido',
      };
      return map[key] || key;
    },
  }),
}));

// Mock api
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '../../services/api';
import TraceabilityMatrix from '../TraceabilityMatrix';

describe('TraceabilityMatrix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state', async () => {
    // Never-resolving promise to keep loading state
    api.get.mockReturnValue(new Promise(() => {}));
    render(<TraceabilityMatrix pedido="PED-001" />);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  test('renders no materials message for empty data', async () => {
    api.get.mockResolvedValue({
      data: {
        pedido: 'PED-001',
        materials: [],
        doc_types: ['ITP'],
        matrix: {},
        coverage: {},
        overall_coverage: 0,
      },
    });
    render(<TraceabilityMatrix pedido="PED-001" />);
    await waitFor(() =>
      expect(screen.getByText('Sin materiales para este pedido')).toBeInTheDocument()
    );
  });

  test('renders matrix cells with materials', async () => {
    api.get.mockResolvedValue({
      data: {
        pedido: 'PED-001',
        materials: ['Steel'],
        doc_types: ['ITP', 'Manual'],
        matrix: {
          Steel: {
            ITP: [{ doc_ref: 'DOC-1', estado: 'Enviado', titulo: 'Test' }],
            Manual: [],
          },
        },
        coverage: { Steel: { total_required: 6, covered: 1, pct: 16.7 } },
        overall_coverage: 16.7,
      },
    });
    render(<TraceabilityMatrix pedido="PED-001" />);
    await waitFor(() => {
      expect(screen.getByText('Steel')).toBeInTheDocument();
      expect(screen.getByText('ITP')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
    // Check and X icons should be present
    expect(screen.getAllByTestId('check-icon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId('x-icon').length).toBeGreaterThanOrEqual(1);
  });

  test('coverage bar renders with percentage', async () => {
    api.get.mockResolvedValue({
      data: {
        pedido: 'PED-001',
        materials: ['Steel'],
        doc_types: ['ITP'],
        matrix: {
          Steel: { ITP: [{ doc_ref: 'D1', estado: '', titulo: '' }] },
        },
        coverage: { Steel: { total_required: 6, covered: 1, pct: 16.7 } },
        overall_coverage: 16.7,
      },
    });
    render(<TraceabilityMatrix pedido="PED-001" />);
    await waitFor(() => {
      expect(screen.getByText('Cobertura: 16.7%')).toBeInTheDocument();
    });
  });
});
