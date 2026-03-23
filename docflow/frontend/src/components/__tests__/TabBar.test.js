import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TabBar from '../TabBar';

// Mock framer-motion — use require() inside factory to avoid out-of-scope variable error
jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: R.forwardRef(({ children, layoutId, transition, ...props }, ref) => (
        R.createElement('div', { ref, 'data-testid': `motion-${layoutId || 'div'}`, ...props }, children)
      )),
    },
  };
});

describe('TabBar', () => {
  const tabs = [
    { key: 'tab1', label: 'First Tab' },
    { key: 'tab2', label: 'Second Tab' },
    { key: 'tab3', label: 'Third Tab' },
  ];

  test('renders all tab labels', () => {
    render(<TabBar tabs={tabs} active="tab1" onChange={jest.fn()} />);
    expect(screen.getByText('First Tab')).toBeInTheDocument();
    expect(screen.getByText('Second Tab')).toBeInTheDocument();
    expect(screen.getByText('Third Tab')).toBeInTheDocument();
  });

  test('renders correct number of tab buttons', () => {
    render(<TabBar tabs={tabs} active="tab1" onChange={jest.fn()} />);
    const buttons = screen.getAllByRole('tab');
    expect(buttons).toHaveLength(3);
  });

  test('calls onChange with the correct key when a tab is clicked', () => {
    const onChange = jest.fn();
    render(<TabBar tabs={tabs} active="tab1" onChange={onChange} />);
    fireEvent.click(screen.getByText('Second Tab'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  test('marks the active tab with aria-selected=true', () => {
    render(<TabBar tabs={tabs} active="tab2" onChange={jest.fn()} />);
    const activeBtn = screen.getByText('Second Tab').closest('button');
    const inactiveBtn = screen.getByText('First Tab').closest('button');
    expect(activeBtn).toHaveAttribute('aria-selected', 'true');
    expect(inactiveBtn).toHaveAttribute('aria-selected', 'false');
  });

  test('renders tab count badge when count is provided', () => {
    const tabsWithCount = [
      { key: 'tab1', label: 'Inbox', count: 42 },
      { key: 'tab2', label: 'Archive', count: 0 },
      { key: 'tab3', label: 'No Count' },
    ];
    render(<TabBar tabs={tabsWithCount} active="tab1" onChange={jest.fn()} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    const noCountBtn = screen.getByText('No Count').closest('button');
    expect(noCountBtn.querySelectorAll('span')).toHaveLength(0);
  });

  test('does not render count badge when count is null or undefined', () => {
    const tabsNoCount = [
      { key: 'tab1', label: 'Tab A' },
      { key: 'tab2', label: 'Tab B' },
    ];
    render(<TabBar tabs={tabsNoCount} active="tab1" onChange={jest.fn()} />);
    const buttons = screen.getAllByRole('tab');
    buttons.forEach(btn => {
      expect(btn.querySelectorAll('span')).toHaveLength(0);
    });
  });

  test('renders the active indicator only for the active tab', () => {
    render(<TabBar tabs={tabs} active="tab2" onChange={jest.fn()} />);
    const indicator = screen.getByTestId('motion-tab-indicator');
    expect(indicator).toBeInTheDocument();
  });

  test('accepts custom layoutId prop', () => {
    render(
      <TabBar tabs={tabs} active="tab1" onChange={jest.fn()} layoutId="custom-id" />
    );
    const indicator = screen.getByTestId('motion-custom-id');
    expect(indicator).toBeInTheDocument();
  });

  test('has correct tablist role', () => {
    render(<TabBar tabs={tabs} active="tab1" onChange={jest.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  test('handles empty tabs array gracefully', () => {
    render(<TabBar tabs={[]} active="" onChange={jest.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
