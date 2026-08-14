async function test() {
  const res = await fetch('http://127.0.0.1:4000/api/members/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '3.842.190-4' })
  });
  const data = await res.json();
  console.log('Login result:', data);
}
test();
