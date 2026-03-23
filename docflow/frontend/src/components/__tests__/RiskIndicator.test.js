import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Phosphor icons
jest.mock('@phosphor-icons/react', () => ({
  Warning: (props) => <span data-testid="warning-icon" {...props} />,
}));

// Mock api
jest.mock('../../services/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import api from '../../services/api';
import RiskIndicator from '../RiskIndicator';

describe('RiskIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders nothing when no risk (score=0)', async () => {
    api.get.mockResolvedValue({ data: { risk_score: 0, reasons: [], actions: [] } });
    const { container } = render(<RiskIndicator documentRef="DOC-001" />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(container.innerHTML).toBe('');
  });

  test('renders badge with score', async () => {
    api.get.mockResolvedValue({
      data: { risk_score: 45, reasons: ['Test reason'], actions: ['Test action'] },
    });
    render(<RiskIndicator documentRef="DOC-001" />);
    await waitFor(() => expect(screen.getByText(/45/)).toBeInTheDocument());
  });

  test('color red for high risk (score >= 60)', async () => {
    api.get.mockResolvedValue({
      data: { risk_score: 75, reasons: ['Critical'], actions: ['Act now'] },
    });
    render(<RiskIndicator documentRef="DOC-HIGH" />);
    await waitFor(() => {
      const el = screen.getByText(/Alto/);
      expect(el).toBeInTheDocument();
    });
  });

  test('color amber for medium risk (score 30-59)', async () => {
    api.get.mockResolvedValue({
      data: { risk_score: 40, reasons: ['Moderate'], actions: ['Monitor'] },
    });
    render(<RiskIndicator documentRef="DOC-MED" />);
    await waitFor(() => {
      const el = screen.getByText(/Medio/);
      expect(el).toBeInTheDocument();
    });
  });

  test('compact mode renders smaller badge', async () => {
    api.get.mockResolvedValue({
      data: { risk_score: 50, reasons: ['Reason'], actions: ['Action'] },
    });
    const { container } = render(
      <RiskIndicator documentRef="DOC-COMPACT" compact={true} />
    );
    await waitFor(() => expect(screen.getByText('50')).toBeInTheDocument());
    // In compact mode, fontSize is 10 and Warning size is 10
    const badge = screen.getByText('50').closest('span');
    expect(badge).toHaveStyle({ fontSize: '10px' });
  });
});
