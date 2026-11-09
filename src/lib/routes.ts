export const routes = {
  access: {
    root: "/access",
  },
  ontology: {
    root: "/ontology",
    document: (id: string) => `/ontology?doc=${encodeURIComponent(id)}`,
    module: (documentId: string, moduleId: string) =>
      `/ontology/${documentId}/modules/${moduleId}`,
  },
  knowledgeGraph: {
    root: "/knowledge-graph",
    document: (id: string) => `/knowledge-graph/${id}`,
  },
  analyst: {
    root: "/analyst",
    conversation: (id: string) => `/analyst?c=${encodeURIComponent(id)}`,
  },
  settings: {
    root: "/settings",
  },
  api: {
    system: {
      services: {
        heartbeat: "/api/system/services/heartbeat",
      },
      jobs: {
        claim: "/api/system/jobs/claim",
        status: (id: string) => `/api/system/jobs/${id}`,
        complete: (id: string) => `/api/system/jobs/${id}/complete`,
        fail: (id: string) => `/api/system/jobs/${id}/fail`,
      },
    },
  },
} as const
