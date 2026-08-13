# Asociación Nacional de Cazadores del Uruguay (ANCU)
### Portal Institucional · Plataforma de Rifas · Portal de Socios "Mi ANCU"

Plataforma digital oficial desarrollada para la **Asociación Nacional de Cazadores del Uruguay (ANCU)**, con respaldo tecnológico de **Astro** (`astroseguridad.lat` · `info@ancu.uy`).

---

## 🌲 Visión y Concepto
- **Identidad Sobria y Noble:** Negro carbón (`#0A0F0D`), Blanco hueso cálido (`#F7F5EE`), Verde bosque / monte nativo (`#23583C`) y Acentos en bronce (`#C59B27`).
- **Enfoque Institucional:** Representación, Caza Responsable, Conservación y Comunidad.
- **Fotografía de Alta Resolución:** Paisajes del campo uruguayo, convivencia rural, perros de trabajo y actividades de campo.

---

## 🚀 Módulos y Arquitectura del Sistema

### 1. Web Institucional Pública (9 Módulos)
- `index.html`: Portada con 10s pitch, 4 pilares, accesos rápidos, spotlight de la rifa activa, noticias, banner "ANCU somos todos" y franja monocromática de sponsors.
- `institucional.html`: Historia, misión, los 6 ejes estratégicos de acción, mapa departamental de los 19 departamentos y visor de Estatutos.
- `autoridades.html`: Comisión Directiva oficial con mandato formal 2024–2027 y formulario de contacto a secretaría.
- `socios.html`: Beneficios, cuotas ($600 UYU/mes), formulario de afiliación online y acceso al portal.
- `normativa.html`: Centro dinámico de regulaciones (DINABISE, Jabalí plaga Dec. 138/020, THATA/SMA) y el **Generador Oficial de Formulario de Permiso de Campo (PDF)**.
- `noticias.html`: Portal de asuntos públicos con comunicados oficiales de ANCU y botón para compartir en WhatsApp.
- `actividades.html`: Calendario de capacitaciones de tiro, seguridad y jornadas de muestreo científico con la Universidad.
- `rifas.html`: Plataforma interactiva de rifas.
- `contacto.html`: Canal centralizado de atención con la línea `info@ancu.uy` y WhatsApp.

### 2. Plataforma de Rifas Reutilizable (Superando a `rifas.dmz.uy`)
- **Buscador predictivo de números** con enfoque automático.
- **Navegación por centenas** (000–099, 100–199, ..., 900–999).
- **Botón "Elegir al azar"** (Lucky pick de 1, 3 o 5 números libres).
- **Selección múltiple** y carrito con cálculo dinámico ($400 × N).
- **Bloqueo temporal de 15 minutos** con temporizador regresivo anti-duplicados.
- **Pasarela de pago híbrida:** Mercado Pago (automático) y Transferencias BROU/Prex con subida de comprobante.
- **Ticket Digital Oficial con QR:** Verificación pública, comprobante descargable e imprimible y advertencias legales sobre DNLQ y entrega de armas supeditada a THATA vigente.
- **Historial de ganadores** y trazabilidad de sorteos anteriores.

### 3. Portal Privado de Socios ("Mi ANCU")
- **Carnet Digital de Socio Interactivo con Código QR** y estado dinámico (*🟢 Socio al Día / 🟠 Cuota Pendiente*).
- **Módulo de pago de cuota social online** con Mercado Pago.
- **Directorio de beneficios y convenios comerciales** (10% a 20% de descuento en armerías y tiendas de camping aliadas).
- **Repositorio de documentos internos y circulares.**

### 4. Backoffice Administrativo Unificado (`admin.html`)
- **Dashboard de KPIs:** Recaudación en tiempo real, socios activos, transferencias pendientes e impresiones publicitarias.
- **Aprobador de transferencias en 1 clic** para pagos manuales.
- **Exportador oficial en CSV/Excel** listo para presentar ante Escribano Público.
- **Gestor de banners y sponsors** con conteo de impresiones y clics.
- **Registro de Auditoría (Audit Log)** en tiempo real.

---

## 💳 Configuración de Mercado Pago

El sistema está preparado para integrar las credenciales de ANCU en modo Sandbox o Producción mediante variables de entorno:

```env
MP_PUBLIC_KEY=APP_USR-xxxxxx-xxxxxx
MP_ACCESS_TOKEN=APP_USR-xxxxxx-xxxxxx
MP_WEBHOOK_SECRET=xxxxxx
```

---

## 🛠️ Estructura del Repositorio

```
ancu-portal/
├── index.html           # Landing institucional
├── institucional.html   # Historia, misión y estatutos
├── autoridades.html     # Comisión directiva 2024-2027
├── socios.html          # Afiliación y portal Mi ANCU (Carnet QR)
├── normativa.html       # Centro legal y generador PDF de campo
├── noticias.html        # Prensa y comunicados de posición
├── actividades.html     # Calendario de capacitaciones y campo
├── rifas.html           # Plataforma de rifas con timer y MP
├── contacto.html        # Canales de atención (info@ancu.uy)
├── admin.html           # Backoffice de control y auditoría
├── css/
│   └── main.css         # Sistema de diseño sobrio y tokens
├── js/
│   └── app.js           # Motor de estado, rifas y QR
├── assets/              # Fotografías oficiales en alta resolución
├── .gitignore           # Exclusiones de control de versiones
└── README.md            # Documentación técnica
```

---

## 📞 Canales de Soporte
- **Línea Institucional ANCU:** info@ancu.uy
- **Respaldo Tecnológico:** Astro · [astroseguridad.lat](https://astroseguridad.lat)
