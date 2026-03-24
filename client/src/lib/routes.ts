export const routes = {
  home: () => "/" as const,

  jobNew: () => "/job/new" as const,
  jobDetail: (id: string) => `/job/${id}` as const,
  jobSummary: (id: string) => `/job/${id}/summary` as const,
  jobExecSummary: (id: string) => `/job/${id}/exec-summary` as const,

  quoteList: () => "/quotes" as const,
  quoteDetail: (id: string) => `/quote/${id}` as const,
  quotePreview: (id: string) => `/quote/${id}/preview` as const,

  projectList: () => "/projects" as const,
  projectDetail: (id: string) => `/projects/${id}` as const,

  opJobList: () => "/op-jobs" as const,
  opJobDetail: (id: string) => `/op-jobs/${id}` as const,

  invoiceList: () => "/invoices" as const,
  invoiceDetail: (id: string) => `/invoices/${id}` as const,

  customerList: () => "/customers" as const,
  contactList: () => "/contacts" as const,

  library: () => "/library" as const,
  settings: () => "/settings" as const,
  admin: () => "/admin" as const,
} as const;
