/**
 * ANCU - Database Migration Script
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  console.log('🚀 Iniciando migración de base de datos PostgreSQL ANCU...');
  
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    
    console.log('📦 Creando tablas e índices...');
    await db.query(schemaSql);
    
    console.log('🌱 Sembrando datos iniciales...');
    await db.query(seedSql);
    
    console.log('✅ Migración completada con éxito.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la migración:', err);
    process.exit(1);
  }
}

runMigration();
