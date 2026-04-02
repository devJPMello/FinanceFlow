import { describe, it, expect } from 'vitest';
import type { AxiosError } from 'axios';
import { getFriendlyApiMessage, getApiErrorWithRequestId } from './apiErrors';

function axErr(partial: Partial<AxiosError>): AxiosError {
  return partial as AxiosError;
}

describe('getFriendlyApiMessage', () => {
  it('usa mensagem string do body', () => {
    expect(
      getFriendlyApiMessage(
        axErr({
          response: { status: 400, data: { message: 'Campo inválido' } },
        } as Partial<AxiosError>),
      ),
    ).toBe('Campo inválido');
  });

  it('junta array de mensagens de validação', () => {
    expect(
      getFriendlyApiMessage(
        axErr({
          response: { status: 422, data: { message: ['a', 'b'] } },
        } as Partial<AxiosError>),
      ),
    ).toBe('a · b');
  });

  it('substitui mensagem 400 demasiado longa por texto genérico', () => {
    const long = 'x'.repeat(300);
    expect(
      getFriendlyApiMessage(
        axErr({
          response: { status: 400, data: { message: long } },
        } as Partial<AxiosError>),
      ),
    ).toBe('Dados inválidos. Verifique os campos e tente novamente.');
  });

  it('sem response e sem mensagem → texto de rede', () => {
    expect(getFriendlyApiMessage(axErr({}))).toBe(
      'Sem ligação ao servidor. Verifique a rede e tente de novo.',
    );
  });

  it('Network Error (Axios sem response) → guia deploy/CORS', () => {
    const msg = getFriendlyApiMessage(axErr({ message: 'Network Error' }));
    expect(msg).toContain('VITE_API_URL');
    expect(msg).toContain('FRONTEND_URL');
  });

  it('ECONNABORTED (sem message para não cair no ramo genérico)', () => {
    expect(
      getFriendlyApiMessage(axErr({ code: 'ECONNABORTED', message: undefined })),
    ).toBe('O pedido demorou demasiado. Tente novamente.');
  });

  it.each([
    [401, 'Sessão expirada ou inválida. Inicie sessão novamente.'],
    [403, 'Não tem permissão para esta ação.'],
    [404, 'Recurso não encontrado.'],
    [413, 'Ficheiro demasiado grande para o servidor.'],
    [429, 'Muitos pedidos. Aguarde um momento e tente de novo.'],
    [503, 'Serviço temporariamente indisponível. Tente dentro de instantes.'],
  ] as const)('status %i', (status, expected) => {
    expect(
      getFriendlyApiMessage(axErr({ response: { status, data: {} } } as Partial<AxiosError>)),
    ).toBe(expected);
  });

  it('status desconhecido com body vazio', () => {
    expect(
      getFriendlyApiMessage(axErr({ response: { status: 418, data: {} } } as Partial<AxiosError>)),
    ).toBe('Ocorreu um erro. Se persistir, contacte o suporte.');
  });
});

describe('getApiErrorWithRequestId', () => {
  it('acrescenta ref quando requestId existe', () => {
    expect(
      getApiErrorWithRequestId(
        axErr({
          response: {
            status: 500,
            data: { message: 'Erro', requestId: 'req-abc' },
          },
        } as Partial<AxiosError>),
      ),
    ).toMatch(/ref: req-abc/);
  });

  it('sem requestId devolve só mensagem amigável', () => {
    const s = getApiErrorWithRequestId(
      axErr({ response: { status: 404, data: {} } } as Partial<AxiosError>),
    );
    expect(s).toBe('Recurso não encontrado.');
    expect(s).not.toMatch(/ref:/);
  });
});
