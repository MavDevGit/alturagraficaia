---
name: "Altura Gráfica IA"
description: "Un taller digital premium donde la imagen y su mejora ocupan el centro de la experiencia."
colors:
  emerald-50: "#E8FBF4"
  emerald-100: "#C6F4E4"
  emerald-200: "#8CE6C9"
  emerald-300: "#4DD6AD"
  emerald-400: "#1FC796"
  emerald-500: "#0DBB84"
  emerald-600: "#08966B"
  emerald-700: "#087658"
  emerald-800: "#075E49"
  emerald-900: "#064D3D"
  copper-light: "#A66A2B"
  copper-dark: "#E1AD70"
  canvas-light: "#F2F5F3"
  paper-light: "#FFFFFF"
  ink-light: "#13201B"
  text-secondary-light: "#5D6D66"
  divider-light: "#DCE5E0"
  canvas-dark: "#07100D"
  paper-dark: "#101A17"
  ink-dark: "#F1F7F4"
  text-secondary-dark: "#A7B8B0"
  divider-dark: "#24342E"
  viewer-ink: "#111B17"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.5rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 740
    lineHeight: 1.25
    letterSpacing: "-0.018em"
  title:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 720
    lineHeight: 1.35
    letterSpacing: "-0.012em"
  body:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    lineHeight: 1.6
  label:
    fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 800
    lineHeight: 1.4
    letterSpacing: "0.11em"
rounded:
  tooltip: "8px"
  compact: "9px"
  control: "12px"
  surface: "14px"
  card: "15px"
  panel: "18px"
  feature: "22px"
  circle: "50%"
spacing:
  compact: "4px"
  small: "8px"
  control: "12px"
  medium: "16px"
  panel: "20px"
  section: "24px"
  spacious: "28px"
components:
  button-primary-light:
    backgroundColor: "{colors.emerald-600}"
    textColor: "{colors.paper-light}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "0 18px"
  button-primary-dark:
    backgroundColor: "{colors.emerald-400}"
    textColor: "{colors.emerald-900}"
    typography: "{typography.title}"
    rounded: "{rounded.control}"
    height: "46px"
    padding: "0 18px"
  input-light:
    backgroundColor: "#FBFCFB"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.control}"
    height: "50px"
  input-dark:
    backgroundColor: "#0C1512"
    textColor: "{colors.ink-dark}"
    rounded: "{rounded.control}"
    height: "50px"
  chip:
    typography: "{typography.title}"
    rounded: "{rounded.compact}"
    height: "28px"
    padding: "0 8px"
  viewer-divider:
    backgroundColor: "{colors.emerald-200}"
    textColor: "{colors.emerald-900}"
    rounded: "{rounded.circle}"
    size: "46px"
---

# Design System: Altura Gráfica IA

## Overview

**Creative North Star: "Taller de Luz Digital"**

Altura Gráfica IA se presenta como un estudio digital premium y preciso: la imagen del usuario es la obra en la mesa, mientras navegación, configuración, crédito y estado forman una instrumentación profesional que acompaña sin competir. La jerarquía es editorial, la densidad es productiva y las superficies usan contraste tonal, líneas finas y profundidad ambiental para ordenar un flujo técnico sin volverlo frío.

El verde IA conserva la continuidad de marca y comunica acción, selección, progreso, foco y calidad confirmada. La tinta vegetal, el papel claro y el lienzo suavemente verdoso sustituyen al gris genérico; el modo oscuro mantiene la misma lógica con fondos verde-negro y texto marfil. El cobre aparece únicamente como voz secundaria del tema, nunca como rival del verde.

El visor antes/después es la superficie protagonista. Debe sentirse como una mesa de inspección de alta resolución: oscura, estable y libre de ornamento innecesario, con controles compactos, zoom legible y un divisor táctil que hace visible la mejora real.

**Key Characteristics:**

