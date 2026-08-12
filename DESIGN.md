---
name: "Altura Gráfica IA"
version: "2.0"
description: "Sistema visual corporativo para la landing, autenticación y aplicación de Altura Gráfica IA."
brand:
  primary: "#0AE98A"
  secondary: "#0DD3FF"
  background-primary: "#13161C"
  background-secondary: "#1E2229"
typography:
  family: "Plus Jakarta Sans, Inter, system-ui, sans-serif"
  display-weight: 760
  heading-weight: 740
  body-weight: 400
radii:
  control: "10px"
  card: "14px"
  panel: "18px"
  pill: "999px"
spacing-base: "4px"
---

# Sistema de diseño de Altura Gráfica IA

## 1. Principio rector

**Precisión luminosa sobre un taller oscuro.**

La imagen es siempre la protagonista. La interfaz funciona como un instrumento profesional: oscura, estable y precisa. El verde identifica intención y resultado; el cian explica, conecta y aporta lectura técnica. Ningún acento decorativo debe competir con el archivo que el usuario está procesando.

El sistema cubre cuatro superficies:

- Landing pública: comunica valor y conduce al acceso.
- Autenticación: ofrece confianza y continuidad visual sin distraer del formulario.
- Estudio: prioriza lienzo, configuración, estado y resultado.
- Páginas operativas: historial y administración mantienen claridad con mayor densidad de datos.

## 2. Paleta corporativa

### Colores fuente

| Token | Valor | Uso principal |
|---|---:|---|
| `brand-primary` | `#0AE98A` | Acción principal, progreso, éxito, selección y foco |
| `brand-secondary` | `#0DD3FF` | Información, precisión, enlaces técnicos y contraste complementario |
| `background-primary` | `#13161C` | Lienzo global, fondos profundos y visor |
| `background-secondary` | `#1E2229` | Tarjetas, navegación, formularios e inspector |

### Tokens semánticos oscuros

| Rol | Token CSS | Valor |
|---|---|---:|
| Lienzo | `--canvas` | `#13161C` |
| Superficie | `--surface` | `#1E2229` |
| Superficie elevada | `--surface-raised` | `#272C35` |
| Superficie sutil | `--surface-subtle` | `#242930` |
| Superficie hundida | `--surface-sunken` | `#0E1116` |
| Texto principal | `--ink` | `#F3FAF7` |
| Texto secundario | `--muted` | `#AAB7B1` |
| Borde | `--border` | `#343A43` |
| Borde fuerte | `--border-strong` | `#48505B` |
| Acción | `--accent` | `#0AE98A` |
| Información | `--secondary` | `#0DD3FF` |

### Traducción al modo claro

El modo claro conserva los mismos significados, no los mismos niveles de luminosidad. El verde y el cian corporativos permanecen como colores fuente; las variantes oscuras `--accent-strong` y `--secondary-strong` se usan cuando el color debe funcionar como texto sobre blanco.

El modo oscuro es la experiencia inicial para usuarios nuevos. Una preferencia guardada explícitamente siempre tiene prioridad.

### Reglas cromáticas

1. **El verde significa intención.** Se usa para CTA principal, selección activa, progreso y estados correctos.
2. **El cian significa precisión.** Se usa para información, ayudas técnicas, enlaces secundarios y relaciones visuales.
3. **Los fondos construyen jerarquía.** `#13161C` contiene; `#1E2229` agrupa; las superficies elevadas solo aparecen cuando una capa realmente flota.
4. **Un CTA, un color.** La acción principal es verde sólido. Los gradientes verde–cian se reservan para marca, cifras destacadas y visuales de transformación.
5. **Sin violeta ni magenta.** No forman parte de la identidad corporativa.
6. **Contraste funcional.** Sobre `#0AE98A` y `#0DD3FF` se usa tinta oscura `#05251A`, nunca blanco.

## 3. Tipografía

La familia única es **Plus Jakarta Sans**, con `Inter` y `system-ui` como respaldo.

| Nivel | Tamaño | Peso | Línea | Uso |
|---|---|---:|---:|---|
| Display marketing | `clamp(3.4rem, 6.4vw, 6.7rem)` | 760 | 0.91 | Hero de landing |
| Display aplicación | `clamp(2rem, 4vw, 3.5rem)` | 770 | 1.03 | Títulos de página |
| Sección | `clamp(2.25rem, 4.2vw, 4.2rem)` | 740 | 1.02 | Secciones públicas |
| Encabezado | `1.13rem` | 760 | 1.30 | Paneles y tarjetas |
| Cuerpo | `1rem` | 400 | 1.60 | Explicación y contenido |
| Etiqueta | `0.67rem` | 820 | 1.40 | Categorías y overlines |

Los encabezados usan interletraje negativo. Los cuerpos mantienen una línea amplia. Créditos, dimensiones, factores y porcentajes usan cifras tabulares cuando necesitan comparación directa.

## 4. Espaciado y forma

