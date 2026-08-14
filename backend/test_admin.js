async function testAdmin() {
  console.log('🧪 Probando Login Admin...');
  const loginRes = await fetch('http://127.0.0.1:4000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'ancu2026admin' })
  });
  const loginData = await loginRes.json();
  console.log('Admin login:', loginData);

  console.log('\n🧪 Probando Consulta de Rifas Admin...');
  const rafflesRes = await fetch('http://127.0.0.1:4000/api/admin/raffles');
  const rafflesData = await rafflesRes.json();
  console.log('Raffles found:', rafflesData.raffles?.length);
  if (rafflesData.raffles && rafflesData.raffles[0]) {
    console.log('First raffle prizes:', rafflesData.raffles[0].prizes?.length);
  }
}
testAdmin();
