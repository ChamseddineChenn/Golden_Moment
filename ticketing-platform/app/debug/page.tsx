'use client';

import { useEffect, useState } from 'react';
import { eventsAPI } from '@/lib/api';

interface LogEntry {
  timestamp: string;
  message: string;
  data?: any;
}

export default function DebugPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;

    originalLog('[Debug] Starting diagnostic...');

    const testFetch = async () => {
      try {
        originalLog('[Debug] Calling eventsAPI.getById...');
        const response = await eventsAPI.getById('696e3fd28fe69b7a1766e940');

        originalLog('[Debug] Got response, analyzing...');

        const debugData = {
          axiosResponseStatus: response.status,
          axiosResponseStatusText: response.statusText,
          axiosResponseDataKeys: Object.keys(response.data || {}),
          responseDataSample: {
            _id: response.data?._id,
            name: response.data?.name,
            success: response.data?.success,
            statusCode: response.data?.statusCode,
            hasDataField: !!response.data?.data,
            dataFieldName: response.data?.data?.name,
            dataFieldTicketTypes: response.data?.data?.ticketTypes
              ? Object.keys(response.data.data.ticketTypes)
              : null,
          },
          extractionLogic: {
            responseDataData: response.data?.data ? 'EXISTS' : 'MISSING',
            fallbackResponseData: response.data ? 'EXISTS' : 'MISSING',
            wouldUseDataData: !!response.data?.data,
          },
          fullResponse: response.data,
        };

        originalLog('[Debug] Debug data prepared:', debugData);
        setResult(debugData);
        localStorage.setItem('debugResult', JSON.stringify(debugData));
      } catch (err) {
        originalError('[Debug] Error:', err);
        const errorResult = {
          error: String(err),
          stack: err instanceof Error ? err.stack : undefined,
        };
        setResult(errorResult);
        localStorage.setItem('debugResult', JSON.stringify(errorResult));
      } finally {
        setLoading(false);
      }
    };

    testFetch();

    return () => {
      // Restore console
    };
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', fontSize: '13px' }}>
      <h1>🔍 Event API Diagnostic</h1>
      <p>Event ID: 696e3fd28fe69b7a1766e940</p>

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h2>Response Analysis:</h2>
          <pre
            style={{
              backgroundColor: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              overflow: 'auto',
              maxHeight: '70vh',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>

          <div
            style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#fff3cd',
              borderRadius: '4px',
              border: '1px solid #ffc107',
            }}
          >
            <strong>KEY FINDINGS:</strong>
            <ul>
              <li>Axios Response Status: {result.axiosResponseStatus}</li>
              <li>
                Response Data Keys:{' '}
                {result.axiosResponseDataKeys?.join(', ') || 'NONE'}
              </li>
              <li>
                Has response.data.data field:{' '}
                {result.extractionLogic?.responseDataData}
              </li>
              <li>
                Would use data.data:{' '}
                {result.extractionLogic?.wouldUseDataData ? 'YES' : 'NO'}
              </li>
              <li>
                Ticket Types in response.data.data:{' '}
                {result.responseDataSample?.dataFieldTicketTypes?.join(', ') ||
                  'NONE'}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