- Jerarquía editorial con títulos compactos, peso alto y espaciado negativo.
- Superficies precisas, bordes tenues y sombras ambientales moderadas.
- Densidad profesional: mucha capacidad sin saturación visual.
- Verde IA reservado para acción, estado, foco y evidencia de mejora.
- Visor comparativo de alta resolución como componente firma.
- Respuesta coherente en modo claro, oscuro, escritorio y móvil.

## Colors

La paleta combina una escala esmeralda tecnológica con neutrales de matiz vegetal y una nota cobre contenida.

### Primary

- **Verde IA Esmeralda:** la escala `emerald-50` a `emerald-900` gobierna acciones, selección, progreso, foco y estados positivos. En modo claro la acción principal usa `emerald-600`; en oscuro usa `emerald-400` para conservar contraste y luminosidad.
- **Verde Núcleo:** `emerald-500` es la firma cromática compartida por estilos globales, brillos de lienzo y expresiones de marca.
- **Verde Profundo:** `emerald-700` estabiliza la marca, los pasos completados y otros acentos que requieren mayor densidad visual.

### Secondary

- **Cobre de Taller:** `copper-light` en modo claro y `copper-dark` en modo oscuro aportan una voz secundaria cálida. Se reserva para roles secundarios del tema y no reemplaza al verde en acciones principales.

### Neutral

- **Lienzo Claro:** `canvas-light` sostiene áreas de trabajo y páginas sin competir con el contenido.
- **Papel Claro:** `paper-light` define paneles, barras, inspectores y tarjetas.
- **Tinta Vegetal:** `ink-light` es el texto principal; `text-secondary-light` organiza ayudas y metadatos.
- **Línea de Taller:** `divider-light` separa estructura sin crear cajas pesadas.
- **Noche de Estudio:** `canvas-dark` y `paper-dark` forman el modo oscuro; `ink-dark` y `text-secondary-dark` conservan la jerarquía tipográfica.
- **Línea Nocturna:** `divider-dark` mantiene separaciones discretas sobre superficies oscuras.
- **Tinta del Visor:** `viewer-ink` es el fondo neutral constante del área de inspección, independiente del modo.

### Named Rules

**The Green Means Intent Rule.** El esmeralda debe significar acción, selección, progreso, foco o calidad; no se usa como relleno decorativo sin función.

**The Mode Is a Translation Rule.** Claro y oscuro conservan las mismas relaciones de jerarquía, cambiando luminancia y contraste sin alterar el significado de los colores.

**The Copper Is a Whisper Rule.** El cobre acompaña como acento secundario y cálido; nunca compite con la acción verde ni invade el visor.

## Typography

**Display Font:** Plus Jakarta Sans (con `system-ui` y `sans-serif` como fallback)
**Body Font:** Plus Jakarta Sans (con `system-ui` y `sans-serif` como fallback)

**Character:** La familia única produce una voz contemporánea y confiable. Los títulos usan pesos altos, interletraje negativo y líneas ceñidas; el cuerpo respira más para mantener legibles instrucciones, estados y datos técnicos.

### Hierarchy

- **Display:** peso 760, tamaño fluido y línea 1.02; se reserva para encabezados de página y mensajes editoriales principales.
- **Headline:** peso 740 y línea 1.25; nombra paneles, pasos y bloques de configuración.
- **Title:** peso 720 y línea 1.35; estructura subtítulos, acciones y etiquetas de alta prioridad.
- **Body:** línea 1.6; explica operaciones, errores y estados sin competir con la imagen.
- **Label:** peso 800, interletraje amplio y línea 1.4; identifica categorías y overlines con economía. La variante overline usa mayúsculas por comportamiento de MUI.
- **Datos operativos:** créditos, dimensiones y zoom usan cifras tabulares donde la comparación requiere estabilidad visual.

### Named Rules

**The Editorial Compression Rule.** Los encabezados son densos y ceñidos; la lectura sostenida usa ritmo amplio. No aplicar la compresión de los títulos al texto explicativo.

