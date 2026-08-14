async function testAll() {
  console.log('🧪 1. Probando Login de Super Admin...');
  const loginAdmin = await fetch('http://127.0.0.1:4000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'ancu2026admin' })
  });
  console.log('Admin login:', await loginAdmin.json());

  console.log('\n🧪 2. Probando Login de Editor...');
  const loginEditor = await fetch('http://127.0.0.1:4000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'editor', password: 'ancu2026editor' })
  });
  console.log('Editor login:', await loginEditor.json());

  console.log('\n🧪 3. Probando Endpoint de Noticias Públicas...');
  const newsRes = await fetch('http://127.0.0.1:4000/api/news');
  const newsData = await newsRes.json();
  console.log(`Noticias encontradas: ${newsData.articles?.length}`);
  if (newsData.articles && newsData.articles[0]) {
    console.log('Primera noticia:', newsData.articles[0].title);
  }

  console.log('\n🧪 4. Probando Creación de Preferencia Mercado Pago...');
  const mpPrefRes = await fetch('http://127.0.0.1:4000/api/raffle/create-preference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raffleId: 1,
      numbers: ['042', '124'],
      buyerName: 'Carlos Mendiondo',
      buyerCi: '3.842.190-4',
      buyerPhone: '099 888 777',
      buyerEmail: 'carlos@correo.uy'
    })
  });
  console.log('MP Preference:', await mpPrefRes.json());
}

testAll();
