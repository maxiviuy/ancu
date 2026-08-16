# ACTA Y DOCUMENTO DE ENTREGA TÉCNICA Y COMERCIAL
## Plataforma Web Integral & Ecosistema Digital
### **Asociación Nacional de Cazadores del Uruguay (ANCU)**

---

**Fecha de Entrega:** 15 de Agosto de 2026  
**Destinatarios:** Comisión Directiva y Equipo Ejecutivo de ANCU  
**Estado del Proyecto:** ✅ Desarrollo Tecnológico, Arquitectura de Servidor y Backoffice Finalizados  

---

## 1. Carta de Presentación y Cierre de Etapa de Desarrollo

Estimados miembros de la Comisión Directiva de ANCU:

Es un verdadero orgullo y satisfacción para nuestro equipo presentarles la entrega formal y culminación de la fase de diseño, ingeniería y despliegue del nuevo **Ecosistema Digital Oficial de ANCU** ([https://ancu.uy](https://ancu.uy)).

Este proyecto no fue concebido como una simple página web informativa, sino como una **plataforma institucional de vanguardia**, dotada de infraestructura de servidor propio, base de datos relacional de alto rendimiento, sistema de autogestión para socios y un completo panel administrativo (Backoffice) capaz de escalar y acompañar el crecimiento de la Asociación durante los próximos años.

El desarrollo tecnológico de nuestra parte se encuentra **100% culminado, probado y desplegado en servidores de producción**. A partir de este hito, la plataforma queda en manos de la institución para su revisión, carga de contenidos definitivos y puesta en marcha pública.

---

## 2. Identidad Visual y Justificación del Diseño

Para la estética del portal se desarrolló una línea gráfica personalizada que combina modernidad, distinción y respeto por las tradiciones camperas y deportivas del Uruguay:

- **Paleta de Colores (Verde Bosque Profundo `#0B1610`, Bronce Oro `#B8860B` / `#D4AF37` y Negro Grafito `#070C09`):**  
  Evoca directamente la naturaleza, el monte autóctono, el campo y la sobriedad institucional. La acentuación en bronce metalizado confiere un estatus de jerarquía, seriedad y prestigio ante organismos gubernamentales y la sociedad civil.
- **Tipografía de Alta Legibilidad:**  
  Uso de jerarquías visuales modernas (encabezados de fuerte presencia y cuerpos de texto nítidos) para facilitar la lectura tanto en teléfonos móviles como en computadoras.
- **Experiencia de Usuario (UI/UX) & Modo Oscuro Premium:**  
  Efectos de desenfoque de cristal (*glassmorphism*), transiciones suaves, tarjetas dinámicas y microinteracciones que transmiten dinamismo, innovación y máxima solidez tecnológica.

---

## 3. Acceso y Credenciales del Panel de Administración (Backoffice)

Por razones estrictas de seguridad e integridad institucional, el panel de control se mantiene **oculto de los menús públicos** y fuera de la indexación de motores de búsqueda.

- **URL de Acceso Administrativo:**  
  👉 **[https://ancu.uy/admin.html](https://ancu.uy/admin.html)**

### 🔑 Credenciales de Acceso Iniciales:

| Nivel de Usuario | Usuario / Correo | Contraseña Inicial | Alcance de Permisos |
| :--- | :--- | :--- | :--- |
| **Super Administrador (Astro)** | `superadmin` / `superadmin@ancu.uy` | `Astro2026!Admin` | **Acceso Total:** Configuración de servidor, creación/eliminación de usuarios de la directiva, auditoría y control de todos los módulos. |
| **Super Administrador (ANCU)** | `admin` / `admin@ancu.uy` | `ancu2026admin` | **Acceso Total:** Control general institucional y de operaciones. |
| **Editor de Prensa & Rifas** | `editor` / `editor@ancu.uy` | `ancu2026editor` | Redacción de noticias, comunicados oficiales y gestión de parámetros de rifas. |
| **Tesorería & Finanzas** | `tesoreria` / `tesoreria@ancu.uy` | `tesoreria2026` | Revisión, aprobación y rechazo de comprobantes de pago bancario (BROU/Prex). |

> **Nota para la Directiva sobre la Creación de Usuarios:**  
> Con el usuario **Super Administrador** pueden ingresar a la pestaña **👥 Usuarios & Permisos** para crear nuevas cuentas individuales con usuario, correo y contraseña propios para cada miembro de la Comisión Directiva, asignándoles el rol correspondiente según su función (*Superadmin, Administrador, Editor o Tesorería*).

---

## 4. Guía y Paso a Paso de Módulos Autoadministrables

El panel cuenta con herramientas diseñadas para que cualquier integrante de la institución pueda actualizar la información sin necesidad de conocimientos técnicos:

### 1. 🎯 Gestor de Rifas & Premios Oficiales
- **Visualización en Vivo:** Seguimiento en tiempo real de la recaudación acumulada ($ UYU), porcentaje de colocación y estado de los 1.000 números (del `000` al `999`).
- **Edición de Premios:** Modificación de títulos, fotografías oficiales, descripciones técnicas (calibres, marcas, accesorios) y valor comercial estimado de cada premio.
- **Creación de Nuevas Campañas:** Posibilidad de lanzar futuras rifas anuales o extraordinarias configurando fecha de sorteo, precio por número y método de adjudicación (ej. *Quiniela Nocturna de la Lotería Nacional*).

### 2. 📰 Gestor de Noticias, Comunicados y Resoluciones (CMS)
- **Publicación Inmediata:** Redacción de comunicados oficiales, acuerdos con DINABISE / Ministerio de Ambiente y artículos de conservación cinegética.
- **Fotografía de Portada:** Carga directa de imágenes desde la computadora o celular.
- **Destacados:** Opción para fijar una noticia como *Banner Principal Destacado* en la portada de la web.

### 3. 🏛️ Gobernanza, Directivos y Estatutos
- **Nómina de Autoridades:** Con el botón del lápiz **✏️** en cada directivo pueden modificar nombre, cargo oficial (Presidente, Secretario, Vocales, etc.), período de mandato, biografía y foto de perfil.
- **Período de Mandato:** Cambio rápido del período estatutario vigente (ej. `2024 – 2027`), que se refleja al instante en toda la web.
- **Subida del Estatuto Oficial:** Carga del documento PDF oficial registrado ante el MEC para que los socios lo descarguen con un clic.

### 4. ⚙️ Parámetros Institucionales & Cuentas Bancarias
- **Barra Superior de Avisos:** Modificación del texto de la marquesina de anuncios que se muestra en la cabecera de todas las páginas (ej. *Temporada Oficial Habilitada*).
- **Valor de Cuota Social:** Ajuste del importe mensual/anual de la membresía.
- **Cuentas Bancarias:** Modificación de números de cuenta BROU, Prex o bancos privados para transferencias.

### 5. 📅 Actividades, Capacitaciones y Cursos
- Publicación de jornadas de tiro, cursos de balística/seguridad y encuentros de confraternidad.
- Control de cupos máximos, departamento/localización, arancel para socios ($0 o bonificado) vs. público general, y estado de inscripciones (*Abiertas / Agotadas / Finalizadas*).

### 6. 🎁 Convenios y Beneficios Comerciales
- Carga de armerías, comercios de camping, polígonos e indumentaria con convenio vigente.
- Definición del porcentaje de descuento, departamento, sitio web y logo de la empresa asociada.

### 7. ⏳ Bandeja de Transferencias y Comprobantes
- Revisión de comprobantes de pago subidos por socios o compradores de rifas vía transferencia bancaria.
- Al hacer clic en **"Aprobar"**, el sistema marca automáticamente los números de rifa como pagados o renueva la cuota del socio, registrando la auditoría.

---

## 5. Arquitectura de Servidor Propio y Potencial Futuro

La institución cuenta con una infraestructura moderna basada en **Linux VPS dedicado + Node.js + Base de Datos Relacional PostgreSQL**, lo que otorga total independencia y soberanía tecnológica:

### 🚀 Oportunidades de expansión inmediata:
1. **Credenciales Digitales con Validación QR Dinámica:**  
   El portal ya genera carnets de socio digitales interactivos. Inspectores o autoridades pueden escanear el código QR con cualquier teléfono para validar el estado de habilitación al instante.
2. **Sistema de Alertas y Vencimientos Automáticos:**  
   Capacidad de enviar avisos automáticos por correo o WhatsApp sobre vencimientos de **THATA**, guías de caza, permisos de campo o cuotas sociales.
3. **Aplicación Móvil Propia (PWA / App Nativa):**  
   Al disponer de una API centralizada, se puede empaquetar una aplicación móvil para Android/iOS donde los socios reciban novedades en tiempo real, mapas de cotos y reglamentaciones fuera de línea.
4. **Votaciones y Asambleas Digitales Seguras:**  
   Módulo para consultas o elecciones internas basadas en el padrón de socios activos.

---

## 6. Información y Requisitos Pendientes por parte de ANCU

Para que la web quede completamente afinada y con su información institucional final, solicitamos a la Comisión Directiva que nos facilite los siguientes recaudos:

- [ ] **1. Credenciales de Mercado Pago:**
  - Access Token de Producción
  - Public Key
  *(Para vincular la cuenta bancaria de ANCU y recibir cobros directos de rifas y cuotas).*

- [ ] **2. Canales de Contacto Oficiales:**
  - Dirección de correo electrónico oficial de atención (ej. Hotmail, Gmail o info@ancu.uy).
  - Números de teléfono / WhatsApp institucional para consultas de socios.
  - Dirección de sede social o departamento de referencia.

- [ ] **3. Datos Definitivos de Comisión Directiva:**
  - Lista final de directivos, cargos correspondientes y fotos de perfil (si desean reemplazarlas).
  - Breve reseña o biografía de cada autoridad.

- [ ] **4. Estatuto Social Oficial en PDF:**
  - Archivo escaneado o digital del estatuto para su descarga directa por parte de los socios.

- [ ] **5. Convenios y Beneficios Comerciales:**
  - Listado de armerías, comercios amigos y descuentos acordados para publicar en el portal.

---

## 7. Agradecimiento y Conclusión

Agradecemos profundamente la confianza depositada en nuestro equipo para llevar adelante la transformación digital de **ANCU**. 

Quedamos a su entera disposición para coordinar una breve sesión explicativa o asistirles en la carga inicial de los recaudos pendientes.

**Atentamente,**  
*Equipo de Ingeniería y Desarrollo Tecnológico*  
**ANCU Digital Ecosystem** — [https://ancu.uy](https://ancu.uy)