La unidad base es `4px`. La secuencia recomendada es `4, 8, 12, 16, 20, 24, 28, 32, 48, 64`.

- Controles: radio de `10px`, altura mínima de `44px`.
- Campos: radio de `10px`, altura mínima de `44px`.
- Tarjetas: radio de `14px`, padding de `16–24px`.
- Paneles protagonistas: radio de `18px`.
- Chips, estados y crédito: forma pill.
- Círculos: solo para avatar, estado o manipulación directa.

## 5. Elevación

La jerarquía nace primero del tono y del borde. Las sombras se reservan para capas elevadas e interacción.

- Tarjeta: `0 18px 50px rgb(19 22 28 / 10%)`.
- Acción verde: `0 8px 22px rgb(10 233 138 / 16%)`.
- Acción hover: `0 11px 28px rgb(10 233 138 / 23%)`.
- Modal oscuro: `0 28px 80px rgb(0 0 0 / 48%)`.
- Visor: `0 16px 42px rgb(0 0 0 / 24%)`.

El desenfoque se limita a barra superior, menús, modal, estados flotantes y tarjetas sobre imágenes.

## 6. Componentes

### Botones

- Primario: fondo `#0AE98A`, texto `#05251A`, peso 700–760.
- Secundario: superficie transparente o `#1E2229`, borde semántico y texto principal.
- Informativo: cian solo cuando la acción abre detalle técnico o ayuda.
- Destructivo: usa el rol `danger`; nunca reutiliza el verde.
- Focus: halo cian o verde de 3px con offset de 2px.

### Campos

- Fondo de superficie, borde fuerte y texto principal.
- Hover aumenta contraste sin modificar tamaño.
- Focus usa borde verde y halo semitransparente.
- Ayuda técnica puede usar cian; error usa el rol de peligro.

### Tarjetas y paneles

- Landing y login: superficie `#1E2229` sobre lienzo `#13161C`.
- Estudio: inspector y navegación usan `--surface`; lienzo de trabajo usa `--surface-sunken`.
- Historial: una tarjeta por resultado con miniatura protagonista, datos compactos y acciones al pie.
- Administración: densidad mayor, bordes discretos y estados siempre textuales además de cromáticos.

### Navegación

- El destino activo usa fondo verde suave, texto verde y una marca lateral.
- La barra superior puede ser translúcida solo si conserva legibilidad.
- En móvil, los destinos mantienen icono, etiqueta y área táctil mínima de 44px.

### Estados

- Éxito: verde corporativo.
- Información: cian corporativo.
- Advertencia: ámbar semántico.
- Error: rojo semántico.
- Procesamiento: fase reconocida o actividad indeterminada; no se inventan porcentajes.

### Visor comparativo

El visor usa `#13161C` como fondo estable. El divisor y su control son verdes; la lectura “Después” usa verde con tinta oscura. Los metadatos flotantes usan `#1E2229` translúcido. El resultado nunca se tiñe con un overlay de marca.

## 7. Composición por superficie

### Landing

- Hero editorial dividido entre mensaje y demostración.
- CTA principal verde; CTA secundario oscuro.
- Gradiente verde–cian solo en el titular destacado, marca y cifras.
- Retícula y halos con opacidad baja.

### Login

- Narrativa visual a la izquierda y acceso a la derecha en escritorio.
- En móvil, la narrativa se compacta y el formulario aparece inmediatamente después.
- El formulario conserva Firebase, Google, recuperación y modo local sin variantes visuales inconsistentes.

### Estudio

- El lienzo obtiene la mayor superficie disponible.
- Inspector, cola y navegación se dimensionan alrededor del archivo.
- Cargar, configurar, procesar y descargar permanecen reconocibles en todos los breakpoints.

### Historial y administración

- Máximo de lectura de `84rem`.
- Encabezado editorial seguido por controles y contenido.
- Tablas permiten desplazamiento horizontal en pantallas estrechas sin romper el shell.
- La información crítica no depende únicamente del color.

## 8. Movimiento y accesibilidad

- Transiciones de interacción: `140–180ms`.
- Movimientos de entrada: máximo `220ms`.
- `prefers-reduced-motion` elimina animaciones no esenciales.
- Objetivos táctiles mínimos de `44×44px`.
- Todo icono exclusivamente decorativo usa `aria-hidden`.
- Texto normal: contraste WCAG AA mínimo.
- Verde o cian como fondo siempre usa tinta oscura.
- Foco visible en teclado en todas las rutas.

## 9. Gobierno del sistema

Antes de agregar un color, tamaño o sombra nuevos:

1. Buscar un token semántico existente.
2. Confirmar que el rol no puede resolverse mediante jerarquía, espaciado o borde.
3. Verificar contraste en modo claro y oscuro.
4. Probar escritorio y móvil.
5. Documentar el nuevo rol en este archivo si se reutilizará.

Los componentes no deben usar colores corporativos hardcodeados salvo en la definición raíz de tokens. Las excepciones son recursos de marca y metadatos del navegador.
