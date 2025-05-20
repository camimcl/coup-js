import React, { useEffect, useRef, useState } from 'react';
import { useSocketContext } from '../../contexts/SocketProvider';
import { LOG } from '../../events';

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'normal' | 'action' | 'system' | 'warning';
}

const Logs: React.FC = () => {
  const { socket } = useSocketContext();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on(LOG, (log: LogEntry) => {
      setLogs((logs) => {
        try {
          log.timestamp = new Date(log.timestamp);
        } catch (error) {
          log.timestamp = new Date();
        }

        return [...logs, log]; // Add the new log to the end of the list
      });
    });

    return () => {
      socket.off(LOG);
    };
  }, [socket]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' }); // Scroll to the bottom
    }
  }, [logs]);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getLogIcon = (type: string): string => {
    switch (type) {
      case 'action':
        return '🎭';
      case 'system':
        return '🔔';
      case 'warning':
        return '⚠️';
      default:
        return '📝';
    }
  };

  return (
    <div id="logs" className="logs-container">
      <div className="logs-header">
        <div className="header-ornament">◆</div>
        <h3 className="logs-title">Histórico do Jogo</h3>
        <div className="header-ornament">◆</div>
      </div>

      <div className="logs-scroll-area">
        {logs.length === 0 ? (
          <div className="empty-logs">
            <div className="empty-icon">📜</div>
            <p>Ainda não há eventos no jogo</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              className={`log-entry log-type-${log.type}`}
              style={{ '--entry-index': index } as React.CSSProperties}
            >
              <div className="log-timestamp">{formatTime(log.timestamp)}</div>
              <div className="log-icon">{getLogIcon(log.type)}</div>
              <div className="log-message">{log.message}</div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <div className="logs-decorations">
        <div className="ink-splat splat-1"></div>
        <div className="ink-splat splat-2"></div>
        <div className="paper-fold"></div>
      </div>
    </div>
  );
};

export default Logs;