'use client';

import { useEffect, useState } from 'react';

export default function CheckDebugPage() {
  const [data, setData] = useState<any>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // Check localStorage for debug data
    const eventPageDebug =
      typeof window !== 'undefined'
        ? localStorage.getItem('eventPageDebug')
        : null;
    const debugResult =
      typeof window !== 'undefined'
        ? localStorage.getItem('debugResult')
        : null;

    const result = {
      timestamp: new Date().toISOString(),
      reloadCount,
      eventPageDebug: eventPageDebug ? JSON.parse(eventPageDebug) : null,
      debugResult: debugResult ? JSON.parse(debugResult) : null,
    };

    setData(result);
  }, [reloadCount]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '13px' }}>
      <h1>📋 Debug Data Retrieved from localStorage</h1>

      <button
        onClick={() => setReloadCount((c) => c + 1)}
        style={{
          padding: '10px 15px',
          marginBottom: '20px',
          cursor: 'pointer',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        Refresh ({reloadCount})
      </button>

      {data && (
        <div>
          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: '4px',
            }}
          >
            <h2>Event Page Debug Info</h2>
            {data.eventPageDebug ? (
              <pre
                style={{
                  backgroundColor: '#fff',
                  padding: '10px',
                  borderRadius: '3px',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(data.eventPageDebug, null, 2)}
              </pre>
            ) : (
              <p style={{ color: '#f00' }}>
                ❌ No data found - visit /event/696e3fd28fe69b7a1766e940 first
              </p>
            )}
          </div>

          <div
            style={{
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#fff3e0',
              border: '1px solid #ffcc80',
              borderRadius: '4px',
            }}
          >
            <h2>API Debug Info</h2>
            {data.debugResult ? (
              <pre
                style={{
                  backgroundColor: '#fff',
                  padding: '10px',
                  borderRadius: '3px',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(data.debugResult, null, 2)}
              </pre>
            ) : (
              <p style={{ color: '#f00' }}>
                ❌ No data found - visit /debug first
              </p>
            )}
          </div>

          {data.eventPageDebug && (
            <div
              style={{
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
            >
              <h2>🔍 Analysis</h2>
              <ul>
                <li>
                  <strong>Event ID:</strong> {data.eventPageDebug.eventId}
                </li>
                <li>
                  <strong>Event Name:</strong> {data.eventPageDebug.eventName}
                </li>
                <li>
                  <strong>Has ticketTypes:</strong>{' '}
                  <span
                    style={{
                      color: data.eventPageDebug.hasTicketTypes
                        ? '#0a0'
                        : '#f00',
                      fontWeight: 'bold',
                    }}
                  >
                    {data.eventPageDebug.hasTicketTypes ? '✓ YES' : '✗ NO'}
                  </span>
                </li>
                {data.eventPageDebug.hasTicketTypes && (
                  <>
                    <li>
                      <strong>Ticket Types:</strong>{' '}
                      {data.eventPageDebug.ticketTypesKeys.join(', ')}
                    </li>
                    <li>
                      <strong>Available Count:</strong>{' '}
                      {data.eventPageDebug.availableTicketCount}
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
