// Camada de acesso a dados: estado inicial, migrações de schema, persistência por um backend
// (localStorage ou Supabase) e o link compartilhável que abre a escala no perfil Gestor.
import { WIN, NI, EQ, DEFAULT_LIM, FLIGHT_STATUSES } from './config.js';
import { pad } from './format.js';
import { blank, normalizeMissionFields } from './rules.js';
import { backendLocal, CHAVES_LOCAIS, CHAVE_LEGADA } from './backends/local.js';
import { separar, juntar, diaPadrao, diaParaCopiar, converterLegado, biDosDias } from './dias.js';
import { ESQUEMA, migrarCadastro, migrarDia, precisaMigrar, renomearSimulador } from './migracoes.js';

// Validação do link compartilhado: o conteúdo vem da URL, então só entram os tipos e as faixas que a interface produz
const LIMITE = { instrutores: 200, alunos: 500, extras: 10, bloqueios: 50, matriculas: 100, nome: 80 };
const inteiro = (v, min, max, padrao) => (Number.isInteger(v) && v >= min && v <= max ? v : padrao);
const numero = (v, min, max, padrao) => (typeof v === 'number' && v >= min && v <= max ? v : padrao);
const texto = (v, max = LIMITE.nome) => (typeof v === 'string' ? v.slice(0, max) : '');
const lista = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const id = v => inteiro(v, 1, Number.MAX_SAFE_INTEGER, null);
const pedido = (mis, eq, p1, p2, nb, ss, pr) => ({
  mis: texto(mis), eq: texto(eq),
  p1: inteiro(p1, -1, NI, -1), p2: inteiro(p2, -1, NI, -1),
  nb: numero(nb, 1, 11, 1), ss: inteiro(ss, 1, 3, 1), pr: inteiro(pr, 1, 5, 3)
});

