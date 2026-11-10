// Camada de acesso a dados: estado inicial, migrações de schema, persistência (localStorage hoje,
// REMOTE_ENDPOINT opcional) e o link compartilhável que abre a escala no perfil Gestor.
import { WIN, NI, EQ, DEFAULT_LIM, INS_DATA, FLIGHT_STATUSES } from './config.js';
import { pad } from './format.js';
import { blank, normalizeMissionFields } from './rules.js';

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
  KEY_STATE: 'acpm3',
  KEY_LEGACY: 'acpm2',
  KEY_RESULT: 'acpm3_res',
  KEY_AUDIT: 'acpm3_audit',
  KEY_BI: 'acpm3_bi',
  KEY_THEME: 'acpm3_theme',
  REMOTE_ENDPOINT: null,
  // Link compartilhado: nada é gravado e a interface fica travada no perfil Gestor
  readOnly: false,

  createFreshState() {
    const state = {
      schemaVer: 4,
      win: WIN.map(() => true),
      av: {},
      lim: { ...DEFAULT_LIM },
      nid: 1000,
      ins: INS_DATA.map(([nm, kg], i) => ({
        id: i + 1,
        nm,
        on: true,
        lv: (i % 9) + 1,
        kg,
        aw: WIN.map(() => true)
      })),
      stu: [], // Inicializa sem nenhum aluno cadastrado
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
      const prevByName = new Map();
      x.ins.forEach(ins => prevByName.set(ins.nm.toLowerCase(), ins));

      x.ins = INS_DATA.map(([nm, kg], idx) => {
        const old = prevByName.get(nm.toLowerCase());
        return {
          id: idx + 1,
          nm,
          on: old ? old.on : true,
          lv: (old && old.lv >= 1 && old.lv <= 9) ? ((x.schemaVer || 1) < 2 ? (idx % 9) + 1 : old.lv) : (idx % 9) + 1,
          kg: (old && old.kg > 0) ? old.kg : kg,
          aw: (old && Array.isArray(old.aw) && old.aw.length === WIN.length) ? old.aw : WIN.map(() => true)
        };
      });

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

  async fetchState() {
    if (this.REMOTE_ENDPOINT) {
      try {
        const res = await fetch(`${this.REMOTE_ENDPOINT}/state`);
        if (res.ok) return this.normalizeAndMigrateState(await res.json());
      } catch (e) {}
    }
    try {
      let x = JSON.parse(localStorage.getItem(this.KEY_STATE));
      if (!x) {
        const o = JSON.parse(localStorage.getItem(this.KEY_LEGACY));
        const OLD = [0,1,2,2,3,3,4,5,6], NEW = [0,1,2,4,6,7,8];
        if (o && o.stu && o.ins && o.lim) {
          o.win = OLD.map(k => o.win[k]);
          o.ins.forEach(i => i.aw = OLD.map(k => i.aw[k]));
          o.stu.forEach(d => {
            d.p1 = d.p1 < 0 ? -1 : NEW[d.p1];
            d.p2 = d.p2 < 0 ? -1 : NEW[d.p2];
            d.ss = 1;
          });
          x = o;
        }
      }
      if (x && Array.isArray(x.stu) && Array.isArray(x.ins)) {
        return this.normalizeAndMigrateState(x);
      }
    } catch (e) {}
    return this.createFreshState();
  },

  async saveState(state) {
    if (this.readOnly) return false;
    try {
      localStorage.setItem(this.KEY_STATE, JSON.stringify(state));
      if (this.REMOTE_ENDPOINT) {
        await fetch(`${this.REMOTE_ENDPOINT}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
      }
      return true;
    } catch (e) { return false; }
  },

  async fetchResult() {
    try {
      const r = JSON.parse(localStorage.getItem(this.KEY_RESULT));
      if (r && Array.isArray(r.out) && Array.isArray(r.al)) return r;
    } catch (e) {}
    return null;
  },

  async saveResult(res) {
    if (this.readOnly) return;
    try { localStorage.setItem(this.KEY_RESULT, JSON.stringify(res)); } catch (e) {}
  },

  async fetchAudit() {
    try {
      const a = JSON.parse(localStorage.getItem(this.KEY_AUDIT));
      if (Array.isArray(a)) return a;
    } catch (e) {}
    return [];
  },

  async saveAudit(list) {
    if (this.readOnly) return;
    try { localStorage.setItem(this.KEY_AUDIT, JSON.stringify(list)); } catch (e) {}
  },

  async fetchBI() {
    try {
      const b = JSON.parse(localStorage.getItem(this.KEY_BI));
      if (b && typeof b === 'object') return b;
    } catch (e) {}
    return {};
  },

  async saveBI(biMap) {
    if (this.readOnly) return;
    try { localStorage.setItem(this.KEY_BI, JSON.stringify(biMap)); } catch (e) {}
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
      lista(decoded.avOff, LIMITE.matriculas).forEach(k => { if (Object.hasOwn(state.av, k)) state.av[k] = false; });

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
