/**
 * Gera as iniciais do nome do usuário
 * Exemplos:
 * - "João Pedro" → "JP"
 * - "Geovana Marinho" → "GM"
 * - "Maria" → "M"
 * - "João Pedro Silva" → "JP" (primeiro e último)
 */
export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim().length === 0) {
    return 'U'; // User padrão
  }

  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    // Se só tem um nome, retorna a primeira letra
    return parts[0].charAt(0).toUpperCase();
  }
  
  // Se tem mais de um nome, retorna primeira letra do primeiro e último nome
  const firstInitial = parts[0].charAt(0).toUpperCase();
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  
  return `${firstInitial}${lastInitial}`;
}
