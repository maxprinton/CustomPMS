import { item } from "@/lib/api/http";
import { backlog } from "@/lib/api/resources";

export const { GET, PATCH } = item(backlog);
