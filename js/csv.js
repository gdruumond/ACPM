// CSV da escala para o lançamento no portal de agendamento do aeroclube. A operadora lança avião por avião, então
// as linhas vêm agrupadas por avião/equipamento e em ordem de horário dentro de cada um. Abre direto no Excel:
// separador ";", UTF-8 com BOM e quebras de linha do Windows.
import { GROUND_EQ_TYPE } from './config.js';
import { hm } from './format.js';

// Ordem dos grupos: aviões (C152, C172, PA-34), simuladores e a sala de Ground; em cada tipo, pela matrícula
const ORDEM_DOS_TIPOS = ['C152', 'C172', 'PA-34', 'Sim. Mono', 'Sim. Multi', GROUND_EQ_TYPE];
const ordemDoTipo = o => { const i = ORDEM_DOS_TIPOS.indexOf(o.eqType); return i < 0 ? ORDEM_DOS_TIPOS.length : i; };

export const CABECALHO = ['Avião / Equipamento', 'Horário', 'Aluno', 'Fase / Missão', 'Instrutor', 'Observações'];

export const nomeDoCsv = data => `escala-acpm-${data}.csv`;

// Observações pertinentes ao lançamento: status diferente de confirmado, turma de Ground e o peso da tripulação
// (aluno + instrutor) contra o limite do avião
function observacoes(o, status) {
  const notas = [];
  if (status !== 'Confirmado') notas.push(`Status: ${status}`);
  if (o.isGround && o.groupSize > 1) notas.push(`Turma de Ground com ${o.groupSize} alunos`);
  if (o.limKg) {
    if (!o.stuKg) notas.push(`Peso do aluno não informado: limite de ${o.limKg} kg do ${o.eqType} não verificado`);
    else if (!o.insKg) notas.push(`Peso do instrutor não informado: limite de ${o.limKg} kg do ${o.eqType} não verificado`);
    else {
      const total = o.stuKg + o.insKg;
      notas.push(`Peso aluno + instrutor: ${total} kg (limite do ${o.eqType}: ${o.limKg} kg) · ${total <= o.limKg ? 'dentro do envelope' : 'ACIMA DO LIMITE'}`);
    }
  }
  return notas.join(' · ');
}

export function linhasDoCsv(res, fStatus = {}) {
  return [...res.out]
    .sort((a, b) => ordemDoTipo(a) - ordemDoTipo(b) || a.r.localeCompare(b.r) || a.a - b.a || a.o - b.o)
    .map(o => {
      const status = fStatus[o.fKey] || o.status || 'Confirmado';
      const missao = o.ss && o.ss !== '1/1' ? `${o.mis} (sessão ${o.ss})` : o.mis;
      return [o.r, `${hm(o.a)}–${hm(o.b)}`, o.s, missao, o.ins, observacoes(o, status)];
    });
}

export function montarCsv(res, fStatus = {}) {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  const linhas = [CABECALHO, ...linhasDoCsv(res, fStatus)].map(l => l.map(q).join(';'));
  if (res.al.length) {
    linhas.push('');
    linhas.push(['Alertas', 'Aluno', 'Mensagem'].map(q).join(';'));
    res.al.forEach(a => linhas.push([a.t === 'err' ? 'Rejeitado' : 'Aviso', a.s, a.m].map(q).join(';')));
  }
  return '﻿' + linhas.join('\r\n');
}
