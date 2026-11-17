import { item } from "@/lib/api/http";
import { clients } from "@/lib/api/resources";

export const { GET, PATCH } = item(clients);
