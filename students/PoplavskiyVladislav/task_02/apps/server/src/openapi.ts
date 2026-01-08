import type { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Study Groups API",
    version: "1.0.0",
    description: "Variant 42 — Учебные группы: groups, topics, meetings, materials, tasks.",
  },
  servers: [{ url: "http://localhost:3001" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "token",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": { description: "OK" },
        },
      },
    },

    "/auth/register": {
      post: {
        summary: "Register user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "email", "password"],
                properties: {
                  username: { type: "string" },
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
        },
      },
    },

    "/auth/login": {
      post: {
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["usernameOrEmail", "password"],
                properties: {
                  usernameOrEmail: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OK" },
        },
      },
    },

    "/groups": {
      get: {
        summary: "List groups",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "OK" },
        },
      },
      post: {
        summary: "Create group (owner)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string", nullable: true },
                  isPublic: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
        },
      },
    },

    "/groups/{groupId}": {
      get: {
        summary: "Get group",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        summary: "Update group (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
        },
      },
      delete: {
        summary: "Delete group (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { description: "No Content" },
        },
      },
    },

    "/groups/{groupId}/join": {
      post: {
        summary: "Join group",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
        },
      },
    },

    "/groups/{groupId}/leave": {
      post: {
        summary: "Leave group",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
        },
      },
    },

    "/groups/{groupId}/members": {
      get: {
        summary: "List members",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "OK" },
        },
      },
    },

    "/groups/{groupId}/topics": {
      get: {
        summary: "List topics",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create topic (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" } },
      },
    },

    "/groups/{groupId}/topics/{topicId}": {
      patch: {
        summary: "Update topic / mark done (owner)",
        description: "Bonus: topic progress via isDone + doneAt.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "groupId", in: "path", required: true, schema: { type: "string" } },
          { name: "topicId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
      delete: {
        summary: "Delete topic (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "groupId", in: "path", required: true, schema: { type: "string" } },
          { name: "topicId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "204": { description: "No Content" } },
      },
    },

    "/groups/{groupId}/meetings": {
      get: {
        summary: "List meetings",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create meeting (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" } },
      },
    },

    "/groups/{groupId}/calendar.ics": {
      get: {
        summary: "Export meetings as iCalendar",
        description: "Bonus: calendar export + reminders via VALARM.",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "groupId", in: "path", required: true, schema: { type: "string" } },
          { name: "alarmMinutes", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 10080 } },
        ],
        responses: {
          "200": { description: "ICS file (text/calendar)" },
        },
      },
    },

    "/groups/{groupId}/materials": {
      get: {
        summary: "List materials",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create material (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" } },
      },
    },

    "/groups/{groupId}/tasks": {
      get: {
        summary: "List tasks",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create task (owner)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "groupId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "201": { description: "Created" } },
      },
    },
  },
};
