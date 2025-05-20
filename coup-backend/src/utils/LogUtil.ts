import { Namespace } from 'socket.io';
import { LOG } from '../constants/events.ts';

type LogEntry = {
  message: string;
  timestamp: Date;
  type: 'normal' | 'action' | 'system' | 'warning';
};

function emitLog(message: string, namespace: Namespace, type: LogEntry['type']) {
  namespace.emit(LOG, {
    message,
    timestamp: new Date(),
    type,
  });
}

export function emitActionLog(message: string, namespace: Namespace) {
  emitLog(message, namespace, 'action');
}

export function emitSystemLog(message: string, namespace: Namespace) {
  emitLog(message, namespace, 'system');
}

export function emitWarningLog(message: string, namespace: Namespace) {
  emitLog(message, namespace, 'warning');
}

export function emitNormalLog(message: string, namespace: Namespace) {
  emitLog(message, namespace, 'normal');
}
