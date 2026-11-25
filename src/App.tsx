import { Items } from "./Items";
import { useSession } from "./auth-client";
import { SignIn } from "./SignIn";

export function App() {
  const session = useSession();

  if (session.isPending) return <p className="muted">Loading…</p>;
  // Gate on the session rather than reacting to a 401 from the list: the list should
  // never be asked for without one.
  if (!session.data) return <SignIn />;

  return <Items email={session.data.user.email} />;
}
