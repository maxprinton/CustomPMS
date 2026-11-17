import { cookies } from "next/headers";

export type Lang = "en" | "es";
export const LANG_COOKIE = "cpms_lang";

const en = {
  appName: "Custom PMS",
  nav: { dashboard: "Dashboard", clients: "Clients", projects: "Projects", backlog: "Backlog", templates: "Templates", settings: "Settings", signOut: "Sign out" },
  login: {
    signIn: "Sign in to Custom PMS", create: "Create your account", email: "Email", password: "Password (min. 8 characters)",
    submitIn: "Sign in", submitUp: "Create account", wait: "Please wait...", forgot: "Forgot password?",
    toUp: "No account yet? Create one", toIn: "Already have an account? Sign in",
    needEmail: "Type your email first, then click Forgot password.", resetSent: "Check your email for a link to set a new password.",
    created: "Account created. Confirm your email once, then sign in with your password.",
    newPassword: "Set a new password", save: "Save password",
  },
  common: { add: "Add", save: "Save", name: "Name", notes: "Notes", none: "Nothing here yet.", noClient: "No client", all: "All", readOnly: "You have read-only access." },
  dashboard: { title: "Dashboard", activeProjects: "Active projects", clients: "Clients", openTasks: "Open tasks", openRisks: "Open risks", now: "In progress now", upcoming: "Upcoming milestones" },
  clients: { title: "Clients", new: "New client", kind: "Type", external: "External", internal: "Internal", contacts: "Contacts", newContact: "New contact", email: "Email", phone: "Phone", role: "Role", projects: "Projects" },
  projects: {
    title: "Projects", new: "New project", client: "Client", method: "Method", phase: "Phase", status: "Status",
    objective: "Objective", sponsor: "Sponsor", start: "Start", end: "End", budget: "Budget",
    tasks: "Tasks", milestones: "Milestones", risks: "Risks", backlog: "Backlog", due: "Due", done: "Done",
    probability: "Probability (1-5)", impact: "Impact (1-5)", response: "Response", score: "Score", profile: "Profile",
  },
  method: { predictive: "Predictive", agile: "Agile", hybrid: "Hybrid" },
  phase: { initiation: "Initiation", planning: "Planning", execution: "Execution", monitoring: "Monitoring", closing: "Closing" },
  status: { active: "Active", on_hold: "On hold", done: "Done", cancelled: "Cancelled" },
  task: { todo: "To do", doing: "Doing", done: "Done", blocked: "Blocked" },
  backlog: { title: "Backlog", new: "New item", type: "Type", project: "Project", bug: "Bug", feature: "Feature", improvement: "Improvement", big_idea: "Big idea" },
  board: { inbox: "Inbox", later: "Later", next: "Next", now: "Now", verifying: "Verifying", done: "Done", parked: "Parked" },
  templates: { title: "Templates", empty: "The template library has not been imported yet.", builtIn: "Built-in", mine: "Mine" },
  settings: { title: "Settings", language: "Language", workspace: "Workspace", members: "Members", role: "Role", you: "you" },
  docs: {
    title: "Documents", details: "Document details", detailsHint: "Used to fill templates, together with the profile, milestones, risks and the client's contacts above.",
    organization: "Organization", manager: "Project manager", preparedBy: "Prepared by",
    scope_in: "In scope", scope_out: "Out of scope", success_criteria: "Success criteria", assumptions: "Assumptions", constraints: "Constraints",
    onePerLine: "One per line", create: "Create filled copy", choose: "Choose a template", download: "Download", blanks: "blanks filled", notFilled: "copied as is",
  },
  bl: {
    board: "Board", list: "List", search: "Search", allTypes: "All types", ideaPlaceholder: "One sentence: what is the idea?", saved: "Saved.",
    move: "Move", cancel: "Cancel", moving: "Moving...", reopen: "reopen", needs: "needs", size: "Size", sizePick: "Pick...", specLink: "Spec link", reason: "Why are we not doing it?",
    sizeS: "S - under a day", sizeM: "M - a few days", sizeL: "L - a week or more", pickSizeFirst: "Pick a size first.", addSpecFirst: "Add the spec link first.", giveReasonFirst: "Give a reason first.",
    area: "Area", notes: "Notes", value: "Value (1-3)", effort: "Effort (1-3)", back: "Back to the backlog", history: "History", noHistory: "No history yet.", by: "by", noProject: "No project",
    delete: "Delete", deleted: "deleted.", confirmDelete: "Delete this item?", reopened: "is back in Now (reopened).", askAgain: "Okay, I will ask again in 3 days.", isDone: "is Done.",
    moveUp: "Move up", moveDown: "Move down", empty: "Empty", days: "days", stale: "in this column for",
    waiting: "Waiting on you", nothingWaiting: "Nothing is waiting on you.", done: "Done", skip: "Skip", recentSteps: "Recent steps", asked: "asked", flagged: "flagged", verified: "verified",
    stepMigration: "Migration", stepPublish: "Upload", stepKeys: "Keys", stepOther: "Step",
    missions: "Test missions", open: "open", howTo: "How to test", didIt: "I did it", worked: "Worked", problem: "Had a problem", sendProblem: "Send problem", later: "Later",
    answered: "Answered", usedWaiting: "used, waiting for your answer", autoMarked: "Also marked automatically when you do it.", missionComplete: "Mission complete", sawYouUse: "I saw you use it. Did it work?",
    problemPrompt: "One line: what went wrong?", allMissions: "All missions", bugCreated: "created.", noMissions: "No test missions yet.",
    didItWorkReal: "Did it work in real use?", stillTesting: "Still testing", failed: "Did not work",
    triageNow: "Now", topNext: "Top of Next", pull: "Pull to Now", nextEmpty: "Next is empty.", nowEmpty: "Nothing in Now.", nowFull: "Now is full. Finish, verify or move one first.", openBacklog: "Open the backlog", inbox: "Inbox", verifying: "Verifying", inAll: "in all",
    caps: "Limits", nowCap: "Now limit", nextCap: "Next limit", verifyingCap: "Verifying limit", verifyDays: "Days in real use before asking", triagePrompt: "Show the 30-second planning prompt", capsHint: "Bugs and reopened items never count toward the Now limit.",
    claudeAtWork: "Claude at work", workingNow: "Working now", notWorking: "Claude is not working on anything right now.", recentActivity: "Recent activity",
    tests: "Tests", noTests: "No tests for this item.", steps: "Steps", noSteps: "No steps for this item.",
  },
  roles: { owner: "Owner", member: "Member", viewer: "Viewer" },
};

