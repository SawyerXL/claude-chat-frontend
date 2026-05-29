export async function testLogin(email: string, password: string) {
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    console.log('[Test] Response:', data);
    console.log('[Test] Status:', res.status);
    return data;
  } catch (err) {
    console.error('[Test] Error:', err);
    return { error: String(err) };
  }
}
