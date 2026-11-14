// Cursos (fase 14): o programa de cada curso (PP, PC e INVA), mantido no app pelo Administrador, e o curso de cada
// aluno. Cada missão do programa tem um código (PP-07), um nome, o tipo de missão do app, o recurso e as horas.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CURSOS, cursosVazios, normalizarCursos, normalizarCursoDoAluno, novaMissaoDoCurso } from '../../js/cursos.js';

const missao = (id, extra = {}) => ({ id, nome: `Missão ${id}`, mis: 'Voo Local', eq: 'C152', nb: 1, ...extra });

describe('Programa dos cursos', () => {
  it('os três cursos, nesta ordem; sem programa, cada um começa vazio', () => {
    assert.deepEqual(CURSOS.map(([id]) => id), ['PP', 'PC', 'INVA']);
    assert.deepEqual(cursosVazios(), { PP: [], PC: [], INVA: [] });
    assert.deepEqual(normalizarCursos(undefined), cursosVazios());
  });

  it('só missões válidas: código curto e único no curso, missão do app, recurso da missão e horas inteiras de 1 a 11', () => {
    const cursos = normalizarCursos({
      PP: [missao('PP-01'), missao('pp-02 ', { nome: '  Navegação  ', mis: 'Navegação', nb: 2 }), missao('PP-01'), missao('', {}), missao('PP 03'),
        missao('PP-04', { mis: 'Inexistente' }), missao('PP-05', { eq: 'PA-34', mis: 'Noturno' }), missao('PP-06', { nb: 40 })],
      PC: 'x',
      XYZ: [missao('X-1')]
    });
    assert.deepEqual(cursos.PP.map(m => [m.id, m.nome, m.mis, m.eq, m.nb]), [
      ['PP-01', 'Missão PP-01', 'Voo Local', 'C152', 1],
      ['PP-02', 'Navegação', 'Navegação', 'C152', 2],
      ['PP-05', 'Missão PP-05', 'Noturno', 'C172', 1],
      ['PP-06', 'Missão PP-06', 'Voo Local', 'C152', 1]
    ]);
    assert.deepEqual([cursos.PC, cursos.INVA, Object.keys(cursos)], [[], [], ['PP', 'PC', 'INVA']]);
  });

  it('o Ground é na sala, com 1h30; sem nome, o nome é o código', () => {
    const [ground] = normalizarCursos({ PP: [missao('PP-G1', { mis: 'Ground C152', eq: 'C152', nb: 3, nome: '' })] }).PP;
    assert.deepEqual(ground, { id: 'PP-G1', nome: 'PP-G1', mis: 'Ground C152', eq: 'Sala Ground', nb: 1.5 });
  });

  it('a missão nova recebe o próximo número livre do curso', () => {
    assert.deepEqual(novaMissaoDoCurso('PP', []), { id: 'PP-01', nome: '', mis: 'Voo Local', eq: 'C152', nb: 1 });
    assert.equal(novaMissaoDoCurso('INVA', [missao('INVA-01'), missao('INVA-07'), missao('INVA-X')]).id, 'INVA-08');
  });

  it('o curso do aluno: só um dos três', () => {
    assert.equal(normalizarCursoDoAluno('PC'), 'PC');
    assert.equal(normalizarCursoDoAluno('pc'), undefined);
    assert.equal(normalizarCursoDoAluno(undefined), undefined);
  });
});
