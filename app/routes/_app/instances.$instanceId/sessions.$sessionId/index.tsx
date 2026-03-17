import { useOutletContext } from "react-router";

import { MessageCard } from "~/components/session/message-card";
import { PermissionCard } from "~/components/session/permission-card";
import { SessionRevertDock } from "~/components/session/session-revert-dock";
import { partitionMessagesByRevert } from "~/lib/opencode/message-helpers";

import { type SessionRouteContext } from "./+/session-route";

function statusDescription(status: SessionRouteContext["status"]) {
  if (status.type !== "retry") {
    return null;
  }

  return `${status.message} Next retry at ${new Date(status.next).toLocaleTimeString()}.`;
}

export default function InstanceSessionTranscriptRoute() {
  const { instance, messages, pendingPermissions, replyPermission, session, status } = useOutletContext<SessionRouteContext>();
  const actionPath = `/instances/${instance.id}/sessions/${session.id}`;
  const { revertedMessages, visibleMessages } = partitionMessagesByRevert(messages, session.revert);
  const isBusy = status.type !== "idle";

  return (
    <section className="space-y-6 pr-1">
      {status.type === "retry" ? <p className="pt-4 text-sm leading-6">{statusDescription(status)}</p> : null}
      {visibleMessages.length ? (
        <section className="space-y-0">
          {visibleMessages.map((message) => (
            <MessageCard actionPath={actionPath} isSessionBusy={isBusy} key={message.info.id} message={message} />
          ))}
          {revertedMessages.length ? (
            <SessionRevertDock
              actionPath={actionPath}
              isSessionBusy={isBusy}
              messages={revertedMessages}
            />
          ) : null}
          <PermissionCard messages={visibleMessages} onReply={replyPermission} permissions={pendingPermissions} />
        </section>
      ) : (
        <section className="space-y-4 pt-4">
          {revertedMessages.length ? (
            <SessionRevertDock
              actionPath={actionPath}
              isSessionBusy={isBusy}
              messages={revertedMessages}
            />
          ) : null}
          <p className="text-base leading-6">
            {revertedMessages.length ? "All visible messages are currently reverted." : "No messages have been recorded for this session yet."}
          </p>
          <PermissionCard messages={visibleMessages} onReply={replyPermission} permissions={pendingPermissions} />
        </section>
      )}
    </section>
  );
}
