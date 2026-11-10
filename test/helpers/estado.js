// Estado sintético no formato do schema v4 da aplicação (chave localStorage "acpm3").
// Usa nomes e pesos fictícios para que nenhum dado pessoal real seja copiado para os testes.

export const JANELAS = 9;

export const FROTA_POR_TIPO = {
  'Sim. Mono': ['SIM-MONO-1', 'SIM-MONO-2'],
  'Sim. Multi': ['SIM-MULTI-1', 'SIM-MULTI-2'],
  'C152': ['PP-LJV', 'PR-BTB', 'PR-IGU', 'PR-JPL', 'PR-MLB', 'PR-TBT', 'PR-THI', 'PR-VOB', 'PR-VOC', 'PR-VOI', 'PR-VOP', 'PR-VOW', 'PR-VOZ'],
  'C172': ['PP-ABP', 'PP-AJS', 'PR-BUL', 'PR-CPL', 'PR-HAR', 'PR-VOY'],
  'PA-34': ['PR-VOM', 'PT-JOB', 'PT-KIW']
};

export const FROTA = Object.values(FROTA_POR_TIPO).flat();

export const LIMITES = { 'C152': 170, 'C172': 222, 'PA-34': 250 };

export const dois = n => String(n).padStart(2, '0');

// 40 instrutores fictícios com a mesma distribuição de níveis do estado inicial da aplicação (A01–A09 em ciclo)
export function rosterSintetico(n = 40) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nm: `Instrutor ${dois(i + 1)}`,
    on: true,
    lv: (i % 9) + 1,
    kg: 55 + ((i * 17) % 45),
    aw: Array(JANELAS).fill(true)
  }));
}

export function estadoSintetico() {
  return {
    schemaVer: 4,
    win: Array(JANELAS).fill(true),
    av: Object.fromEntries(FROTA.map(r => [r, true])),
    lim: { ...LIMITES },
    nid: 1000,
    ins: rosterSintetico(),
    stu: [],
    fStatus: {}
  };
}