export const ApiClient = {
  KEY_STATE: CHAVES_LOCAIS.estado,
  KEY_LEGACY: CHAVE_LEGADA,
  KEY_RESULT: CHAVES_LOCAIS.escala,
  KEY_AUDIT: CHAVES_LOCAIS.historico,
  KEY_BI: CHAVES_LOCAIS.bi,
  KEY_THEME: 'acpm3_theme',
  // Onde os documentos ficam: backend local (localStorage) ou Supabase (login)
  backend: backendLocal,
  // Nome de quem está alterando (modo compartilhado), mostrado no histórico
  autorAtual: null,
  // Link compartilhado: nada é gravado e a interface fica travada no perfil Gestor
  readOnly: false,

  createFreshState() {
    const state = {
      schemaVer: 4,
      win: WIN.map(() => true),
      av: {},
      lim: { ...DEFAULT_LIM },
      nid: 1000,
      // Sem cadastro: no modo compartilhado os instrutores e alunos vêm do servidor
      ins: [],
      stu: [],
      fStatus: {}
    };
    Object.values(EQ).flat().forEach(r => state.av[r] = true);
    return state;
  },

  normalizeAndMigrateState(x) {
    if (!x || !Array.isArray(x.stu) || !Array.isArray(x.ins)) return this.createFreshState();
    x.lim = { ...DEFAULT_LIM };
    if (!x.fStatus) x.fStatus = {};
    if (!x.nid || x.nid < 1000) x.nid = 1000;

    if (!x.schemaVer || x.schemaVer < 3) {
      // Versões antigas: mantém os instrutores do navegador (e os ids, usados nos bloqueios), completando campos ausentes
      x.ins = x.ins.map((old, idx) => ({
        id: Number.isInteger(old.id) ? old.id : idx + 1,
        nm: typeof old.nm === 'string' ? old.nm : `Instrutor ${idx + 1}`,
        on: old.on !== false,
        lv: old.lv >= 1 && old.lv <= 9 ? old.lv : 1,
        kg: old.kg > 0 ? old.kg : 0,
        aw: Array.isArray(old.aw) && old.aw.length === WIN.length ? old.aw : WIN.map(() => true)
      }));

      const isDefaultPlaceholderList =
        x.stu.length === 50 &&
        x.stu.every((s, i) => s.nm === pad(i) && !s.fly && (!s.extra || !s.extra.length));
      if (isDefaultPlaceholderList) {
        x.stu = [];
      }
    }

    x.schemaVer = 4;

    x.stu.forEach(s => {
      normalizeMissionFields(s);
      if (!Array.isArray(s.extra)) s.extra = [];
      s.extra.forEach(ex => {
        if (!ex.mid) ex.mid = x.nid++;
        normalizeMissionFields(ex);
      });
    });

    return x;
  },

  // Escala por data (fase 3) ------------------------------------------------------------------------
  // JSON do cadastro lido ou gravado por último: o cadastro só é regravado quando muda
  cadastroGravado: undefined,

  // Estado e escala de uma data. Data sem escala começa com uma cópia do dia anterior (nada é gravado).
  // Dados num formato anterior chegam já no formato atual (o que está gravado é atualizado na próxima gravação)
  async carregarDia(data) {
    const guardado = await this.backend.ler('cadastro');
    this.cadastroGravado = guardado ? JSON.stringify(guardado) : undefined;
    const cadastro = migrarCadastro(guardado);
    const dia = migrarDia(await this.backend.ler(`dia:${data}`));
    const base = dia || diaParaCopiar(migrarDia((await this.backend.diaAnterior(data) || {}).conteudo));
    const estado = this.normalizeAndMigrateState(juntar(cadastro || { nid: 1000, ins: [], stu: [] }, base || diaPadrao()));
    const escala = dia && dia.resultado && Array.isArray(dia.resultado.out) ? dia.resultado : null;
    return { estado, escala, novo: !dia };
  },

  async salvarDia(data, estado, escala) {
    if (this.readOnly) return false;
    const partes = separar(estado);
    const cadastro = { ...partes.cadastro, esquema: ESQUEMA };
    const dia = { ...partes.dia, esquema: ESQUEMA };
    const json = JSON.stringify(cadastro);
    const gravacoes = [];
    if (json !== this.cadastroGravado) {
      gravacoes.push(this.backend.gravar('cadastro', cadastro).then(ok => {
        if (ok) this.cadastroGravado = json;
        return ok;
      }));
    }
    gravacoes.push(this.backend.gravar(`dia:${data}`, { ...dia, resultado: escala || null }));
    return (await Promise.all(gravacoes)).every(Boolean);
  },

  async registrarHistorico(data, entrada) {
    if (this.readOnly) return null;
    return this.backend.registrar({ data, ...entrada });
  },

  historicoDoDia(data) {
    return this.backend.listarHistorico(data);
  },

  async biDoPeriodo(de, ate) {
    return biDosDias((await this.backend.listarDias(de, ate)).map(d => ({ ...d, conteudo: migrarDia(d.conteudo) })));
  },

  // Converte os documentos da fase 2 (estado, escala, histórico e BI) para o formato por data, uma vez só.
  // A origem pode ser outro backend (envio dos dados do navegador). Os documentos antigos ficam como cópia;
  // dias que já existem não são sobrescritos e o cadastro é gravado por último (marca a migração como concluída).
  // Se uma gravação falhar, para com erro antes do cadastro: a conversão é retomada na próxima abertura.
  async migrarDocumentosAntigos(dataPadrao, origem = this.backend) {
    if (this.readOnly || await this.backend.ler('cadastro')) return null;
    const estado = await origem.ler('estado');
    if (!estado || !Array.isArray(estado.ins) || !Array.isArray(estado.stu)) return null;
    const plano = converterLegado({
      estado: this.normalizeAndMigrateState(estado),
      escala: await origem.ler('escala'),
      historico: await origem.ler('historico'),
      bi: await origem.ler('bi')
    }, dataPadrao);
    for (const [data, conteudo] of Object.entries(plano.dias)) {
      if (await this.backend.ler(`dia:${data}`)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(conteudo))) throw new Error(`A conversão dos dados não terminou (dia ${data}).`);
    }
    if (plano.historico.length) await this.backend.importarHistorico(plano.dataAtual, plano.historico);
    const cadastro = migrarCadastro(plano.cadastro);
    if (!await this.backend.gravar('cadastro', cadastro)) throw new Error('A conversão dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(cadastro);
    return plano.dataAtual;
  },

  // Regrava no formato atual tudo o que está num formato anterior: todos os dias e, por último, o cadastro (que
  // marca a atualização como concluída). Se uma gravação falhar, para com erro: é retomada na próxima abertura.
  async atualizarFormatoGravado() {
    if (this.readOnly) return false;
    const cadastro = await this.backend.ler('cadastro');
    if (!precisaMigrar(cadastro)) return false;
    for (const { data } of await this.backend.listarDias('0001-01-01', '9999-12-31')) {
      const dia = await this.backend.ler(`dia:${data}`);
      if (!precisaMigrar(dia)) continue;
      if (!await this.backend.gravar(`dia:${data}`, migrarDia(dia))) throw new Error(`A atualização dos dados não terminou (dia ${data}).`);
    }
    const novo = migrarCadastro(cadastro);
    if (!await this.backend.gravar('cadastro', novo)) throw new Error('A atualização dos dados não terminou (cadastro).');
    this.cadastroGravado = JSON.stringify(novo);
    return true;
  },

  encodeShareableURL(state, dateStr) {
    const compact = {
      d: dateStr,
      w: state.win.map(v => v ? 1 : 0),
      avOff: Object.keys(state.av).filter(k => !state.av[k]),
      ins: state.ins.map(x => [x.id, x.nm, x.on ? 1 : 0, x.lv, x.kg, x.aw.map(a => a ? 1 : 0)]),
      st: state.fStatus || {},
      fly: state.stu
        .filter(s => s.fly || (s.extra && s.extra.some(ex => ex.fly)))
        .map(s => [
          s.id, s.nm, s.kg, s.bl,
          s.fly ? 1 : 0, s.mis, s.eq, s.p1, s.p2, s.nb, s.ss, s.pr,
          (s.extra || []).filter(ex => ex.fly).map(ex => [ex.mid, ex.mis, ex.eq, ex.p1, ex.p2, ex.nb, ex.ss, ex.pr])
        ])
    };
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
    const url = new URL(window.location.href);
    url.searchParams.set('role', 'gestor');
    url.searchParams.set('share', b64);
    return url.toString();
  },

  applySharedURLIfPresent(state) {
    try {
      const params = new URLSearchParams(window.location.search);
      const share = params.get('share');
      if (!share) return null;
      const decoded = JSON.parse(decodeURIComponent(escape(atob(share))));
      if (!decoded || typeof decoded !== 'object') return null;
      if (Array.isArray(decoded.w)) state.win = WIN.map((_, i) => Boolean(decoded.w[i]));
      state.lim = { ...DEFAULT_LIM };
      if (decoded.st && typeof decoded.st === 'object') {
        state.fStatus = Object.fromEntries(Object.entries(decoded.st)
          .filter(([fKey, st]) => /^\d+_\d+_\d+$/.test(fKey) && FLIGHT_STATUSES.includes(st)));
      }
      Object.keys(state.av).forEach(k => state.av[k] = true);
      lista(decoded.avOff, LIMITE.matriculas).map(renomearSimulador).forEach(k => { if (Object.hasOwn(state.av, k)) state.av[k] = false; });

      if (Array.isArray(decoded.ins)) {
        state.ins = lista(decoded.ins, LIMITE.instrutores).filter(Array.isArray).map(([insId, nm, on, lv, kg, aw]) => ({
          id: id(insId), nm: texto(nm), on: Boolean(on), lv: inteiro(lv, 1, 9, 1), kg: numero(kg, 0, 300, 0),
          aw: Array.isArray(aw) ? WIN.map((_, i) => Boolean(aw[i])) : WIN.map(() => true)
        })).filter(x => x.id !== null);
      } else if (Array.isArray(decoded.inOff)) {
        state.ins.forEach(x => x.on = !decoded.inOff.includes(x.id));
      }

      state.stu = [];

      lista(decoded.fly, LIMITE.alunos).forEach(row => {
        const stuId = Array.isArray(row) ? id(row[0]) : null;
        if (stuId === null) return;
        const [, nm, kg, bl] = row;
        const cadastro = { nm: texto(nm), kg: numero(kg, 0, 300, 0), bl: lista(bl, LIMITE.bloqueios).map(id).filter(b => b !== null) };
        let target = state.stu.find(s => s.id === stuId);
        if (!target) {
          target = { id: stuId, ...cadastro, extra: [], ...blank() };
          state.stu.push(target);
        }
        if (row.length >= 12) {
          const [, , , , flyFlag, mis, eq, p1, p2, nb, ss, pr, extraArr] = row;
          Object.assign(target, cadastro, {
            fly: Boolean(flyFlag), ...pedido(mis, eq, p1, p2, nb, ss, pr),
            extra: lista(extraArr, LIMITE.extras).filter(Array.isArray)
              .map(([mid, ...campos]) => ({ mid: id(mid), fly: true, ...pedido(...campos) }))
              .filter(ex => ex.mid !== null)
          });
          target.extra.forEach(normalizeMissionFields);
          normalizeMissionFields(target);
        } else {
          const [, , , , mis, eq, p1, p2, nb, ss, pr] = row;
          Object.assign(target, cadastro, { fly: true, ...pedido(mis, eq, p1, p2, nb, ss, pr), extra: [] });
          normalizeMissionFields(target);
        }
      });
      return typeof decoded.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(decoded.d) ? decoded.d : null;
    } catch (e) { return null; }
  }
};