**The One-Family Rule.** Plus Jakarta Sans cubre interfaz, contenido y datos; la jerarquía proviene de peso, escala, línea y espaciado, no de mezclar familias.

## Layout

La aplicación usa un shell de taller con barra superior de 88 px y riel lateral de 104 px en escritorio. La barra integra marca, selector de herramienta, créditos, tema, ayuda y cuenta; el selector permite cambiar entre Escalador IA, Quitar fondo y Expandir lienzo sin abandonar el estudio. El área restante se divide en un espacio de trabajo flexible y un panel derecho de 344 px, reducido a 324 px por debajo de 1180 px.

El espacio de trabajo apila el lienzo protagonista y una franja operativa detallada de 244 px. La franja distribuye Cargar, Configurar, Procesar y Descargar en cuatro columnas iguales, cada una con estado, contexto y acción propios; baja a 210 px por debajo de 1180 px. El panel derecho reserva la zona superior al inspector y 332 px inferiores a la cola del lote. Dentro del inspector, un encabezado de 76 px precede a una región central con scroll y a un CTA final siempre visible.

Las páginas de contenido se limitan a 1540 px y usan padding fluido entre 30 y 72 px. Historial crece con columnas automáticas de mínimo 280 px. El ritmo espacial recurrente se concentra entre 8 y 28 px: compacto para estados y herramientas; 20–24 px para paneles y secciones; 28 px para respiración amplia.

A 900 px o menos, el riel se convierte en navegación inferior de 72 px, la barra superior baja a 68 px y el selector de herramienta se compacta a un botón de icono de 46 px. El estudio pasa a una sola columna: lienzo, flujo en grilla 2 × 2, inspector y cola. Cada paso conserva al menos 174 px de alto; el inspector deja fluir su contenido y el CTA principal se fija a 14 px de los laterales y 82 px del borde inferior, por encima de la navegación. A 600 px o menos, los pasos bajan a 164 px, el lienzo usa márgenes de 12 px y las comparaciones lado a lado se apilan verticalmente. Las páginas usan 16 px laterales y el sistema conserva un ancho mínimo de 320 px.

**The Image Owns the Workbench Rule.** El lienzo o visor recibe el mayor espacio disponible; inspector, navegación y progreso se dimensionan alrededor de él.

**The Workflow Stays Legible Rule.** Cargar, Configurar, Procesar y Descargar permanecen reconocibles incluso cuando su texto secundario se oculta por falta de ancho.

## Elevation & Depth

La profundidad es híbrida: primero se construye con diferencias tonales, divisores finos y fondos semitransparentes; las sombras aparecen en elementos flotantes, tarjetas interactivas, diálogos y el visor protagonista. El desenfoque se limita a capas que realmente flotan —barra superior, etiquetas del visor, estado de proceso y acción móvil— para mantener la precisión de un instrumento.

### Shadow Vocabulary

- **Ambient Small:** `0 8px 24px rgba(24, 45, 36, 0.07)`; eleva tarjetas, menús y piezas de trabajo sin separarlas del sistema.
- **Ambient Medium:** `0 22px 58px rgba(24, 45, 36, 0.12)`; reserva para menús y estados de mayor prioridad.
- **Primary Action, Light:** `0 8px 20px rgba(8, 118, 88, 0.18)` y `0 10px 26px rgba(8, 118, 88, 0.24)` al hover; da tactilidad contenida al botón principal.
- **Primary Action, Dark:** `0 8px 24px rgba(31, 199, 150, 0.12)` y `0 10px 28px rgba(31, 199, 150, 0.18)` al hover; mantiene luminancia sin halo excesivo.
- **Viewer Stage:** `0 16px 42px rgba(7, 16, 13, 0.16)`; separa la mesa de inspección del lienzo de la app.
- **Modal:** `0 28px 80px rgba(24, 42, 34, 0.22)` en claro y `0 28px 80px rgba(0, 0, 0, 0.48)` en oscuro; se usa únicamente para diálogo modal.

