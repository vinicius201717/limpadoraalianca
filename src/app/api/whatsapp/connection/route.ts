const stopped = () => Response.json({ message: "Integração WhatsApp encerrada. Use o Assistente de Campo em /campo." }, { status: 410 });
export const GET = stopped;
export const POST = stopped;
export const DELETE = stopped;
