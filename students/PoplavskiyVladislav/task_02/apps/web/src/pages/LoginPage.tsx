import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth, type AuthUser } from "../lib/auth";

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });

      auth.setSession(data.accessToken, data.user);
      navigate("/groups", { replace: true });
    } catch (e: unknown) {
      if (e instanceof ApiClientError) {
        setError(e.message);
      } else {
        setError("Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card stack">
        <h1>Login</h1>
        <form onSubmit={onSubmit} className="stack">
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="notice">{error}</p>}
        <button className="primary" disabled={isLoading} type="submit">
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
        </form>
      </div>
    </div>
  );
};
