const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const password = "123456";

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function login(email) {
  const response = await tryLogin(email);
  if (response.status !== 200) throw new Error(`Login failed for ${email}: ${response.status}`);
  if (!response.cookie) throw new Error(`Missing auth cookie for ${email}`);
  return response.cookie;
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
  const ok = actual === expected;
  results.push({ name, ok, detail: `status ${actual}, expected ${expected}` });
}

function expect(results, name, ok, detail) {
  results.push({ name, ok, detail });
}

async function main() {
  const results = [];
  const owner = await login("dono@empresa.com");
  const manager = await login("gerente@empresa.com");
  const supervisor = await login("supervisor@empresa.com");
  const collaborator = await login("colaborador@empresa.com");
  const warehouse = await login("almoxarifado@empresa.com");

  const ownerManager = await request(owner, "POST", "/api/users", {
    name: "Gerente Smoke",
    email: `${unique("gerente-smoke")}@empresa.com`,
    role: "GERENTE",
    temporaryPassword: "123456",
  });
  expectStatus(results, "OWNER cria GERENTE", ownerManager.status, 201);

  const ownerEditManager = ownerManager.json?.user?.id
    ? await request(owner, "PATCH", `/api/users/${ownerManager.json.user.id}`, { name: "Gerente Smoke Atualizado" })
    : { status: 0 };
  expectStatus(results, "OWNER edita GERENTE criado", ownerEditManager.status, 200);

  const ownerOrders = await request(owner, "GET", "/api/service-orders");
  expectStatus(results, "OWNER lista todas as OS", ownerOrders.status, 200);
  expect(
    results,
    "OWNER ve obras de supervisores diferentes",
    ownerOrders.json?.serviceOrders?.some((order) => order.id === "os-2401") &&
      ownerOrders.json?.serviceOrders?.some((order) => order.id === "os-2402"),
    "os-2401 e os-2402 devem aparecer para OWNER",
  );

  const ownerCreateOwner = await request(owner, "POST", "/api/users", {
    name: "Owner Bloqueado",
    email: `${unique("owner-blocked")}@empresa.com`,
    role: "OWNER",
    temporaryPassword: "123456",
  });
  expectStatus(results, "API normal nao cria OWNER", ownerCreateOwner.status, 403);

  const duplicateEmail = await request(owner, "POST", "/api/users", {
    name: "Email Duplicado",
    email: "dono@empresa.com",
    role: "COLABORADOR",
    temporaryPassword: "123456",
  });
  expectStatus(results, "E-mail duplicado retorna 409", duplicateEmail.status, 409);

  const ownerEditOwner = await request(owner, "PATCH", "/api/users/usr-owner", { name: "Owner Protegido" });
  expectStatus(results, "OWNER nao edita OWNER por API normal", ownerEditOwner.status, 403);

  const ownerDeactivateOwner = await request(owner, "POST", "/api/users/usr-owner/deactivate");
  expectStatus(results, "OWNER nao desativa ultimo OWNER", ownerDeactivateOwner.status, 403);

  const inactiveEmail = `${unique("inactive-user")}@empresa.com`;
  const inactiveUser = await request(owner, "POST", "/api/users", {
    name: "Usuario Inativo Smoke",
    email: inactiveEmail,
    role: "COLABORADOR",
    temporaryPassword: "123456",
  });
  expectStatus(results, "OWNER cria usuario para teste de inativo", inactiveUser.status, 201);
  const inactiveCookie = inactiveUser.status === 201 ? (await tryLogin(inactiveEmail)).cookie : undefined;
  const inactiveUserId = inactiveUser.json?.user?.id;
  const deactivateInactiveUser = inactiveUserId
    ? await request(owner, "POST", `/api/users/${inactiveUserId}/deactivate`)
    : { status: 0 };
  expectStatus(results, "OWNER desativa usuario comum", deactivateInactiveUser.status, 200);
  const inactiveOldSession = inactiveCookie
    ? await request(inactiveCookie, "GET", "/api/service-orders")
    : { status: 0 };
  expectStatus(results, "Sessao antiga de usuario inativo fica invalida", inactiveOldSession.status, 401);
  const inactiveLogin = await tryLogin(inactiveEmail);
  expectStatus(results, "Usuario inativo nao faz login", inactiveLogin.status, 401);

  const supervisorNoEmployeeEmail = `${unique("supervisor-sem-employee")}@empresa.com`;
  const supervisorNoEmployeeUser = await request(owner, "POST", "/api/users", {
    name: "Supervisor Sem Colaborador",
    email: supervisorNoEmployeeEmail,
    role: "SUPERVISOR_OBRA",
    temporaryPassword: "123456",
  });
  expectStatus(results, "OWNER cria supervisor sem Employee vinculado", supervisorNoEmployeeUser.status, 201);
  const supervisorNoEmployeeCookie = supervisorNoEmployeeUser.status === 201 ? await login(supervisorNoEmployeeEmail) : "";
  const supervisorNoEmployeeOrders = supervisorNoEmployeeCookie
    ? await request(supervisorNoEmployeeCookie, "GET", "/api/service-orders")
    : { status: 0, json: null };
  expectStatus(results, "Supervisor sem Employee acessa API com lista vazia", supervisorNoEmployeeOrders.status, 200);
  expect(
    results,
    "Supervisor sem Employee nao recebe obras",
    Array.isArray(supervisorNoEmployeeOrders.json?.serviceOrders) && supervisorNoEmployeeOrders.json.serviceOrders.length === 0,
    "sem employee vinculado nao deve haver OS atribuida",
  );

  const ownerEmployee = await request(owner, "POST", "/api/employees", {
    name: "Colaborador Smoke Owner",
    phone: "(11) 90000-1000",
    email: `${unique("owner-emp")}@empresa.com`,
    document: unique("DOC-OWNER"),
    roleName: "Polidor",
    jobTitle: "Polidor",
    specialty: "Polimento",
    status: "ACTIVE",
    dailyCost: 180,
    hiredAt: "2026-07-03",
    notes: "Smoke test",
  });
  expectStatus(results, "OWNER cria colaborador", ownerEmployee.status, 201);

  const ownerPromoteEmployee = await request(owner, "POST", "/api/employees", {
    name: "Supervisor Smoke Owner",
    phone: "(11) 90000-1001",
    email: `${unique("owner-supervisor")}@empresa.com`,
    document: unique("DOC-SUP-OWNER"),
    roleName: "Tecnico",
    jobTitle: "Tecnico",
    specialty: "Restauracao",
    status: "ACTIVE",
    dailyCost: 220,
    hiredAt: "2026-07-03",
    notes: "Smoke test",
  });
  const ownerPromote = ownerPromoteEmployee.json?.employee?.id
    ? await request(owner, "POST", `/api/employees/${ownerPromoteEmployee.json.employee.id}/promote-to-supervisor`, {
        email: `${unique("owner-promoted")}@empresa.com`,
        temporaryPassword: "123456",
      })
    : { status: 0 };
  expectStatus(results, "OWNER promove supervisor", ownerPromote.status, 200);

  const ownerAssign = await request(owner, "POST", "/api/service-orders/os-2403/assign-supervisor", {
    supervisorEmployeeId: "emp-luciana",
  });
  expectStatus(results, "OWNER designa supervisor", ownerAssign.status, 200);

  const ownerAssignEmployeeWithoutSupervisorUser = await request(owner, "POST", "/api/service-orders/os-2403/assign-supervisor", {
    supervisorEmployeeId: "emp-ines",
  });
  expectStatus(results, "Nao designa colaborador sem login de supervisor", ownerAssignEmployeeWithoutSupervisorUser.status, 400);

  const managerEmployee = await request(manager, "POST", "/api/employees", {
    name: "Colaborador Smoke Gerente",
    phone: "(11) 90000-2000",
    email: `${unique("manager-emp")}@empresa.com`,
    document: unique("DOC-MANAGER"),
    roleName: "Auxiliar",
    jobTitle: "Auxiliar",
    specialty: "Limpeza pos-obra",
    status: "ACTIVE",
    dailyCost: 150,
    hiredAt: "2026-07-03",
    notes: "Smoke test",
  });
  expectStatus(results, "GERENTE cria colaborador", managerEmployee.status, 201);

  const employeeWithoutLogin = await request(manager, "POST", "/api/employees", {
    name: "Colaborador Sem Login Smoke",
    phone: "(11) 90000-2100",
    email: `${unique("sem-login")}@empresa.com`,
    document: unique("DOC-SEM-LOGIN"),
    roleName: "Auxiliar",
    jobTitle: "Auxiliar",
    specialty: "Apoio operacional",
    status: "ACTIVE",
    dailyCost: 145,
    hiredAt: "2026-07-03",
    notes: "Sem acesso ao sistema",
  });
  expectStatus(results, "Colaborador pode existir sem login", employeeWithoutLogin.status, 201);
  expect(
    results,
    "Colaborador sem createAccess retorna user null",
    employeeWithoutLogin.json?.user === null,
    "cadastro operacional nao deve criar usuario automaticamente",
  );

  const managerPromote = managerEmployee.json?.employee?.id
    ? await request(manager, "POST", `/api/employees/${managerEmployee.json.employee.id}/promote-to-supervisor`, {
        email: `${unique("manager-promoted")}@empresa.com`,
        temporaryPassword: "123456",
      })
    : { status: 0 };
  expectStatus(results, "GERENTE promove supervisor", managerPromote.status, 200);

  const managerAssign = await request(manager, "POST", "/api/service-orders/os-2405/assign-supervisor", {
    supervisorEmployeeId: "emp-luciana",
  });
  expectStatus(results, "GERENTE designa supervisor", managerAssign.status, 200);

  const managerCreateManager = await request(manager, "POST", "/api/users", {
    name: "Gerente Bloqueado",
    email: `${unique("manager-blocked")}@empresa.com`,
    role: "GERENTE",
    temporaryPassword: "123456",
  });
  expectStatus(results, "GERENTE nao cria GERENTE", managerCreateManager.status, 403);

  const managerChangeToManager = await request(manager, "POST", "/api/users/usr-colaborador/change-role", { role: "GERENTE" });
  expectStatus(results, "GERENTE nao altera para GERENTE", managerChangeToManager.status, 403);

  const managerEditOwner = await request(manager, "PATCH", "/api/users/usr-owner", { name: "Owner editado" });
  expectStatus(results, "GERENTE nao edita OWNER", managerEditOwner.status, 403);

  const supervisorOrders = await request(supervisor, "GET", "/api/service-orders");
  expectStatus(results, "SUPERVISOR lista OS", supervisorOrders.status, 200);
  expect(
    results,
    "SUPERVISOR nao ve OS de outro supervisor",
    !supervisorOrders.json?.serviceOrders?.some((order) => order.id === "os-2402"),
    "os-2402 pertence a outro supervisor",
  );
  expectStatus(results, "SUPERVISOR nao cria colaborador", (await request(supervisor, "POST", "/api/employees", {})).status, 403);
  expectStatus(results, "SUPERVISOR nao cria usuario", (await request(supervisor, "POST", "/api/users", {})).status, 403);
  expectStatus(results, "SUPERVISOR nao acessa API usuarios", (await request(supervisor, "GET", "/api/users")).status, 403);
  const supervisorUsersPage = await request(supervisor, "GET", "/usuarios");
  expect(results, "SUPERVISOR nao acessa /usuarios", supervisorUsersPage.text.includes("Acesso restrito"), "pagina deve mostrar acesso restrito");

  const collaboratorOrders = await request(collaborator, "GET", "/api/service-orders");
  expectStatus(results, "COLABORADOR lista proprias OS", collaboratorOrders.status, 200);
  expect(
    results,
    "COLABORADOR nao ve servico alheio",
    !collaboratorOrders.json?.serviceOrders?.some((order) => order.id === "os-2402"),
    "os-2402 nao tem Joao escalado",
  );
  expectStatus(results, "COLABORADOR nao acessa usuarios", (await request(collaborator, "GET", "/api/users")).status, 403);
  expectStatus(results, "COLABORADOR nao altera roles", (await request(collaborator, "POST", "/api/users/usr-colaborador/change-role", { role: "SUPERVISOR_OBRA" })).status, 403);
  const collaboratorOrderDetail = await request(collaborator, "GET", "/api/service-orders/os-2401");
  expectStatus(results, "COLABORADOR acessa detalhe da propria OS", collaboratorOrderDetail.status, 200);
  expect(
    results,
    "COLABORADOR nao recebe financeiro no detalhe",
    Number(collaboratorOrderDetail.json?.serviceOrder?.revenue ?? 0) === 0 &&
      Number(collaboratorOrderDetail.json?.serviceOrder?.expenses ?? 0) === 0,
    "receita/despesa devem vir zeradas no detalhe",
  );

  const warehouseOrders = await request(warehouse, "GET", "/api/service-orders");
  expectStatus(results, "ALMOXARIFADO lista OS minimas", warehouseOrders.status, 200);
  expect(
    results,
    "ALMOXARIFADO nao recebe financeiro completo",
    warehouseOrders.json?.serviceOrders?.every((order) => Number(order.revenue ?? 0) === 0 && Number(order.expenses ?? 0) === 0),
    "receita/despesa devem vir zeradas na lista operacional",
  );
  expectStatus(results, "ALMOXARIFADO nao cria colaborador", (await request(warehouse, "POST", "/api/employees", {})).status, 403);
  expectStatus(results, "ALMOXARIFADO nao altera roles", (await request(warehouse, "POST", "/api/users/usr-colaborador/change-role", { role: "SUPERVISOR_OBRA" })).status, 403);
  const warehouseOrderDetail = await request(warehouse, "GET", "/api/service-orders/os-2401");
  expectStatus(results, "ALMOXARIFADO acessa detalhe operacional da OS", warehouseOrderDetail.status, 200);
  expect(
    results,
    "ALMOXARIFADO nao recebe financeiro no detalhe",
    Number(warehouseOrderDetail.json?.serviceOrder?.revenue ?? 0) === 0 &&
      Number(warehouseOrderDetail.json?.serviceOrder?.expenses ?? 0) === 0,
    "receita/despesa devem vir zeradas no detalhe",
  );

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} - ${result.name} (${result.detail})`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
