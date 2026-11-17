import { collection } from "@/lib/api/http";
import { backlog } from "@/lib/api/resources";

export const { GET, POST } = collection(backlog);
