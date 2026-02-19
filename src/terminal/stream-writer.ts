import { isEpipeError } from "../logging/console.js";

export type SafeStreamWriterOptions = {
  beforeWrite?: () => void;
  onBrokenPipe?: (err: NodeJS.ErrnoException, stream: NodeJS.WriteStream) => void;
};

export type SafeStreamWriter = {
  write: (stream: NodeJS.WriteStream, text: string) => boolean;
  writeLine: (stream: NodeJS.WriteStream, text: string) => boolean;
  reset: () => void;
  isClosed: () => boolean;
};

export function createSafeStreamWriter(options: SafeStreamWriterOptions = {}): SafeStreamWriter {
  let closed = false;
  let notified = false;

  const noteBrokenPipe = (err: NodeJS.ErrnoException, stream: NodeJS.WriteStream) => {
    if (notified) {
      return;
    }
    notified = true;
    options.onBrokenPipe?.(err, stream);
  };

  const handleError = (err: unknown, stream: NodeJS.WriteStream): boolean => {
    if (!isEpipeError(err)) {
      throw err;
    }
    closed = true;
    noteBrokenPipe(err, stream);
    return false;
  };

  const write = (stream: NodeJS.WriteStream, text: string): boolean => {
    if (closed) {
      return false;
    }
    try {
      options.beforeWrite?.();
    } catch (err) {
      return handleError(err, process.stderr);
    }
    try {
      stream.write(text);
      return !closed;
    } catch (err) {
      return handleError(err, stream);
    }
  };

  const writeLine = (stream: NodeJS.WriteStream, text: string): boolean =>
    write(stream, `${text}\n`);

  return {
    write,
    writeLine,
    reset: () => {
      closed = false;
      notified = false;
    },
    isClosed: () => closed,
  };
}
