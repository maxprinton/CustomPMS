import { item } from "@/lib/api/http";
import { tasks } from "@/lib/api/resources";

export const { GET, PATCH } = item(tasks);