export type Dict = typeof en;

const es: Dict = {
  appName: "Custom PMS",
  nav: { dashboard: "Panel", clients: "Clientes", projects: "Proyectos", backlog: "Backlog", templates: "Plantillas", settings: "Ajustes", signOut: "Cerrar sesión" },
  login: {
    signIn: "Inicia sesión en Custom PMS", create: "Crea tu cuenta", email: "Correo", password: "Contraseña (mín. 8 caracteres)",
    submitIn: "Iniciar sesión", submitUp: "Crear cuenta", wait: "Espera...", forgot: "¿Olvidaste tu contraseña?",
    toUp: "¿Aún no tienes cuenta? Crea una", toIn: "¿Ya tienes cuenta? Inicia sesión",
    needEmail: "Escribe tu correo primero y luego pulsa ¿Olvidaste tu contraseña?", resetSent: "Revisa tu correo: te enviamos un enlace para crear una contraseña nueva.",
    created: "Cuenta creada. Confirma tu correo una vez y luego inicia sesión con tu contraseña.",
    newPassword: "Crea una contraseña nueva", save: "Guardar contraseña",
  },
  common: { add: "Agregar", save: "Guardar", name: "Nombre", notes: "Notas", none: "Todavía no hay nada aquí.", noClient: "Sin cliente", all: "Todos", readOnly: "Tienes acceso de solo lectura." },
  dashboard: { title: "Panel", activeProjects: "Proyectos activos", clients: "Clientes", openTasks: "Tareas abiertas", openRisks: "Riesgos abiertos", now: "En curso ahora", upcoming: "Próximos hitos" },
  clients: { title: "Clientes", new: "Nuevo cliente", kind: "Tipo", external: "Externo", internal: "Interno", contacts: "Contactos", newContact: "Nuevo contacto", email: "Correo", phone: "Teléfono", role: "Cargo", projects: "Proyectos" },
  projects: {
    title: "Proyectos", new: "Nuevo proyecto", client: "Cliente", method: "Método", phase: "Fase", status: "Estado",
    objective: "Objetivo", sponsor: "Patrocinador", start: "Inicio", end: "Fin", budget: "Presupuesto",
    tasks: "Tareas", milestones: "Hitos", risks: "Riesgos", backlog: "Backlog", due: "Vence", done: "Hecho",
    probability: "Probabilidad (1-5)", impact: "Impacto (1-5)", response: "Respuesta", score: "Puntaje", profile: "Perfil",
  },
  method: { predictive: "Predictivo", agile: "Ágil", hybrid: "Híbrido" },
  phase: { initiation: "Inicio", planning: "Planificación", execution: "Ejecución", monitoring: "Monitoreo", closing: "Cierre" },
  status: { active: "Activo", on_hold: "En pausa", done: "Terminado", cancelled: "Cancelado" },
  task: { todo: "Por hacer", doing: "En curso", done: "Hecha", blocked: "Bloqueada" },
  backlog: { title: "Backlog", new: "Nuevo ítem", type: "Tipo", project: "Proyecto", bug: "Error", feature: "Función", improvement: "Mejora", big_idea: "Gran idea" },
  board: { inbox: "Entrada", later: "Después", next: "Siguiente", now: "Ahora", verifying: "Verificando", done: "Hecho", parked: "Aparcado" },
  templates: { title: "Plantillas", empty: "La biblioteca de plantillas todavía no se ha importado.", builtIn: "Incluidas", mine: "Mías" },
  settings: { title: "Ajustes", language: "Idioma", workspace: "Espacio de trabajo", members: "Miembros", role: "Rol", you: "tú" },
  docs: {
    title: "Documentos", details: "Datos para documentos", detailsHint: "Se usan para rellenar plantillas, junto con el perfil, los hitos, los riesgos y los contactos del cliente de arriba.",
    organization: "Organización", manager: "Director/a del proyecto", preparedBy: "Elaborado por",
    scope_in: "Dentro del alcance", scope_out: "Fuera del alcance", success_criteria: "Criterios de éxito", assumptions: "Supuestos", constraints: "Restricciones",
    onePerLine: "Uno por línea", create: "Crear copia rellenada", choose: "Elige una plantilla", download: "Descargar", blanks: "espacios rellenados", notFilled: "copiada tal cual",
  },
  bl: {
    board: "Tablero", list: "Lista", search: "Buscar", allTypes: "Todos los tipos", ideaPlaceholder: "Una frase: ¿cuál es la idea?", saved: "Guardado.",
    move: "Mover", cancel: "Cancelar", moving: "Moviendo...", reopen: "reabrir", needs: "necesita", size: "Tamaño", sizePick: "Elige...", specLink: "Enlace a la especificación", reason: "¿Por qué no lo hacemos?",
    sizeS: "S - menos de un día", sizeM: "M - unos días", sizeL: "L - una semana o más", pickSizeFirst: "Elige un tamaño primero.", addSpecFirst: "Añade primero el enlace a la especificación.", giveReasonFirst: "Escribe primero un motivo.",
    area: "Área", notes: "Notas", value: "Valor (1-3)", effort: "Esfuerzo (1-3)", back: "Volver al backlog", history: "Historial", noHistory: "Todavía no hay historial.", by: "por", noProject: "Sin proyecto",
    delete: "Eliminar", deleted: "eliminado.", confirmDelete: "¿Eliminar este ítem?", reopened: "vuelve a Ahora (reabierto).", askAgain: "De acuerdo, te lo preguntaré de nuevo en 3 días.", isDone: "está Hecho.",
    moveUp: "Subir", moveDown: "Bajar", empty: "Vacío", days: "días", stale: "en esta columna desde hace",
    waiting: "Esperando por ti", nothingWaiting: "Nada está esperando por ti.", done: "Hecho", skip: "Omitir", recentSteps: "Pasos recientes", asked: "pedido", flagged: "marcado", verified: "verificado",
    stepMigration: "Migración", stepPublish: "Publicar", stepKeys: "Claves", stepOther: "Paso",
    missions: "Misiones de prueba", open: "abiertas", howTo: "Cómo probar", didIt: "Lo hice", worked: "Funcionó", problem: "Tuve un problema", sendProblem: "Enviar problema", later: "Después",
    answered: "Respondidas", usedWaiting: "usado, esperando tu respuesta", autoMarked: "También se marca sola cuando lo haces.", missionComplete: "Misión completada", sawYouUse: "Vi que lo usaste. ¿Funcionó?",
    problemPrompt: "Una línea: ¿qué salió mal?", allMissions: "Todas las misiones", bugCreated: "creado.", noMissions: "Todavía no hay misiones de prueba.",
    didItWorkReal: "¿Funcionó en el uso real?", stillTesting: "Sigo probando", failed: "No funcionó",
    triageNow: "Ahora", topNext: "Lo primero de Siguiente", pull: "Pasar a Ahora", nextEmpty: "Siguiente está vacío.", nowEmpty: "Nada en Ahora.", nowFull: "Ahora está lleno. Termina, verifica o mueve uno primero.", openBacklog: "Abrir el backlog", inbox: "Entrada", verifying: "Verificando", inAll: "en total",
    caps: "Límites", nowCap: "Límite de Ahora", nextCap: "Límite de Siguiente", verifyingCap: "Límite de Verificando", verifyDays: "Días de uso real antes de preguntar", triagePrompt: "Mostrar el aviso de planificación de 30 segundos", capsHint: "Los errores y los ítems reabiertos nunca cuentan para el límite de Ahora.",
    claudeAtWork: "Claude trabajando", workingNow: "Trabajando ahora", notWorking: "Claude no está trabajando en nada ahora mismo.", recentActivity: "Actividad reciente",
    tests: "Pruebas", noTests: "No hay pruebas para este ítem.", steps: "Pasos", noSteps: "No hay pasos para este ítem.",
  },
  roles: { owner: "Propietario", member: "Miembro", viewer: "Lector" },
};

const dicts: Record<Lang, Dict> = { en, es };

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const store = await cookies();
  const lang: Lang = store.get(LANG_COOKIE)?.value === "es" ? "es" : "en";
  return { lang, t: dicts[lang] };
}
