// Dados no formato anterior para testar a atualização do formato: simuladores com os nomes antigos.
const NOMES_ANTIGOS = { 'SIM-MONO-A': 'SIM-MONO-1', 'SIM-MONO-C': 'SIM-MONO-2', 'SIM-MLTE-E': 'SIM-MULTI-1', 'SIM-MLTE-D': 'SIM-MULTI-2' };

export const comNomesAntigos = valor =>
  JSON.parse(Object.entries(NOMES_ANTIGOS).reduce((json, [novo, antigo]) => json.split(`"${novo}"`).join(`"${antigo}"`), JSON.stringify(valor)));
