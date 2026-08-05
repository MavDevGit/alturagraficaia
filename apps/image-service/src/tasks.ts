import { CloudTasksClient, protos } from "@google-cloud/tasks";
import { config } from "./config.js";
import type { FalFinalizeRequest } from "./types.js";

let client: CloudTasksClient | undefined;

export async function enqueueFalFinalize(
  payload: FalFinalizeRequest,
): Promise<void> {
  if (!config.TASKS_QUEUE || !config.FINALIZE_URL) {
    throw new Error(
      "Cloud Tasks no está configurado para finalizar el trabajo.",
    );
  }
  client ??= new CloudTasksClient();
  const parent = client.queuePath(
    config.GCP_PROJECT_ID,
    config.TASKS_LOCATION,
    config.TASKS_QUEUE,
  );
  const task: protos.google.cloud.tasks.v2.ITask = {
    dispatchDeadline: { seconds: 930 },
    httpRequest: {
      httpMethod: "POST",
      url: config.FINALIZE_URL,
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": config.INTERNAL_API_KEY,
      },
      oidcToken: {
        serviceAccountEmail: config.TASKS_INVOKER_SERVICE_ACCOUNT,
        audience: config.FINALIZE_AUDIENCE,
      },
      body: Buffer.from(JSON.stringify(payload)).toString("base64"),
    },
  };
  await client.createTask({ parent, task });
}
