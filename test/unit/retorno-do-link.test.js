// Volta dos links de confirmação da troca de e-mail: o Supabase Auth abre o site com o resultado no fragmento da URL.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { retornoDoLink } from '../../js/retorno-do-link.js';

describe('retornoDoLink', () => {
  it('o primeiro dos dois links confirmado: falta abrir o outro', () => {
    assert.equal(retornoDoLink('#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email'), 'falta-outro');
  });

  it('os dois links confirmados: a sessão com o e-mail novo vem no fragmento', () => {
    assert.equal(retornoDoLink('#access_token=abc&expires_at=1&expires_in=3600&refresh_token=r&token_type=bearer&type=email_change'), 'concluida');
  });

  it('link expirado, já usado ou com erro', () => {
    assert.equal(retornoDoLink('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), 'invalido');
    assert.equal(retornoDoLink('#error_description=Erro+qualquer'), 'invalido');
    assert.equal(retornoDoLink('#error_code=flow_state_not_found'), 'invalido');
  });

  it('sem fragmento ou com outro conteúdo: nada a avisar', () => {
    assert.equal(retornoDoLink(''), null);
    assert.equal(retornoDoLink('#'), null);
    assert.equal(retornoDoLink(undefined), null);
    assert.equal(retornoDoLink('#secao'), null);
    assert.equal(retornoDoLink('#access_token=abc&type=recovery'), null);
  });
});
