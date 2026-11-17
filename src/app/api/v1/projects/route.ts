import { collection } from "@/lib/api/http";
import { projects } from "@/lib/api/resources";

export const { GET, POST } = collection(projects);
