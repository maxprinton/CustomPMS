import { item } from "@/lib/api/http";
import { projects } from "@/lib/api/resources";

export const { GET, PATCH } = item(projects);
