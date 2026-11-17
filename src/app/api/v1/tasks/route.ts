import { collection } from "@/lib/api/http";
import { tasks } from "@/lib/api/resources";

export const { GET, POST } = collection(tasks);
