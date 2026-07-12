const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const password = "123456";

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function login(email) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login failed for ${email}: ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`Missing auth cookie for ${email}`);
  return cookie;
}

async function request(cookie, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
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

async function main() {
  const results = [];
  const owner = await login("dono@empresa.com");
  const manager = await login("gerente@empresa.com");
  const supervisor = await login("supervisor@empresa.com");
  const collaborator = await login("colaborador@empresa.com");
  const warehouse = await login("almoxarifado@empresa.com");

  expectStatus(results, "Sem autenticacao nao ve checklist", (await request("", "GET", "/api/service-orders/os-2401/checklist")).status, 401);

  const ownerChecklist = await request(owner, "GET", "/api/service-orders/os-2401/checklist");
  expectStatus(results, "OWNER ve checklist", ownerChecklist.status, 200);
  expect(results, "Checklist retorna progresso", typeof ownerChecklist.json?.progress?.progressPercent === "number", "progressPercent presente");

  const ownerTemplate = await request(owner, "POST", "/api/checklist-templates", {
    name: `Template Smoke ${unique("tpl")}`,
    serviceType: "RESTORATION",
    items: [
      { title: "Preparar area smoke", description: "Protecao inicial", sortOrder: 1, requiresPhoto: true, minimumPhotos: 1 },
      { title: "Finalizar area smoke", description: "Entrega", sortOrder: 2, requiresPhoto: false },
    ],
  });
  expectStatus(results, "OWNER cria template", ownerTemplate.status, 201);

  const applyTemplate = await request(owner, "POST", "/api/service-orders/os-2406/checklist/apply-template", {
    templateId: ownerTemplate.json?.template?.id,
  });
  expectStatus(results, "OWNER aplica template", applyTemplate.status, 200);

  const ownerItem = await request(owner, "POST", "/api/service-orders/os-2401/checklist", {
    title: `Item OWNER ${unique("chk")}`,
    description: "Item criado pelo smoke para validacao completa.",
    assignedEmployeeId: "emp-joao",
    requiresPhoto: true,
    minimumPhotos: 1,
    allowCollaboratorAction: true,
    dueAt: "2026-07-05T12:00:00",
  });
  expectStatus(results, "OWNER cria item", ownerItem.status, 201);
  const ownerItemId = ownerItem.json?.item?.id;

  expectStatus(results, "OWNER edita item", (await request(owner, "PATCH", `/api/service-orders/os-2401/checklist/${ownerItemId}`, { title: "Item OWNER editado" })).status, 200);
  expectStatus(results, "OWNER atribui colaborador", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/assign`, { employeeId: "emp-joao" })).status, 200);
  expectStatus(results, "OWNER inicia item", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/start`)).status, 200);
  expectStatus(results, "OWNER recebe erro sem foto obrigatoria", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/complete`, { completedByEmployeeId: "emp-joao", completionNotes: "Sem foto" })).status, 400);
  expectStatus(results, "URL de foto invalida e bloqueada", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/complete`, { completedByEmployeeId: "emp-joao", completionNotes: "Foto externa", photos: [{ url: "https://example.com/foto.jpg", type: "EVIDENCE" }] })).status, 400);
  expectStatus(results, "OWNER conclui com foto", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/complete`, { completedByEmployeeId: "emp-joao", completionNotes: "Finalizado com evidencia.", photos: [{ url: "/uploads/checklist/owner-smoke.jpg", type: "EVIDENCE", caption: "Evidencia smoke" }] })).status, 200);
  expectStatus(results, "Conclusao duplicada retorna conflito", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/complete`, { completedByEmployeeId: "emp-joao", photos: [{ url: "/uploads/checklist/owner-smoke-2.jpg" }] })).status, 409);
  expectStatus(results, "OWNER valida item", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/validate`)).status, 200);
  expectStatus(results, "Reabertura sem motivo falha", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/reopen`, { reason: "" })).status, 400);
  expectStatus(results, "OWNER reabre item", (await request(owner, "POST", `/api/service-orders/os-2401/checklist/${ownerItemId}/reopen`, { reason: "Foto precisa mostrar o canto esquerdo." })).status, 200);
  const ownerHistory = await request(owner, "GET", `/api/service-orders/os-2401/checklist/${ownerItemId}/history`);
  expectStatus(results, "OWNER visualiza historico", ownerHistory.status, 200);
  expect(results, "Historico tem eventos", ownerHistory.json?.events?.length >= 4, "eventos de criacao, inicio, conclusao e reabertura");

  const managerItem = await request(manager, "POST", "/api/service-orders/os-2402/checklist", {
    title: `Item GERENTE ${unique("chk")}`,
    description: "Gerente cria e opera checklist.",
    assignedEmployeeId: "emp-marina",
    requiresPhoto: false,
  });
  expectStatus(results, "GERENTE cria checklist", managerItem.status, 201);
  const managerItemId = managerItem.json?.item?.id;
  expectStatus(results, "GERENTE edita checklist", (await request(manager, "PATCH", `/api/service-orders/os-2402/checklist/${managerItemId}`, { description: "Descricao editada" })).status, 200);
  expectStatus(results, "GERENTE atribui colaborador", (await request(manager, "POST", `/api/service-orders/os-2402/checklist/${managerItemId}/assign`, { employeeId: "emp-ines" })).status, 200);
  expectStatus(results, "GERENTE conclui checklist", (await request(manager, "POST", `/api/service-orders/os-2402/checklist/${managerItemId}/complete`, { completedByEmployeeId: "emp-ines", completionNotes: "Executado pelo gerente." })).status, 200);
  expectStatus(results, "GERENTE valida checklist", (await request(manager, "POST", `/api/service-orders/os-2402/checklist/${managerItemId}/validate`)).status, 200);
  expectStatus(results, "GERENTE reabre checklist", (await request(manager, "POST", `/api/service-orders/os-2402/checklist/${managerItemId}/reopen`, { reason: "Revisar acabamento." })).status, 200);

  expectStatus(results, "SUPERVISOR ve checklist da propria obra", (await request(supervisor, "GET", "/api/service-orders/os-2401/checklist")).status, 200);
  expectStatus(results, "SUPERVISOR nao ve checklist de outro supervisor", (await request(supervisor, "GET", "/api/service-orders/os-2402/checklist")).status, 403);
  expectStatus(results, "SUPERVISOR nao cria checklist geral", (await request(supervisor, "POST", "/api/service-orders/os-2401/checklist", { title: "Bloqueado" })).status, 403);

  const supervisorItem = await request(owner, "POST", "/api/service-orders/os-2401/checklist", {
    title: `Item SUPERVISOR ${unique("chk")}`,
    description: "Item para supervisor operar.",
    assignedEmployeeId: "emp-joao",
    requiresPhoto: true,
    minimumPhotos: 1,
  });
  const supervisorItemId = supervisorItem.json?.item?.id;
  expectStatus(results, "SUPERVISOR atribui equipe propria", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/assign`, { employeeId: "emp-ines" })).status, 200);
  expectStatus(results, "SUPERVISOR nao atribui fora da equipe", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/assign`, { employeeId: "emp-bianca" })).status, 400);
  expectStatus(results, "SUPERVISOR recebe erro sem foto", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/complete`, { completedByEmployeeId: "emp-ines" })).status, 400);
  expectStatus(results, "SUPERVISOR conclui com foto", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/complete`, { completedByEmployeeId: "emp-ines", photos: [{ url: "/uploads/checklist/supervisor-smoke.png", type: "AFTER" }] })).status, 200);
  expectStatus(results, "SUPERVISOR valida item", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/validate`)).status, 200);
  expectStatus(results, "SUPERVISOR reabre item", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${supervisorItemId}/reopen`, { reason: "Revisar evidencia final." })).status, 200);

  const blockItem = await request(owner, "POST", "/api/service-orders/os-2401/checklist", { title: `Bloqueio ${unique("chk")}`, assignedEmployeeId: "emp-joao" });
  const blockItemId = blockItem.json?.item?.id;
  expectStatus(results, "SUPERVISOR bloqueia item", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${blockItemId}/block`, { reason: "Material ainda nao chegou." })).status, 200);
  expectStatus(results, "SUPERVISOR desbloqueia item", (await request(supervisor, "POST", `/api/service-orders/os-2401/checklist/${blockItemId}/unblock`)).status, 200);

  expectStatus(results, "COLABORADOR ve checklist da propria obra", (await request(collaborator, "GET", "/api/service-orders/os-2401/checklist")).status, 200);
  expectStatus(results, "COLABORADOR nao ve checklist de outra obra", (await request(collaborator, "GET", "/api/service-orders/os-2402/checklist")).status, 403);
  expectStatus(results, "COLABORADOR nao altera checklist geral", (await request(collaborator, "PATCH", `/api/service-orders/os-2401/checklist/${blockItemId}`, { title: "Nao pode" })).status, 403);
  expectStatus(results, "COLABORADOR nao valida", (await request(collaborator, "POST", `/api/service-orders/os-2401/checklist/${blockItemId}/validate`)).status, 403);
  expectStatus(results, "COLABORADOR nao reabre", (await request(collaborator, "POST", `/api/service-orders/os-2401/checklist/${blockItemId}/reopen`, { reason: "Nao pode" })).status, 403);

  const collaboratorItem = await request(owner, "POST", "/api/service-orders/os-2401/checklist", {
    title: `Item COLABORADOR ${unique("chk")}`,
    assignedEmployeeId: "emp-joao",
    allowCollaboratorAction: true,
    requiresPhoto: false,
  });
  const collaboratorItemId = collaboratorItem.json?.item?.id;
  expectStatus(results, "COLABORADOR inicia tarefa propria", (await request(collaborator, "POST", `/api/service-orders/os-2401/checklist/${collaboratorItemId}/start`)).status, 200);
  expectStatus(results, "COLABORADOR nao seleciona outro responsavel", (await request(collaborator, "POST", `/api/service-orders/os-2401/checklist/${collaboratorItemId}/complete`, { completedByEmployeeId: "emp-ines" })).status, 403);
  expectStatus(results, "COLABORADOR conclui tarefa propria habilitada", (await request(collaborator, "POST", `/api/service-orders/os-2401/checklist/${collaboratorItemId}/complete`, { completedByEmployeeId: "emp-joao", completionNotes: "Minha tarefa finalizada." })).status, 200);

  expectStatus(results, "Item de outra OS retorna nao encontrado", (await request(owner, "POST", "/api/service-orders/os-2401/checklist/chk-2402-1/start")).status, 404);
  expectStatus(results, "ALMOXARIFADO nao altera checklist", (await request(warehouse, "POST", `/api/service-orders/os-2401/checklist/${blockItemId}/block`, { reason: "Sem permissao" })).status, 403);
  expectStatus(results, "FINANCEIRO/COMERCIAL equivalem a sem permissao via almox", (await request(warehouse, "POST", "/api/service-orders/os-2401/checklist", { title: "Sem permissao" })).status, 403);

  for (const result of results) {
    console.log(`${result.ok ? "PASS" : "FAIL"} - ${result.name} (${result.detail})`);
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
