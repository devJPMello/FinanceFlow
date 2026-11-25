import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Money } from './Money';

describe('Money', () => {
  it('formata despesa em BRL com sinal e cor de despesa', () => {
    render(<Money value={120.5} type="EXPENSE" />);
    const el = screen.getByText(/120,50/);
    expect(el.textContent).toContain('-');
    expect(el.className).toContain('text-expense');
  });

  it('usa verde para receita', () => {
    render(<Money value={10} type="INCOME" />);
    expect(screen.getByText(/10,00/).className).toContain('text-income');
  });
});
