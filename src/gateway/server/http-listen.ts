import type { Server as HttpServer } from "node:http";
import { GatewayLockError } from "../../infra/gateway-lock.js";
import { killPortOccupant } from "../../infra/ports-kill.js";

function tryListen(httpServer: HttpServer, port: number, bindHost: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      httpServer.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      httpServer.off("error", onError);
      resolve();
    };
    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen(port, bindHost);
  });
}

export async function listenGatewayHttpServer(params: {
  httpServer: HttpServer;
  bindHost: string;
  port: number;
}) {
  const { httpServer, bindHost, port } = params;
  try {
    await tryListen(httpServer, port, bindHost);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      // Attempt to kill the process occupying the port and retry once
      const killed = await killPortOccupant(port);
      if (killed) {
        try {
          await tryListen(httpServer, port, bindHost);
          return; // success on retry
        } catch (retryErr) {
          throw new GatewayLockError(
            `port ${port} still in use after killing occupant on ws://${bindHost}:${port}`,
            retryErr,
          );
        }
      }
      throw new GatewayLockError(
        `another gateway instance is already listening on ws://${bindHost}:${port}`,
        err,
      );
    }
    throw new GatewayLockError(
      `failed to bind gateway socket on ws://${bindHost}:${port}: ${String(err)}`,
      err,
    );
  }
}
