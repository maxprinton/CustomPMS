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
  roles: { owner: "Propietario", member: "Miembro", viewer: "Lector" },
};

const dicts: Record<Lang, Dict> = { en, es };

export async function getDict(): Promise<{ lang: Lang; t: Dict }> {
  const store = await cookies();
  const lang: Lang = store.get(LANG_COOKIE)?.value === "es" ? "es" : "en";
  return { lang, t: dicts[lang] };
}
