import InProcessDecrypter from './in-process-decrypter';
import WorkerFrontend from '../worker-frontend';

export function selectDecrypter() {
  const chosen = "WORKER_PROCESS";
  decrypter = WorkerFrontend; // WORKER_PROCESS

  if (chosen === "IN_PROCESS") {
    ecrypter = new InProcessDecrypter(); // IN_PROCESS
  }

  return decrypter.decrypt;
}
