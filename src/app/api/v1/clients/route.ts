import { collection } from "@/lib/api/http";
import { clients } from "@/lib/api/resources";

export const { GET, POST } = collection(clients);
