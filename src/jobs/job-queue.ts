type QueueEntry = {
  id: string;
  resolve: () => void;
  reject: (error: unknown) => void;
};

export function createJobQueue({
  concurrency,
  worker,
}: {
  concurrency: number;
  worker: (id: string) => Promise<void>;
}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("A concorrência deve ser um inteiro positivo.");
  }

  const pending: QueueEntry[] = [];
  let active = 0;

  function drain(): void {
    while (active < concurrency && pending.length > 0) {
      const entry = pending.shift();
      if (!entry) return;
      active += 1;
      void worker(entry.id)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  return {
    enqueue(id: string): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        pending.push({ id, resolve, reject });
        drain();
      });
    },
  };
}
