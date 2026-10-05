import { checkPasscode } from "@/lib/config";
import { resetDemo } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = checkPasscode(req);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: 401 });
  await resetDemo();
  return Response.json({ ok: true });
}
