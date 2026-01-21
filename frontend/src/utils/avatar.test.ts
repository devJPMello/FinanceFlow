import { describe, it, expect } from 'vitest';
import { getInitials } from './avatar';

describe('getInitials', () => {
  it('deve retornar iniciais de nome completo', () => {
    expect(getInitials('João Pedro')).toBe('JP');
    expect(getInitials('Geovana Marinho')).toBe('GM');
    expect(getInitials('Maria Silva')).toBe('MS');
  });

  it('deve retornar primeira letra quando só tem um nome', () => {
    expect(getInitials('Maria')).toBe('M');
    expect(getInitials('João')).toBe('J');
  });

  it('deve retornar primeira e última inicial quando tem múltiplos nomes', () => {
    expect(getInitials('João Pedro Silva')).toBe('JS');
    expect(getInitials('Maria da Silva Santos')).toBe('MS');
  });

  it('deve retornar "U" quando nome é null ou undefined', () => {
    expect(getInitials(null)).toBe('U');
    expect(getInitials(undefined)).toBe('U');
  });

  it('deve retornar "U" quando nome é string vazia', () => {
    expect(getInitials('')).toBe('U');
    expect(getInitials('   ')).toBe('U');
  });

  it('deve converter para maiúsculas', () => {
    expect(getInitials('joão pedro')).toBe('JP');
    expect(getInitials('MARIA SILVA')).toBe('MS');
  });

  it('deve lidar com espaços múltiplos', () => {
    expect(getInitials('João    Pedro')).toBe('JP');
    expect(getInitials('  Maria  Silva  ')).toBe('MS');
  });
});
