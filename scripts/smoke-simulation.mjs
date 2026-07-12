const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const password = "123456";

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryLogin(email, loginPassword = password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: loginPassword }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { text };
  }
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return { status: response.status, cookie, json, text };
}

async function login(email) {
  const response = await tryLogin(email);
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status} ${response.text}`);
  if (!response.cookie) throw new Error(`Missing auth cookie for ${email}`);
  return response.cookie;
}

async function request(cookie, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { text };
  }
  return { status: response.status, json, text };
}

function expectStatus(results, name, actual, expected) {
  results.push({ name, ok: actual === expected, detail: `status ${actual}, expected ${expected}` });
}

function expect(results, name, ok, detail) {
  results.push({ name, ok, detail });
}

async function createEmployee(ownerCookie, input) {
  await sleep(8);
  return request(ownerCookie, "POST", "/api/employees", {
    phone: "(11) 90000-0000",
    document: unique("DOC"),
    jobTitle: input.roleName,
    status: "ACTIVE",
    dailyCost: 180,
    hiredAt: "2026-07-04",
    notes: "Criado pelo smoke de simulacao limpa.",
    temporaryPassword: password,
    ...input,
  });
}

async function main() {
  const results = [];

  const oldManagerLogin = await tryLogin("gerente@empresa.com");
  expectStatus(results, "Base limpa nao permite login do gerente antigo", oldManagerLogin.status, 401);

  const owner = await login("dono@empresa.com");

  const initialUsers = await request(owner, "GET", "/api/users");
  expectStatus(results, "OWNER lista usuarios na base limpa", initialUsers.status, 200);
  expect(
    results,
    "Base limpa tem somente o Dono como perfil inicial",
    initialUsers.json?.users?.length === 1 && initialUsers.json.users[0]?.role === "OWNER",
    JSON.stringify(initialUsers.json?.users ?? []),
  );

  const initialOrders = await request(owner, "GET", "/api/service-orders");
  expectStatus(results, "OWNER lista OS na base limpa", initialOrders.status, 200);
  expect(
    results,
    "Base limpa nao tem ordens de servico",
    Array.isArray(initialOrders.json?.serviceOrders) && initialOrders.json.serviceOrders.length === 0,
    JSON.stringify(initialOrders.json?.serviceOrders ?? []),
  );

  const managerEmail = `${unique("gerente-sim")}@empresa.com`;
  const managerUser = await request(owner, "POST", "/api/users", {
    name: "Gerente Simulacao",
    email: managerEmail,
    role: "GERENTE",
    temporaryPassword: password,
  });
  expectStatus(results, "OWNER cria GERENTE para a simulacao", managerUser.status, 201);
  const manager = await login(managerEmail);

  const supervisorEmail = `${unique("supervisor-sim")}@empresa.com`;
  const supervisorEmployee = await createEmployee(owner, {
    name: "Supervisor Simulacao",
    email: supervisorEmail,
    roleName: "Supervisor de obra",
    specialty: "Restauracao de marmore",
    createAccess: true,
    accessRole: "SUPERVISOR_OBRA",
  });
  expectStatus(results, "OWNER cria supervisor com acesso", supervisorEmployee.status, 201);
  const supervisorEmployeeId = supervisorEmployee.json?.employee?.id;
  const supervisor = await login(supervisorEmail);

  const collaboratorOneEmail = `${unique("colab-polimento")}@empresa.com`;
  const collaboratorOne = await createEmployee(owner, {
    name: "Colaborador Polimento",
    email: collaboratorOneEmail,
    roleName: "Polidor",
    specialty: "Polimento de granito",
    createAccess: true,
    accessRole: "COLABORADOR",
  });
  expectStatus(results, "OWNER cria colaborador 1 com acesso", collaboratorOne.status, 201);
  const collaboratorOneId = collaboratorOne.json?.employee?.id;
  const collaboratorOneCookie = await login(collaboratorOneEmail);

  const collaboratorTwoEmail = `${unique("colab-limpeza")}@empresa.com`;
  const collaboratorTwo = await createEmployee(owner, {
    name: "Colaborador Limpeza",
    email: collaboratorTwoEmail,
    roleName: "Auxiliar",
    specialty: "Limpeza pos-obra",
    createAccess: true,
    accessRole: "COLABORADOR",
  });
  expectStatus(results, "OWNER cria colaborador 2 com acesso", collaboratorTwo.status, 201);
  const collaboratorTwoId = collaboratorTwo.json?.employee?.id;
  const collaboratorTwoCookie = await login(collaboratorTwoEmail);

  const orderResponse = await request(owner, "POST", "/api/service-orders", {
    customerId: "cliente-simulacao",
    customerName: "Cliente Alto Padrao Simulacao",
    title: "Restauracao de marmore e limpeza pos-obra",
    serviceType: "RESTORATION",
    description: "Servico captado pelo dono para validar o fluxo operacional completo.",
    address: "Rua da Apresentacao, 100 - Sao Paulo",
    scheduledStart: "2026-07-06T08:00:00",
    scheduledEnd: "2026-07-08T18:00:00",
    status: "SCHEDULED",
    revenue: 50000,
    expenses: 12000,
  });
  expectStatus(results, "OWNER cria a OS da simulacao", orderResponse.status, 201);
  const orderId = orderResponse.json?.serviceOrder?.id;
  expect(results, "OWNER recebe valores financeiros da OS", orderResponse.json?.serviceOrder?.revenue === 50000, JSON.stringify(orderResponse.json?.serviceOrder));

  const managerOrderBeforeTeam = await request(manager, "GET", `/api/service-orders/${orderId}`);
  expectStatus(results, "GERENTE acessa OS criada pelo dono", managerOrderBeforeTeam.status, 200);
  expect(
    results,
    "GERENTE nao recebe valores financeiros da OS",
    managerOrderBeforeTeam.json?.serviceOrder?.revenue === 0 && managerOrderBeforeTeam.json?.serviceOrder?.expenses === 0,
    JSON.stringify(managerOrderBeforeTeam.json?.serviceOrder),
  );

  const financePageAsManager = await request(manager, "GET", "/financeiro");
  expectStatus(results, "GERENTE nao acessa pagina financeira", financePageAsManager.status, 404);

  const assignSupervisor = await request(manager, "POST", `/api/service-orders/${orderId}/assign-supervisor`, {
    supervisorEmployeeId,
  });
  expectStatus(results, "GERENTE designa supervisor da obra", assignSupervisor.status, 200);

  const assignCollaboratorOne = await request(manager, "POST", `/api/service-orders/${orderId}/employees`, {
    employeeId: collaboratorOneId,
    roleInService: "POLIDOR",
  });
  expectStatus(results, "GERENTE adiciona colaborador 1 na equipe", assignCollaboratorOne.status, 201);

  const assignCollaboratorTwo = await request(manager, "POST", `/api/service-orders/${orderId}/employees`, {
    employeeId: collaboratorTwoId,
    roleInService: "AUXILIAR",
  });
  expectStatus(results, "GERENTE adiciona colaborador 2 na equipe", assignCollaboratorTwo.status, 201);

  const supervisorOrders = await request(supervisor, "GET", "/api/service-orders");
  expectStatus(results, "SUPERVISOR ve suas OS", supervisorOrders.status, 200);
  expect(
    results,
    "SUPERVISOR ve somente a OS atribuida e sem financeiro",
    supervisorOrders.json?.serviceOrders?.length === 1 &&
      supervisorOrders.json.serviceOrders[0]?.id === orderId &&
      supervisorOrders.json.serviceOrders[0]?.revenue === 0,
    JSON.stringify(supervisorOrders.json?.serviceOrders),
  );

  const checklistItem = await request(manager, "POST", `/api/service-orders/${orderId}/checklist`, {
    title: "Polimento tecnico do marmore",
    description: "Executar protecao, lixamento fino, polimento e registro fotografico.",
    sortOrder: 1,
    isRequired: true,
    requiresPhoto: false,
    allowCollaboratorAction: true,
  });
  expectStatus(results, "GERENTE cria item de checklist", checklistItem.status, 201);
  const checklistItemId = checklistItem.json?.item?.id;

  const supervisorAssignChecklist = await request(supervisor, "POST", `/api/service-orders/${orderId}/checklist/${checklistItemId}/assign`, {
    employeeIds: [collaboratorOneId, collaboratorTwoId],
  });
  expectStatus(results, "SUPERVISOR atribui tarefa a dois colaboradores", supervisorAssignChecklist.status, 200);
  expect(
    results,
    "Checklist aceita multiplos colaboradores no mesmo item",
    supervisorAssignChecklist.json?.item?.assignedEmployeeIds?.includes(collaboratorOneId) &&
      supervisorAssignChecklist.json?.item?.assignedEmployeeIds?.includes(collaboratorTwoId),
    JSON.stringify(supervisorAssignChecklist.json?.item),
  );

  const collaboratorOrders = await request(collaboratorOneCookie, "GET", "/api/service-orders");
  expectStatus(results, "COLABORADOR lista apenas OS atribuida", collaboratorOrders.status, 200);
  expect(
    results,
    "COLABORADOR nao recebe financeiro e ve somente seu servico",
    collaboratorOrders.json?.serviceOrders?.length === 1 &&
      collaboratorOrders.json.serviceOrders[0]?.id === orderId &&
      collaboratorOrders.json.serviceOrders[0]?.revenue === 0,
    JSON.stringify(collaboratorOrders.json?.serviceOrders),
  );

  const collaboratorTeam = await request(collaboratorOneCookie, "GET", "/api/employees");
  expectStatus(results, "COLABORADOR lista somente equipe relacionada", collaboratorTeam.status, 200);
  const collaboratorTeamIds = new Set((collaboratorTeam.json?.employees ?? []).map((employee) => employee.id));
  expect(
    results,
    "Equipe visivel ao colaborador contem supervisor e colaboradores da OS",
    [supervisorEmployeeId, collaboratorOneId, collaboratorTwoId].every((id) => collaboratorTeamIds.has(id)),
    JSON.stringify(collaboratorTeam.json?.employees ?? []),
  );

  const collaboratorChecklist = await request(collaboratorOneCookie, "GET", `/api/service-orders/${orderId}/checklist`);
  expectStatus(results, "COLABORADOR ve checklist completo da OS", collaboratorChecklist.status, 200);
  expect(
    results,
    "Checklist completo contem o item atribuido aos dois",
    collaboratorChecklist.json?.checklist?.length === 1 &&
      collaboratorChecklist.json.checklist[0]?.assignedEmployeeIds?.length === 2,
    JSON.stringify(collaboratorChecklist.json?.checklist ?? []),
  );

  const startByFirst = await request(collaboratorOneCookie, "POST", `/api/service-orders/${orderId}/checklist/${checklistItemId}/start`);
  expectStatus(results, "COLABORADOR inicia item disponivel", startByFirst.status, 200);

  const startBySecond = await request(collaboratorTwoCookie, "POST", `/api/service-orders/${orderId}/checklist/${checklistItemId}/start`);
  expectStatus(results, "Outro COLABORADOR nao inicia item ja iniciado", startBySecond.status, 409);

  const completeBySecond = await request(collaboratorTwoCookie, "POST", `/api/service-orders/${orderId}/checklist/${checklistItemId}/complete`, {
    completedByEmployeeId: collaboratorTwoId,
    completionNotes: "Tentativa bloqueada porque outro colaborador iniciou.",
  });
  expectStatus(results, "Outro COLABORADOR nao conclui item iniciado por terceiro", completeBySecond.status, 409);

  const completeByFirst = await request(collaboratorOneCookie, "POST", `/api/service-orders/${orderId}/checklist/${checklistItemId}/complete`, {
    completedByEmployeeId: collaboratorOneId,
    completionNotes: "Tarefa concluida pelo responsavel que iniciou.",
  });
  expectStatus(results, "COLABORADOR conclui item iniciado por ele", completeByFirst.status, 200);

  const collaboratorCannotEvaluate = await request(collaboratorOneCookie, "POST", "/api/evaluations", {
    serviceOrderId: orderId,
    employeeId: collaboratorTwoId,
    employeeName: "Colaborador Limpeza",
    punctualityScore: 5,
    qualityScore: 5,
    productivityScore: 5,
    careScore: 5,
    teamworkScore: 5,
    clientPostureScore: 5,
    checklistComplianceScore: 5,
    positiveNotes: "Tentativa indevida.",
    improvementNotes: "Sem registro.",
  });
  expectStatus(results, "COLABORADOR nao avalia equipe", collaboratorCannotEvaluate.status, 403);

  const supervisorEvaluates = await request(supervisor, "POST", "/api/evaluations", {
    serviceOrderId: orderId,
    employeeId: collaboratorOneId,
    employeeName: "Colaborador Polimento",
    punctualityScore: 5,
    qualityScore: 5,
    productivityScore: 4,
    careScore: 5,
    teamworkScore: 5,
    clientPostureScore: 5,
    checklistComplianceScore: 5,
    positiveNotes: "Boa entrega tecnica.",
    improvementNotes: "Manter fotos organizadas por etapa.",
  });
  expectStatus(results, "SUPERVISOR avalia colaborador da obra", supervisorEvaluates.status, 201);

  const supervisorCannotCreateEmployee = await createEmployee(supervisor, {
    name: "Criacao Bloqueada",
    email: `${unique("bloqueado")}@empresa.com`,
    roleName: "Auxiliar",
    specialty: "Teste",
  });
  expectStatus(results, "SUPERVISOR nao cria colaborador", supervisorCannotCreateEmployee.status, 403);

  const failed = results.filter((result) => !result.ok);
  for (const result of results) {
    const marker = result.ok ? "OK" : "FAIL";
    console.log(`${marker} - ${result.name} (${result.detail ?? ""})`);
  }

  if (failed.length) {
    console.error(`\n${failed.length} falha(s) no smoke de simulacao.`);
    process.exit(1);
  }

  console.log(`\n${results.length} verificacoes passaram.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
