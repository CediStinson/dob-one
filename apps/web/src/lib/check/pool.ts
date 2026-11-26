/**
 * Führt Aufgaben mit begrenzter Parallelität aus. Liefert eine Aufgabe "stop",
 * werden keine neuen mehr gestartet (z. B. bei Rate-Limit); laufende laufen zu Ende.
 */
export async function runPool<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<"continue" | "stop">,
): Promise<{ started: number; stopped: boolean }> {
  let next = 0;
  let stopped = false;
  const worker = async () => {
    while (!stopped && next < items.length) {
      const i = next++;
      if ((await task(items[i]!, i)) === "stop") stopped = true;
    }
  };
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return { started: next, stopped };
}
