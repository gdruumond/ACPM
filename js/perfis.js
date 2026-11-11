// Perfis de acesso no modo compartilhado e o que cada um pode fazer. O Administrador tem tudo o que o Operador tem e,
// além disso, cria e exclui contas. (O servidor confere tudo de novo: estas regras só decidem o que a tela mostra.)
export const ROTULOS = { operador: 'Operador', gestor: 'Gestor', secretaria: 'Secretaria', administrador: 'Administrador' };
export const PERFIS = Object.keys(ROTULOS);

export const operaEscala = perfil => perfil === 'operador' || perfil === 'administrador';
export const registraNaAgenda = perfil => operaEscala(perfil) || perfil === 'secretaria';
export const gerenciaContas = perfil => perfil === 'administrador';
