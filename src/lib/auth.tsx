import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { checkCurrentUser, logoutUser, type PublicUser, type CurrentUserResult } from "./backend";

type AuthState = {
  user: PublicUser | null;
  initializing: boolean;
};

type AuthContextValue = AuthState & {
  setUser: (user: PublicUser) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function nextState(result: CurrentUserResult, current: AuthState): AuthState {
  if (result.status === "authenticated" || result.status === "restricted") {
    return { user: result.user, initializing: false };
  }
  if (result.status === "unauthenticated") {
    return { user: null, initializing: false };
  }
  return current.user ? { user: current.user, initializing: false } : current;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, initializing: true });

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const result = await checkCurrentUser();
      if (active) setState((current) => nextState(result, current));
    };
    void initialize();

    const retry = () => void initialize();
    window.addEventListener("online", retry);
    return () => {
      active = false;
      window.removeEventListener("online", retry);
    };
  }, []);

  const setUser = (user: PublicUser) => {
    setState({ user, initializing: false });
  };

  const signOut = async () => {
    try {
      await logoutUser();
    } finally {
      setState({ user: null, initializing: false });
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, setUser, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
