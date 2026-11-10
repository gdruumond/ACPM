// Escolha do projeto Supabase pelo endereço do site.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { projetoSupabase, PROJETOS } from '../../js/config-supabase.js';

const endereco = href => {
  const url = new URL(href);
  return { hostname: url.hostname, search: url.search };
};

describe('Projeto Supabase por endereço', () => {
  it('o site oficial usa o projeto de produção', () => {
    const projeto = projetoSupabase(endereco('https://gdruumond.github.io/ACPM/'));
    assert.equal(projeto.nome, 'producao');
    assert.equal(projeto.url, 'https://iszaomkinojwxymyglmh.supabase.co');
  });

  it('a prévia usa o projeto de prévia', () => {
    const projeto = projetoSupabase(endereco('https://thephfernandes.github.io/ACPM/'));
    assert.equal(projeto.nome, 'previa');
    assert.equal(projeto.url, 'https://llylkdgfuagzdaualvqa.supabase.co');
  });

  it('localhost fica no modo local, sem login', () => {
    assert.equal(projetoSupabase(endereco('http://localhost:4173/')), null);
  });

  it('em localhost, ?supabase= escolhe a prévia ou o servidor falso dos testes', () => {
    assert.equal(projetoSupabase(endereco('http://localhost:4173/?supabase=previa')).nome, 'previa');
    assert.equal(projetoSupabase(endereco('http://127.0.0.1:4173/?supabase=teste')).nome, 'teste');
  });

  it('fora do localhost o parâmetro ?supabase é ignorado', () => {
    assert.equal(projetoSupabase(endereco('https://gdruumond.github.io/ACPM/?supabase=teste')).nome, 'producao');
    assert.equal(projetoSupabase(endereco('https://exemplo.com/?supabase=previa')), null);
  });

  it('nomes desconhecidos ou herdados do Object são ignorados', () => {
    assert.equal(projetoSupabase(endereco('http://localhost:4173/?supabase=constructor')), null);
    assert.equal(projetoSupabase(endereco('http://localhost:4173/?supabase=outro')), null);
  });

  it('o navegador recebe somente chaves publicáveis, nunca a chave secreta', () => {
    assert.match(PROJETOS.producao.chave, /^sb_publishable_/);
    assert.match(PROJETOS.previa.chave, /^sb_publishable_/);
    for (const { chave } of Object.values(PROJETOS)) assert.doesNotMatch(chave, /^sb_secret_|service_role/);
  });
});
