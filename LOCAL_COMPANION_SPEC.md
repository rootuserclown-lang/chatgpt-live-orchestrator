# Optional Local Companion

The Chrome extension deliberately cannot execute arbitrary operating-system commands. If a local companion is added later, use an explicit local IPC boundary.

REQUEST: action_id, human-readable description, requested operation, confirmation_required, workflow_id.

POLICY: deny by default; explicit allowlist; require confirmation for filesystem/process/network operations; log every request/result; never accept raw shell text as an implicit command; never expose credentials or browser cookies.

Example allowlisted operations: get system information; list a user-selected directory; open a user-selected file; run a specifically installed developer tool with fixed arguments; start/stop a specifically configured local service.

The companion should reject everything else. This design intentionally does not provide an unrestricted "execute anything on my machine" switch.
