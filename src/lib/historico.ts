export async function insertHistorico(records: Record<string, any> | Record<string, any>[]) {
  const body = Array.isArray(records) ? records : [records];
  try {
    const res = await fetch('/api/historico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      console.error('[insertHistorico] API error:', err);
    }
    return res.json();
  } catch (e) {
    console.error('[insertHistorico] fetch error:', e);
    return { error: String(e) };
  }
}
