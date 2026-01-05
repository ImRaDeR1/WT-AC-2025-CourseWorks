import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Group } from "../lib/types";

export const GroupsPage: React.FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [title, setTitle] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const token = auth.token;

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    apiFetch<Group[]>("/groups", { token })
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) setError(e.message);
        else setError("Failed to load groups");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  const canCreate = Boolean(token);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setIsLoading(true);
    try {
      const created = await apiFetch<Group>("/groups", {
        method: "POST",
        token,
        body: { title, isPublic: true },
      });
      setTitle("");
      setGroups((prev) => [created, ...prev]);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to create group");
    } finally {
      setIsLoading(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const gid = joinGroupId.trim();
    if (!gid) return;

    setError(null);
    setIsLoading(true);
    try {
      await apiFetch(`/groups/${gid}/join`, {
        method: "POST",
        token,
      });
      setJoinGroupId("");
      const data = await apiFetch<Group[]>("/groups", { token });
      setGroups(data);
      navigate(`/groups/${gid}`);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to join group");
    } finally {
      setIsLoading(false);
    }
  };

  const header = useMemo(() => {
    if (auth.user) return `Signed in as ${auth.user.username}`;
    return "Signed in";
  }, [auth.user]);

  return (
    <div className="container" style={{ maxWidth: 900 }}>
      <div className="row">
        <h1>My Groups</h1>
        <div className="inline">
          <span className="muted">{header}</span>
          <button
            onClick={() => {
              auth.clear();
              navigate("/login", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="card stack" style={{ marginTop: 12 }}>
      <form onSubmit={onCreate} className="inline">
        <input
          className="grow"
          placeholder="New group title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="primary" disabled={!canCreate || isLoading || title.trim().length < 3} type="submit">
          Create
        </button>
      </form>

      <form onSubmit={onJoin} className="inline">
        <input
          className="grow"
          placeholder="Join group by ID"
          value={joinGroupId}
          onChange={(e) => setJoinGroupId(e.target.value)}
        />
        <button className="primary" disabled={!token || isLoading || joinGroupId.trim().length < 1} type="submit">
          Join
        </button>
      </form>

      {error && <p className="notice">{error}</p>}
      {isLoading && <p className="muted">Loading...</p>}

      <ul className="list">
        {groups.map((g) => (
          <li key={g.id}>
            <div className="row">
              <div className="stack" style={{ gap: 6 }}>
                <Link to={`/groups/${g.id}`}>{g.title}</Link>
                <span className="muted">id: {g.id}</span>
              </div>
              {g.myRole ? <span className="pill">{g.myRole}</span> : null}
            </div>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
};
