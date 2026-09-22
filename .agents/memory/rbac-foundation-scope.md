---
name: RBAC foundation scope
description: Approved interpretation of legacy admin/owner gates and boundaries of the supplied permission matrix
---

Existing admin/owner-only operations are classified as settings_users permissions, even when their underlying records are estimates, jobs, or customers.

**Why:** The supplied matrix grants some non-admin roles full access to those resources. The user explicitly approved the settings_users classification to preserve existing restrictions without changing the supplied matrix.

**How to apply:** Do not replace these gates with the underlying resource's full permission without explicit approval to broaden access. This foundation is not a complete enforcement rollout for new roles; client ownership scoping and financial-field filtering remain outside this phase.