### Named Rules

**The Tonal First Rule.** Una superficie debe diferenciarse primero con tono y borde; la sombra se añade solo cuando la capa flota, responde o necesita prioridad.

**The Blur Has Altitude Rule.** `backdrop-filter` corresponde a capas superpuestas y persistentes, no a tarjetas estáticas.

## Shapes

La forma base es suavemente rectangular y precisa. Los controles principales usan esquinas de 12 px; superficies comunes, 14–15 px; paneles y zonas de trabajo, 18–22 px. Chips compactos usan 9 px. Círculos completos se reservan para avatares, estado, muestras y el tirador del divisor. Los bordes son de un píxel y usan el divisor semántico de cada modo; el trazo discontinuo identifica superficies de carga o vacío.

**The Radius Follows Scale Rule.** Cuanto mayor y más protagonista es una superficie, mayor puede ser su radio; no aplicar el radio de 22 px a controles compactos.

**The Circle Has a Job Rule.** Los círculos comunican persona, estado, muestra o manipulación directa. No son una decoración genérica.

## Components

Los componentes deben sentirse táctiles y confiados, pero visualmente contenidos: el estado se reconoce con tono, borde y movimiento breve antes que con ornamento.

### Buttons

- **Shape:** control suavemente redondeado (`rounded.control`) con altura mínima de 46 px y padding horizontal de 18 px.
- **Primary:** esmeralda de acción por modo, texto de alto contraste, sin elevación MUI por defecto y con sombra ambiental propia.
- **Hover / Focus:** el hover aumenta la sombra; el estado activo desciende 1 px. El foco global usa un contorno esmeralda semitransparente de 3 px con offset de 2 px.
- **Secondary / Ghost:** los botones outlined usan la línea semántica del modo y conservan la misma forma y altura.

### Chips

- **Style:** forma compacta de 9 px, peso 700 y altura pequeña de 28 px. Los chips informativos usan fondos tonales suaves en lugar de saturación sólida.
- **State:** selección y calidad usan el verde; crédito presenta el valor con cifras tabulares y un fondo de acción tenue.

### Cards / Containers

- **Corner Style:** 14–15 px para tarjetas y tablas, 18–22 px para superficies protagonistas.
- **Background:** papel semántico por modo; carga y vacío pueden mezclarlo con transparencia sobre el lienzo.
- **Shadow Strategy:** sombra pequeña al reposo y mediana al hover solo en tarjetas interactivas.
- **Border:** línea semántica de un píxel; discontinuo para carga y vacío.
- **Internal Padding:** 20–24 px en paneles habituales, con 28 px cuando el contenido necesita respiración editorial.

### Inputs / Fields

- **Style:** altura mínima de 50 px, fondo casi papel en claro o tinta profunda en oscuro, borde semántico y radio de 12 px.
- **Focus:** halo esmeralda exterior de 3 px al 12% y borde de foco MUI.
- **Hover:** el borde gana contraste sin cambiar el tamaño del campo.
- **Error / Disabled:** usa los roles semánticos del tema y fondos deshabilitados tonales, nunca baja opacidad indiscriminadamente.

### Navigation

- **Escritorio:** barra superior de papel de 88 px y riel lateral de 104 px. El selector de herramienta mide al menos 176 × 44 px y muestra icono, nombre y desplegable; cada destino del riel ocupa 82 px de alto. El elemento activo usa texto esmeralda y fondo tonal, sin marca decorativa adicional.
- **Móvil:** navegación inferior de cuatro columnas y 72 px; icono y etiqueta permanecen visibles, con área mínima de 62 px por destino.
- **Cambio de herramienta:** a 900 px el selector conserva el icono y oculta texto y flecha; el menú sigue ofreciendo las tres herramientas.
- **Cuenta y crédito:** se mantienen en la barra superior como controles compactos; el avatar usa un verde pálido y borde interior tenue.

