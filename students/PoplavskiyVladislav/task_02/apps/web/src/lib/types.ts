export type Group = {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  myRole?: "owner" | "member" | null;
};

export type Topic = {
  id: string;
  title: string;
  description: string | null;
  order: number | null;
  isDone: boolean;
  doneAt: string | null;
};

export type Meeting = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  place: string | null;
  link: string | null;
  notes: string | null;
  topicId: string | null;
};

export type Material = {
  id: string;
  title: string;
  type: "link" | "file" | "note";
  url: string | null;
  content: string | null;
  topicId: string | null;
  createdAt: string;
  createdById: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: "todo" | "in_progress" | "done";
  createdAt: string;
  topicId: string | null;
  createdById: string;
  assigneeId: string | null;
};

export type GroupMember = {
  id: string;
  username: string;
  role: "owner" | "member";
  joinedAt: string;
};
