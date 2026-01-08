import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { apiFetch, ApiClientError } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Group, GroupMember, Material, Meeting, Task, Topic } from "../lib/types";

type Tab = "topics" | "meetings" | "materials" | "tasks" | "chat";

export const GroupPage: React.FC = () => {
  const { groupId } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();

  const token = auth.token;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [tab, setTab] = useState<Tab>("topics");

  const [topics, setTopics] = useState<Topic[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isOwner = group?.myRole === "owner";

  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [groupDraft, setGroupDraft] = useState<{ title: string; description: string; isPublic: boolean }>(
    { title: "", description: "", isPublic: true }
  );

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState<{ title: string; description: string; order: string }>(
    { title: "", description: "", order: "" }
  );

  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingDraft, setMeetingDraft] = useState<{
    startsAt: string;
    durationMinutes: number;
    place: string;
    link: string;
    notes: string;
  }>({ startsAt: new Date().toISOString(), durationMinutes: 60, place: "", link: "", notes: "" });

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialDraft, setMaterialDraft] = useState<{ title: string; url: string; content: string }>(
    { title: "", url: "", content: "" }
  );

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ title: string; status: Task["status"]; dueAt: string; assigneeId: string }>(
    { title: "", status: "todo", dueAt: "", assigneeId: "" }
  );

  const loadPrivateData = async () => {
    if (!token || !groupId) return;
    const [m, t, me, ma, ta] = await Promise.all([
      apiFetch<GroupMember[]>(`/groups/${groupId}/members`, { token }),
      apiFetch<Topic[]>(`/groups/${groupId}/topics`, { token }),
      apiFetch<Meeting[]>(`/groups/${groupId}/meetings`, { token }),
      apiFetch<Material[]>(`/groups/${groupId}/materials`, { token }),
      apiFetch<Task[]>(`/groups/${groupId}/tasks`, { token }),
    ]);
    setMembers(m);
    setTopics(t);
    setMeetings(me);
    setMaterials(ma);
    setTasks(ta);
  };

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    if (!groupId) return;

    let cancelled = false;

    (async () => {
      setError(null);
      setIsLoading(true);
      try {
        const g = await apiFetch<Group>(`/groups/${groupId}`, { token });
        if (cancelled) return;
        setGroup(g);

        if (!g.myRole) {
          setMembers([]);
          setTopics([]);
          setMeetings([]);
          setMaterials([]);
          setTasks([]);
          return;
        }

        await loadPrivateData();
      } catch (e: unknown) {
        if (cancelled) return;
        if (e instanceof ApiClientError) setError(e.message);
        else setError("Failed to load group");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, navigate, token]);

  const title = useMemo(() => group?.title ?? "Group", [group]);

  const joinGroup = async () => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch(`/groups/${groupId}/join`, { method: "POST", token });
      const g = await apiFetch<Group>(`/groups/${groupId}`, { token });
      setGroup(g);
      await loadPrivateData();
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to join group");
    } finally {
      setIsLoading(false);
    }
  };

  const leaveGroup = async () => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch(`/groups/${groupId}/leave`, { method: "POST", token });
      navigate("/groups");
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to leave group");
    } finally {
      setIsLoading(false);
    }
  };

  const createTopic = async (t: { title: string }) => {
    if (!token || !groupId) return;
    const created = await apiFetch<Topic>(`/groups/${groupId}/topics`, {
      method: "POST",
      token,
      body: { title: t.title },
    });
    setTopics((prev) => [created, ...prev]);
  };

  const createMeeting = async (m: { startsAt: string; durationMinutes: number }) => {
    if (!token || !groupId) return;
    const created = await apiFetch<Meeting>(`/groups/${groupId}/meetings`, {
      method: "POST",
      token,
      body: m,
    });
    setMeetings((prev) => [created, ...prev]);
  };

  const createMaterial = async (m: { title: string; url: string }) => {
    if (!token || !groupId) return;
    const created = await apiFetch<Material>(`/groups/${groupId}/materials`, {
      method: "POST",
      token,
      body: { title: m.title, type: "link", url: m.url },
    });
    setMaterials((prev) => [created, ...prev]);
  };

  const createTask = async (t: { title: string }) => {
    if (!token || !groupId) return;
    const created = await apiFetch<Task>(`/groups/${groupId}/tasks`, {
      method: "POST",
      token,
      body: { title: t.title },
    });
    setTasks((prev) => [created, ...prev]);
  };

  const patchTaskStatus = async (taskId: string, status: Task["status"]) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Task>(`/groups/${groupId}/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: { status },
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update task status");
    } finally {
      setIsLoading(false);
    }
  };

  const patchTopic = async (topicId: string, patch: { title: string; description: string | null; order: number | null }) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Topic>(`/groups/${groupId}/topics/${topicId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTopicId(null);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update topic");
    } finally {
      setIsLoading(false);
    }
  };

  const patchTopicDone = async (topicId: string, isDone: boolean) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Topic>(`/groups/${groupId}/topics/${topicId}`, {
        method: "PATCH",
        token,
        body: { isDone },
      });
      setTopics((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update topic");
    } finally {
      setIsLoading(false);
    }
  };

  const patchMeeting = async (
    meetingId: string,
    patch: { startsAt: string; durationMinutes: number; place: string | null; link: string | null; notes: string | null }
  ) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Meeting>(`/groups/${groupId}/meetings/${meetingId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      setMeetings((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMeetingId(null);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCalendar = async () => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const baseUrl = ((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001").replace(
        /\/$/,
        ""
      );

      const res = await fetch(`${baseUrl}/groups/${groupId}/calendar.ics`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text();
        try {
          const json = JSON.parse(text) as { status: "error"; error: { message: string } };
          throw new ApiClientError("http_error", json.error.message);
        } catch {
          throw new ApiClientError("http_error", `Failed to download calendar (${res.status})`);
        }
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (group?.title ?? "study-group").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
      a.download = `${safeTitle}-${groupId}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to download calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const patchMaterial = async (materialId: string, patch: { title: string; url: string | null; content: string | null }) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Material>(`/groups/${groupId}/materials/${materialId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingMaterialId(null);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update material");
    } finally {
      setIsLoading(false);
    }
  };

  const patchTaskOwner = async (
    taskId: string,
    patch: { title: string; status: Task["status"]; dueAt: string | null; assigneeId: string | null }
  ) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Task>(`/groups/${groupId}/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTaskId(null);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update task");
    } finally {
      setIsLoading(false);
    }
  };

  const patchGroup = async (patch: { title: string; description: string | null; isPublic: boolean }) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      const updated = await apiFetch<Group>(`/groups/${groupId}`, {
        method: "PATCH",
        token,
        body: patch,
      });
      setGroup((prev) => ({ ...updated, myRole: prev?.myRole ?? null }));
      setIsEditingGroup(false);
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to update group");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteGroup = async () => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch<void>(`/groups/${groupId}`, { method: "DELETE", token });
      navigate("/groups", { replace: true });
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to delete group");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTopic = async (topicId: string) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch<void>(`/groups/${groupId}/topics/${topicId}`, { method: "DELETE", token });
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to delete topic");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch<void>(`/groups/${groupId}/meetings/${meetingId}`, { method: "DELETE", token });
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to delete meeting");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMaterial = async (materialId: string) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch<void>(`/groups/${groupId}/materials/${materialId}`, { method: "DELETE", token });
      setMaterials((prev) => prev.filter((m) => m.id !== materialId));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to delete material");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!token || !groupId) return;
    setError(null);
    setIsLoading(true);
    try {
      await apiFetch<void>(`/groups/${groupId}/tasks/${taskId}`, { method: "DELETE", token });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to delete task");
    } finally {
      setIsLoading(false);
    }
  };

  if (!groupId) return <p>Missing groupId</p>;

  return (
    <div className="container">
      <div className="card stack">
        <div className="row">
          <Link to="/groups">← Back</Link>
          {!group?.myRole ? (
            <button className="primary" disabled={isLoading} onClick={joinGroup}>
              Join
            </button>
          ) : group.myRole === "member" ? (
            <button disabled={isLoading} onClick={leaveGroup}>
              Leave
            </button>
          ) : null}
        </div>

        {isEditingGroup && isOwner ? (
          <div className="stack">
            <input
              value={groupDraft.title}
              onChange={(e) => setGroupDraft((p) => ({ ...p, title: e.target.value }))}
              placeholder="Group title"
            />
            <textarea
              value={groupDraft.description}
              onChange={(e) => setGroupDraft((p) => ({ ...p, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={3}
            />
            <label className="inline">
              <input
                type="checkbox"
                checked={groupDraft.isPublic}
                onChange={(e) => setGroupDraft((p) => ({ ...p, isPublic: e.target.checked }))}
              />
              Public
            </label>
            <div className="inline">
              <button
                disabled={isLoading || groupDraft.title.trim().length < 3}
                onClick={() =>
                  patchGroup({
                    title: groupDraft.title.trim(),
                    description: groupDraft.description.trim() ? groupDraft.description.trim() : null,
                    isPublic: groupDraft.isPublic,
                  })
                }
              >
                Save
              </button>
              <button
                disabled={isLoading}
                onClick={() => {
                  setIsEditingGroup(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="inline">
            <h1>{title}</h1>
            {group?.myRole ? <span className="pill">{group.myRole}</span> : null}
            {isOwner ? (
              <>
                <button
                  disabled={isLoading || !group}
                  onClick={() => {
                    if (!group) return;
                    setIsEditingGroup(true);
                    setGroupDraft({
                      title: group.title ?? "",
                      description: group.description ?? "",
                      isPublic: group.isPublic,
                    });
                  }}
                >
                  Edit
                </button>
                <button disabled={isLoading} onClick={deleteGroup}>
                  Delete group
                </button>
              </>
            ) : null}
          </div>
        )}
        {error && <p className="notice">{error}</p>}
        {isLoading ? <p className="muted">Loading...</p> : null}

        <div className="tabs">
          <button aria-pressed={tab === "topics"} onClick={() => setTab("topics")}>
            Topics
          </button>
          <button aria-pressed={tab === "meetings"} onClick={() => setTab("meetings")}>
            Meetings
          </button>
          <button aria-pressed={tab === "materials"} onClick={() => setTab("materials")}>
            Materials
          </button>
          <button aria-pressed={tab === "tasks"} onClick={() => setTab("tasks")}>
            Tasks
          </button>
          <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
            Chat
          </button>
        </div>

        {group?.myRole ? (
          <div>
            <h2>Members</h2>
            <ul className="list">
              {members.map((m) => (
                <li key={m.id}>
                  <div className="row">
                    <div className="stack" style={{ gap: 6 }}>
                      <span>{m.username}</span>
                      <span className="muted">id: {m.id}</span>
                    </div>
                    <span className="pill">{m.role}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div>
            <h2>Members</h2>
            <p>Join the group to see members and content.</p>
          </div>
        )}
      </div>

      {tab === "topics" && group?.myRole && (
        <section className="card stack" style={{ marginTop: 16 }}>
          <h2>Topics</h2>
          <div className="inline">
            <span className="muted">
              Progress: {topics.filter((t) => t.isDone).length}/{topics.length}
              {topics.length ? ` (${Math.round((topics.filter((t) => t.isDone).length / topics.length) * 100)}%)` : ""}
            </span>
          </div>
          {isOwner ? <CreateOne label="New topic" onCreate={createTopic} /> : null}
          <ul className="list">
            {topics.map((t) => (
              <li key={t.id}>
                {editingTopicId === t.id ? (
                  <div className="stack">
                    <input
                      value={topicDraft.title}
                      onChange={(e) => setTopicDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <input
                      value={topicDraft.order}
                      onChange={(e) => setTopicDraft((p) => ({ ...p, order: e.target.value }))}
                      placeholder="Order (optional)"
                    />
                    <textarea
                      value={topicDraft.description}
                      onChange={(e) => setTopicDraft((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Description (optional)"
                      rows={3}
                    />
                    <div className="inline">
                      <button
                        disabled={isLoading || topicDraft.title.trim().length < 3}
                        onClick={() => {
                          const order = topicDraft.order.trim() ? Number(topicDraft.order) : null;
                          patchTopic(t.id, {
                            title: topicDraft.title.trim(),
                            description: topicDraft.description.trim() ? topicDraft.description.trim() : null,
                            order: Number.isFinite(order as number) ? (order as number) : null,
                          });
                        }}
                      >
                        Save
                      </button>
                      <button
                        disabled={isLoading}
                        onClick={() => {
                          setEditingTopicId(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline">
                    {isOwner ? (
                      <label className="inline" style={{ fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={t.isDone}
                          disabled={isLoading}
                          onChange={(e) => patchTopicDone(t.id, e.target.checked)}
                        />
                        done
                      </label>
                    ) : null}
                    <span>{t.title}</span>
                    {isOwner ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => {
                            setEditingTopicId(t.id);
                            setTopicDraft({
                              title: t.title ?? "",
                              description: t.description ?? "",
                              order: t.order === null || t.order === undefined ? "" : String(t.order),
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button disabled={isLoading} onClick={() => deleteTopic(t.id)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "meetings" && group?.myRole && (
        <section className="card stack" style={{ marginTop: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Meetings</h2>
            <button disabled={isLoading} onClick={downloadCalendar}>
              Download calendar (.ics)
            </button>
          </div>
          {isOwner ? <CreateMeeting onCreate={createMeeting} /> : null}
          <ul className="list">
            {meetings.map((m) => (
              <li key={m.id}>
                {editingMeetingId === m.id ? (
                  <div className="stack">
                    <input
                      value={meetingDraft.startsAt}
                      onChange={(e) => setMeetingDraft((p) => ({ ...p, startsAt: e.target.value }))}
                      placeholder="startsAt (ISO)"
                    />
                    <input
                      value={meetingDraft.durationMinutes}
                      onChange={(e) => setMeetingDraft((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                      type="number"
                      min={1}
                      max={1440}
                    />
                    <input
                      value={meetingDraft.place}
                      onChange={(e) => setMeetingDraft((p) => ({ ...p, place: e.target.value }))}
                      placeholder="Place (optional)"
                    />
                    <input
                      value={meetingDraft.link}
                      onChange={(e) => setMeetingDraft((p) => ({ ...p, link: e.target.value }))}
                      placeholder="Link (optional)"
                    />
                    <textarea
                      value={meetingDraft.notes}
                      onChange={(e) => setMeetingDraft((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Notes (optional)"
                      rows={3}
                    />
                    <div className="inline">
                      <button
                        disabled={isLoading || !meetingDraft.startsAt.trim() || meetingDraft.durationMinutes < 1}
                        onClick={() =>
                          patchMeeting(m.id, {
                            startsAt: meetingDraft.startsAt.trim(),
                            durationMinutes: meetingDraft.durationMinutes,
                            place: meetingDraft.place.trim() ? meetingDraft.place.trim() : null,
                            link: meetingDraft.link.trim() ? meetingDraft.link.trim() : null,
                            notes: meetingDraft.notes.trim() ? meetingDraft.notes.trim() : null,
                          })
                        }
                      >
                        Save
                      </button>
                      <button disabled={isLoading} onClick={() => setEditingMeetingId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline">
                    <span>
                      {new Date(m.startsAt).toLocaleString()} ({m.durationMinutes} min)
                    </span>
                    {isOwner ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => {
                            setEditingMeetingId(m.id);
                            setMeetingDraft({
                              startsAt: m.startsAt,
                              durationMinutes: m.durationMinutes,
                              place: m.place ?? "",
                              link: m.link ?? "",
                              notes: m.notes ?? "",
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button disabled={isLoading} onClick={() => deleteMeeting(m.id)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "materials" && group?.myRole && (
        <section className="card stack" style={{ marginTop: 16 }}>
          <h2>Materials</h2>
          {isOwner ? <CreateMaterial onCreate={createMaterial} /> : null}
          <ul className="list">
            {materials.map((m) => (
              <li key={m.id}>
                {editingMaterialId === m.id ? (
                  <div className="stack">
                    <input
                      value={materialDraft.title}
                      onChange={(e) => setMaterialDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Title"
                    />
                    {m.type === "link" ? (
                      <input
                        value={materialDraft.url}
                        onChange={(e) => setMaterialDraft((p) => ({ ...p, url: e.target.value }))}
                        placeholder="URL"
                      />
                    ) : null}
                    {m.type === "note" ? (
                      <textarea
                        value={materialDraft.content}
                        onChange={(e) => setMaterialDraft((p) => ({ ...p, content: e.target.value }))}
                        placeholder="Content"
                        rows={4}
                      />
                    ) : null}
                    <div className="inline">
                      <button
                        disabled={isLoading || materialDraft.title.trim().length < 1}
                        onClick={() =>
                          patchMaterial(m.id, {
                            title: materialDraft.title.trim(),
                            url: m.type === "link" ? (materialDraft.url.trim() ? materialDraft.url.trim() : null) : null,
                            content: m.type === "note" ? (materialDraft.content.trim() ? materialDraft.content.trim() : null) : null,
                          })
                        }
                      >
                        Save
                      </button>
                      <button disabled={isLoading} onClick={() => setEditingMaterialId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline">
                    <span>
                      {m.title} {m.url ? <a href={m.url}>link</a> : null}
                    </span>
                    {isOwner ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => {
                            setEditingMaterialId(m.id);
                            setMaterialDraft({
                              title: m.title ?? "",
                              url: m.url ?? "",
                              content: m.content ?? "",
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button disabled={isLoading} onClick={() => deleteMaterial(m.id)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "tasks" && group?.myRole && (
        <section className="card stack" style={{ marginTop: 16 }}>
          <h2>Tasks</h2>
          {isOwner ? <CreateOne label="New task" onCreate={createTask} /> : null}
          <ul className="list">
            {tasks.map((t) => (
              <li key={t.id}>
                {editingTaskId === t.id ? (
                  <div className="stack">
                    <input
                      value={taskDraft.title}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Title"
                    />
                    <select
                      value={taskDraft.status}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, status: e.target.value as Task["status"] }))}
                    >
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>
                    <input
                      value={taskDraft.dueAt}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, dueAt: e.target.value }))}
                      placeholder="dueAt (ISO, optional)"
                    />
                    <select
                      value={taskDraft.assigneeId}
                      onChange={(e) => setTaskDraft((p) => ({ ...p, assigneeId: e.target.value }))}
                    >
                      <option value="">(unassigned)</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.username}
                        </option>
                      ))}
                    </select>
                    <div className="inline">
                      <button
                        disabled={isLoading || taskDraft.title.trim().length < 1}
                        onClick={() =>
                          patchTaskOwner(t.id, {
                            title: taskDraft.title.trim(),
                            status: taskDraft.status,
                            dueAt: taskDraft.dueAt.trim() ? taskDraft.dueAt.trim() : null,
                            assigneeId: taskDraft.assigneeId ? taskDraft.assigneeId : null,
                          })
                        }
                      >
                        Save
                      </button>
                      <button disabled={isLoading} onClick={() => setEditingTaskId(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="inline">
                    <span>
                      {t.title} — <b>{t.status}</b>
                    </span>
                    <select
                      value={t.status}
                      disabled={!isOwner && (!auth.user || !t.assigneeId || t.assigneeId !== auth.user.id)}
                      onChange={(e) => patchTaskStatus(t.id, e.target.value as Task["status"])}
                    >
                      <option value="todo">todo</option>
                      <option value="in_progress">in_progress</option>
                      <option value="done">done</option>
                    </select>
                    {isOwner ? (
                      <>
                        <button
                          disabled={isLoading}
                          onClick={() => {
                            setEditingTaskId(t.id);
                            setTaskDraft({
                              title: t.title ?? "",
                              status: t.status,
                              dueAt: t.dueAt ?? "",
                              assigneeId: t.assigneeId ?? "",
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button disabled={isLoading} onClick={() => deleteTask(t.id)}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "chat" && (
        <section className="card stack" style={{ marginTop: 16 }}>
          <h2>Chat</h2>
          <p>Stub: чат будет добавлен позже.</p>
        </section>
      )}
    </div>
  );
};

const CreateOne: React.FC<{ label: string; onCreate: (v: { title: string }) => Promise<void> }> = ({
  label,
  onCreate,
}) => {
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 1) return;

    setError(null);
    setIsLoading(true);
    try {
      await onCreate({ title });
      setTitle("");
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to create");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="inline">
        <input className="grow" value={title} placeholder={label} onChange={(e) => setTitle(e.target.value)} />
        <button disabled={isLoading} type="submit">
          Add
        </button>
      </form>
      {error ? <p className="notice">{error}</p> : null}
    </div>
  );
};

const CreateMeeting: React.FC<{ onCreate: (v: { startsAt: string; durationMinutes: number }) => Promise<void> }> = ({
  onCreate,
}) => {
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onCreate({ startsAt, durationMinutes });
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to create meeting");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="inline">
        <input className="grow2" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <input
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          type="number"
          min={1}
          max={1440}
          style={{ width: 120 }}
        />
        <button disabled={isLoading} type="submit">
          Add
        </button>
      </form>
      {error ? <p className="notice">{error}</p> : null}
    </div>
  );
};

const CreateMaterial: React.FC<{ onCreate: (v: { title: string; url: string }) => Promise<void> }> = ({ onCreate }) => {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("https://");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    setError(null);
    setIsLoading(true);
    try {
      await onCreate({ title, url });
      setTitle("");
      setUrl("https://");
    } catch (e: unknown) {
      if (e instanceof ApiClientError) setError(e.message);
      else setError("Failed to create material");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={submit} className="inline">
        <input className="grow" value={title} placeholder="Title" onChange={(e) => setTitle(e.target.value)} />
        <input className="grow2" value={url} placeholder="URL" onChange={(e) => setUrl(e.target.value)} />
        <button disabled={isLoading} type="submit">
          Add
        </button>
      </form>
      {error ? <p className="notice">{error}</p> : null}
    </div>
  );
};