### Inspector

El inspector es una superficie de papel con densidad profesional y tres zonas: encabezado de 76 px, contenido desplazable y pie de acción. Sus grupos usan etiquetas de peso alto, divisores discretos, controles segmentados de ancho completo y tarjetas de dimensión con cifras tabulares. El pie muestra el coste estimado y mantiene el CTA a ancho completo; en móvil el botón del pie se oculta y se duplica en una barra flotante persistente sobre la navegación.

### Tool Controls

- **Escalador IA:** alterna entre factor y resolución; ofrece factores 2×, 4×, 6×, 8× y 10× o campos de ancho y alto. Completa la configuración con resumen de dimensiones, slider de textura y fidelidad, formato PNG/JPG/WebP y switch para preservar transparencia.
- **Quitar fondo:** presenta el recorte automático como capacidad principal, explica la conservación de cabello y bordes suaves y fija la salida como PNG transparente.
- **Expandir lienzo:** permite calidad Máxima o Rápida, relación Manual/1:1/16:9/9:16, sliders independientes de hasta 2048 px para cada borde en modo manual, resumen de dimensiones y prompt opcional de contexto.

### High-Resolution Compare Viewer

El visor es la firma del producto. Usa una mesa `viewer-ink`, etiquetas oscuras translúcidas, resultado en verde claro, toolbar de papel y un tirador esmeralda de 46 px sobre una línea blanca de 2 px. Admite comparación con slider o lado a lado; en móvil la vista lado a lado se apila verticalmente. Zoom y posición usan cifras estables, y el área evita gestos nativos que interfieran con pan o comparación.

### Workflow Strip

Cuatro segmentos iguales y detallados mantienen visible la secuencia completa. Cada paso usa un indicador circular de 30 px; los completados cambian a esmeralda y muestran una marca de verificación. Cargar permite elegir o cambiar la imagen; Configurar resume los valores propios de la herramienta; Procesar comunica actividad y ofrece el inicio; Descargar explica disponibilidad y habilita la salida. En móvil la franja se reorganiza en 2 × 2 sin perder nombres, contexto ni acciones.

### Queue Panel

La cola ocupa los 332 px inferiores del panel derecho y separa claramente el trabajo actual del lote. Incluye encabezado con limpieza, estado vacío centrado y lista desplazable de miniaturas, nombres y estados; completados y fallos usan sus colores semánticos. En móvil fluye después del inspector con altura mínima de 220 px y espacio inferior para la navegación persistente.

## Do's and Don'ts

### Do:

- **Do** mantener la imagen o el visor como superficie dominante del estudio.
- **Do** usar el verde para acción, selección, progreso, foco y evidencia de mejora.
- **Do** conservar la paridad semántica entre modo claro y oscuro.
- **Do** construir profundidad primero con tono y línea; reservar sombras y blur para capas con altura real.
- **Do** mantener cifras tabulares en créditos, dimensiones y zoom.
- **Do** respetar `prefers-reduced-motion`; las transiciones se reducen a 0.01 ms cuando el usuario lo solicita.
- **Do** conservar navegación y acción principal alcanzables a partir del breakpoint móvil de 900 px.

### Don't:

- **Don't** competir con la imagen usando paneles saturados, gradientes decorativos intensos o acentos simultáneos.
- **Don't** usar el cobre como color de acción principal o estado de éxito.
- **Don't** aplicar sombras grandes a todas las superficies; la elevación debe corresponder a interacción o jerarquía.
- **Don't** convertir todos los elementos en píldoras o círculos; respeta la escala de radios por tamaño y función.
- **Don't** ocultar la secuencia del flujo ni inventar porcentajes de progreso no confirmados por el backend.
- **Don't** cargar el visor con ornamento que dificulte comparar, mover, hacer zoom o leer calidad real.
