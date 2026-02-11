import type { Server as HttpServer } from "node:http";

import { GatewayLockError } from "../../infra/gateway-lock.js";

export async function listenGatewayHttpServer(params: {
  httpServer: HttpServer;
  bindHost: string;
  port: number;
}) {
  const { httpServer, bindHost, port } = params;
  try {
    await new Promise<void>((resolve, reject) => {
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
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      throw new GatewayLockError(
        `another gateway instance is already listening on ws://${bindHost}:${port}`,
        err,
      );
    }
    if (code === "EACCES") {
      throw new GatewayLockError(
        `permission denied binding ws://${bindHost}:${port} — try a port above 1024 or run with elevated privileges`,
        err,
      );
    }
    if (code === "EADDRNOTAVAIL") {
      throw new GatewayLockError(
        `bind address ${bindHost} is not available on this machine — check gateway.bind setting`,
        err,
      );
    }
    throw new GatewayLockError(
      `failed to bind gateway socket on ws://${bindHost}:${port}: ${code ?? String(err)}`,
      err,
    );
  }
}
