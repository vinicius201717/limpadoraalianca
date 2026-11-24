// Local synthetic scenario only. Never import into operational production.
import bcrypt from "bcryptjs";
export async function audioTestData() {
  const now=new Date().toISOString();
  const day=offset=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(Date.now()+offset*86400000));
  const today=day(0), end=day(2), hash=await bcrypt.hash("EnsaioAlianca!2026",10);
  const roles=[
    ["owner","Diretor Teste","OWNER"],["gerente","Marcos Teste","GERENTE"],["supervisor","Ana Teste","SUPERVISOR_OBRA"],
    ["supervisor2","Bruno Teste","SUPERVISOR_OBRA"],["almoxarifado","Paulo Teste","ALMOXARIFADO"],["financeiro","Beatriz Teste","FINANCEIRO"],
    ["carlos","Carlos Teste","COLABORADOR"],["juliana","Juliana Teste","COLABORADOR"],["pedro","Pedro Teste","COLABORADOR"],["lucas","Lucas Teste","COLABORADOR"],["mariana","Mariana Teste","COLABORADOR"]
  ];
  const id=x=>"teste-"+x;
  const users=roles.map(([slug,name,role])=>({id:id(slug),name,email:slug+"@alianca.test",role,isActive:true,canViewFinancials:["OWNER","GERENTE","FINANCEIRO"].includes(role),sessionVersion:0,mustChangePassword:false,passwordHash:hash,linkedEmployeeId:["OWNER"].includes(role)?undefined:id("emp-"+slug),createdAt:now,updatedAt:now}));
  const employees=roles.filter(r=>r[2]!=="OWNER").map(([slug,name,role])=>({id:id("emp-"+slug),userId:id(slug),name,email:slug+"@alianca.test",phone:"",document:"",roleName:role,specialty:role==="COLABORADOR"?"Limpeza pós-obra":"Gestão",status:"ACTIVE",dailyCost:role==="COLABORADOR"?120:180,hiredAt:today,notes:"DADO FICTÍCIO",averageRating:0,serviceOrdersCount:0,lastJob:"",strengths:[],improvements:[]}));
  const customers=["Jardim Aurora","Edifício Horizonte","Casa Ipê"].map((name,i)=>({id:id("cliente-"+i),name:"[TESTE] "+name,email:"",phone:"",document:"",type:"PERSON",source:"Ensaio",notes:"Cliente fictício",totalValue:[4800,3200,2500][i],lastService:"Limpeza pós-obra"}));
  const specs=[
    ["aurora","Jardim Aurora","supervisor",["carlos","juliana","pedro"],4800,380,"IN_PROGRESS"],
    ["horizonte","Edifício Horizonte","supervisor2",["lucas","mariana"],3200,150,"IN_PROGRESS"],
    ["ipe","Casa Ipê","supervisor2",["lucas"],2500,0,"SCHEDULED"]
  ];
  const serviceOrders=specs.map(([slug,name,sup,team,revenue,expenses,status],i)=>({id:id("os-"+slug),title:"[TESTE] "+name,customerId:customers[i].id,customerName:customers[i].name,quoteId:"",serviceType:"POST_CONSTRUCTION_CLEANING",description:"Limpeza pós-obra fictícia",address:"Endereço fictício de homologação",scheduledStart:slug==="ipe"?day(1):today,scheduledEnd:end,status,supervisorUserId:id(sup),supervisorEmployeeId:id("emp-"+sup),employeeIds:[sup,...team].map(e=>id("emp-"+e)),internalNotes:"Ambiente local de testes",clientNotes:"",tasks:[],revenue,expenses}));
  const serviceOrderEmployees=specs.flatMap(([slug,,sup,team])=>[sup,...team].map(e=>({id:id("team-"+slug+"-"+e),serviceOrderId:id("os-"+slug),employeeId:id("emp-"+e),roleInService:e===sup?"SUPERVISOR":"AUXILIAR",assignedByUserId:id("gerente"),assignedAt:now,createdAt:now,updatedAt:now})));
  const tasks=[
    ["aurora","Piso da sala","carlos","DONE"],["aurora","Limpeza dos vidros","juliana","IN_PROGRESS"],["aurora","Limpeza dos banheiros","pedro","PENDING"],["aurora","Retirar resíduos da varanda","carlos","BLOCKED"],["aurora","Limpeza da cozinha","juliana","PENDING"],
    ["horizonte","Limpeza do hall","lucas","DONE"],["horizonte","Limpeza dos elevadores","mariana","PENDING"],["horizonte","Limpeza das escadas","lucas","IN_PROGRESS"],["ipe","Limpeza da garagem","lucas","PENDING"]
  ];
  const serviceOrderChecklistItems=tasks.map(([slug,title,emp,status],i)=>{const order=serviceOrders.find(o=>o.id===id("os-"+slug));return {id:id("check-"+i),serviceOrderId:order.id,title,description:"",sortOrder:i+1,status,isRequired:true,requiresPhoto:false,minimumPhotos:0,assignedEmployeeId:id("emp-"+emp),assignedEmployeeIds:[id("emp-"+emp)],allowCollaboratorAction:true,createdByUserId:order.supervisorUserId,createdAt:now,updatedAt:now,...(status==="DONE"?{completedByUserId:id(emp),completedByEmployeeId:id("emp-"+emp),completedByEmployeeIds:[id("emp-"+emp)],completedAt:now,validatedByUserId:order.supervisorUserId,validatedAt:now}:status==="IN_PROGRESS"?{startedAt:now,startedByUserId:id(emp)}:status==="BLOCKED"?{blockedReason:"Aguardando retirada de entulho pela construtora"}:{})};});
  for(const o of serviceOrders)o.tasks=serviceOrderChecklistItems.filter(i=>i.serviceOrderId===o.id).map(i=>({id:i.id,title:i.title,done:i.status==="DONE"}));
  const materials=[["detergente","Detergente neutro","L",30,10,12],["removedor","Removedor pós-obra","L",8,10,38],["fibra","Fibra branca","un",40,15,8],["pano","Pano de microfibra","un",24,10,9],["saco","Saco de lixo","un",50,20,2],["alcool","Álcool 70%","L",12,5,10]].map(([slug,name,unit,currentStock,minStock,unitCost])=>({id:id("mat-"+slug),name,unit,currentStock,minStock,unitCost,status:currentStock<minStock?"LOW_STOCK":"AVAILABLE"}));
  const equipment=[["aspirador","Aspirador industrial","ASP-T01","AVAILABLE"],["politriz","Politriz","POL-T01","AVAILABLE"],["lavadora","Lavadora de piso","LAV-T01","IN_MAINTENANCE"]].map(([slug,name,code,status])=>({id:id("eq-"+slug),name,code,status,notes:"Equipamento fictício"}));
  const serviceOrderMaterials=[["aurora","detergente",5,2],["aurora","fibra",8,3],["horizonte","pano",6,2]].map(([slug,mat,qty,consumed],i)=>({id:id("material-os-"+i),serviceOrderId:id("os-"+slug),materialId:id("mat-"+mat),plannedQuantity:qty,separatedQuantity:qty,deliveredQuantity:qty,returnedQuantity:0,consumedQuantity:consumed,damagedQuantity:0,lostQuantity:0,status:"DELIVERED_TO_TEAM",notes:"Entrega fictícia",preparedByUserId:id("almoxarifado"),deliveredByUserId:id("almoxarifado"),createdAt:now,updatedAt:now}));
  const serviceExpenses=[["aurora","GASOLINA",80,"Combustível"],["aurora","MATERIAL_OU_PRODUTO",180,"Compra de produtos"],["aurora","ALMOCO",120,"Almoço da equipe"],["horizonte","GASOLINA",150,"Transporte"]].map(([slug,category,amount,notes],i)=>({id:id("expense-"+i),serviceOrderId:id("os-"+slug),employeeId:"",employeeName:"Equipe fictícia",category,amount,notes,createdByUserId:id("financeiro"),createdAt:now,updatedAt:now}));
  const servicePayments=serviceOrders.flatMap(o=>[1,2].map(part=>({id:o.id+"-parcela-"+part,serviceOrderId:o.id,description:part===1?"Entrada":"Saldo",amount:o.revenue/2,dueAt:part===1?today:end,createdAt:now,createdByUserId:id("financeiro"),receipts:part===1&&o.status==="IN_PROGRESS"?[{id:o.id+"-recebimento",amount:o.revenue/2,paidAt:today,method:"PIX",reference:"PIX FICTÍCIO "+o.id,createdAt:now,createdByUserId:id("financeiro")}]:[]})));
  return {users,employees,customers,serviceOrders,serviceOrderEmployees,serviceOrderChecklistItems,materials,equipment,serviceOrderMaterials,serviceExpenses,servicePayments};
}
