import {
  decodeAccessTokenPayload,
  groupsFromTokenPayload,
} from "@/lib/auth/groups";

const ENTITY_PREFIX = "ermriskapi::";
const APPLICATION_ENTITY_ID =
  process.env.AVP_APPLICATION_ENTITY_ID?.trim() || "Application";

/** Shape AVP IsAuthorizedWithToken likely uses (for server-side debug logs). */
export function buildAvpRequestDebug(
  accessToken: string,
  actionId: string,
) {
  const claims = decodeAccessTokenPayload(accessToken) ?? {};
  const sub = String(claims.sub ?? "");
  const groups = groupsFromTokenPayload(claims);

  const principal = {
    entityType: `${ENTITY_PREFIX}User`,
    entityId: sub,
  };

  const action = {
    actionType: `${ENTITY_PREFIX}Action`,
    actionId,
  };

  const resource = {
    entityType: `${ENTITY_PREFIX}Application`,
    entityId: APPLICATION_ENTITY_ID,
  };

  const entities = {
    entityList: [
      {
        identifier: {
          entityType: `${ENTITY_PREFIX}User`,
          entityId: sub,
        },
        attributes: {},
        parents: groups.map((group) => ({
          entityType: `${ENTITY_PREFIX}UserGroup`,
          entityId: group,
        })),
      },
      ...groups.map((group) => ({
        identifier: {
          entityType: `${ENTITY_PREFIX}UserGroup`,
          entityId: group,
        },
        attributes: {},
        parents: [],
      })),
    ],
  };

  const context = {
    contextMap: {
      "cognito:groups": {
        set: groups.map((group) => ({ string: group })),
      },
    },
  };

  return { principal, action, resource, entities, context };
}

export function logAvpRequestDebug(accessToken: string, actionId: string) {
  const { principal, action, resource, entities, context } =
    buildAvpRequestDebug(accessToken, actionId);
  console.log(
    "AVP request:",
    JSON.stringify({ principal, action, resource, entities, context }, null, 2),
  );
}
