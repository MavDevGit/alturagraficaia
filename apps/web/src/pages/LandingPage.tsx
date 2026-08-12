import {
  ArrowRight,
  Check,
  Crop,
  Download,
  Expand,
  History,
  ImageUp,
  ScanSearch,
  Sparkles,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../auth/context";
import landingHero from "../assets/landing-hero.jpg";
import upscaleDemo from "../assets/upscale-demo.jpg";

const tools = [
  {
    icon: ImageUp,
    title: "Escalador IA",
    copy: "Amplía imágenes hasta 10× y reconstruye detalle para entregas de alta resolución.",
    tag: "Hasta 10×",
  },
  {
    icon: Crop,
    title: "Quitar fondo",
    copy: "Separa el sujeto con transparencia real y conserva bordes complejos con precisión.",
    tag: "PNG transparente",
  },
  {
    icon: Expand,
    title: "Expandir lienzo",
    copy: "Extiende la composición por cualquier borde con un relleno visualmente coherente.",
    tag: "Outpainting",
  },
  {
    icon: History,
    title: "Historial organizado",
    copy: "Vuelve a tus resultados recientes, revisa dimensiones y descarga sin repetir el flujo.",
    tag: "7 días",
  },
];

const steps = [
  { icon: Upload, title: "Sube", copy: "Arrastra una imagen PNG, JPG o WebP." },
  { icon: ScanSearch, title: "Configura", copy: "Define escala, formato y fidelidad." },
  { icon: WandSparkles, title: "Procesa", copy: "La IA genera el resultado y conserva el contexto." },
  { icon: Download, title: "Descarga", copy: "Inspecciona el detalle y exporta el archivo." },
];

export function LandingPage() {
  const { user } = useAuth();
  const appPath = user ? "/studio/upscaler" : "/login";
  const actionLabel = user ? "Ir al estudio" : "Empezar a crear";

  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <Link className="marketing-brand" to="/" aria-label="Altura Gráfica IA, inicio">
          <span className="marketing-brand-mark"><Sparkles aria-hidden="true" /></span>
          <span>Altura Gráfica <strong>IA</strong></span>
        </Link>
        <nav className="marketing-nav" aria-label="Navegación principal">
          <a href="#herramientas">Herramientas</a>
          <a href="#proceso">Cómo funciona</a>
          <a href="#resultados">Resultados</a>
        </nav>
        <Link className="marketing-header-cta" to={appPath}>
          {user ? "Ir al estudio" : "Iniciar sesión"}<ArrowRight aria-hidden="true" />
        </Link>
      </header>

      <main>
        <section className="marketing-hero" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-glow hero-glow-violet" aria-hidden="true" />
          <div className="hero-glow hero-glow-cyan" aria-hidden="true" />
          <div className="marketing-hero-copy">
            <p className="marketing-eyebrow"><Sparkles aria-hidden="true" /> Taller de imagen impulsado por IA</p>
            <h1 id="hero-title">
              Más detalle.<br />
              Más lienzo.<br />
              <span>Menos límites.</span>
            </h1>
            <p className="marketing-lead">
              Amplía, recorta y expande imágenes desde un único espacio de trabajo.
              Hecho para creadores que necesitan resultados listos para entregar.
            </p>
            <div className="marketing-actions">
              <Link className="marketing-primary" to={appPath}>
                {actionLabel}<ArrowRight aria-hidden="true" />
              </Link>
              <a className="marketing-secondary" href="#herramientas">Explorar herramientas</a>
            </div>
            <ul className="marketing-proof" aria-label="Ventajas principales">
              <li><Check aria-hidden="true" /> Flujo claro y guiado</li>
              <li><Check aria-hidden="true" /> Coste visible antes de procesar</li>
              <li><Check aria-hidden="true" /> Comparación a alta resolución</li>
            </ul>
          </div>

          <div className="marketing-hero-visual">
            <div className="hero-window">
              <div className="hero-window-bar">
                <span /><span /><span />
                <em>Altura Gráfica IA · Escalador</em>
              </div>
              <img src={landingHero} alt="Composición digital de imágenes ampliadas con inteligencia artificial" />
              <div className="hero-window-shine" aria-hidden="true" />
            </div>
            <div className="hero-status-card">
              <span><WandSparkles aria-hidden="true" /></span>
              <div><strong>Resultado listo</strong><small>Detalle reconstruido · Alta resolución</small></div>
              <Check aria-hidden="true" />
            </div>
            <div className="hero-format-card" aria-hidden="true">
              <strong>4×</strong><span>PNG</span>
            </div>
          </div>
        </section>

        <dl className="marketing-stats" aria-label="Capacidades del producto">
          <div><dt>Ampliación máxima</dt><dd>10×</dd></div>
          <div><dt>Herramientas creativas</dt><dd>3</dd></div>
          <div><dt>Flujo de trabajo</dt><dd>4 pasos</dd></div>
          <div><dt>Historial disponible</dt><dd>7 días</dd></div>
        </dl>

        <section className="marketing-section" id="herramientas" aria-labelledby="tools-title">
          <div className="section-heading">
            <p className="section-kicker">Herramientas conectadas</p>
            <h2 id="tools-title">Todo el flujo visual, en un solo lugar.</h2>
            <p>Cambia de tarea sin perder el contexto ni salir del estudio.</p>
          </div>
          <div className="tool-grid">
            {tools.map(({ icon: Icon, title, copy, tag }, index) => (
              <article className={`tool-card tool-card-${index + 1}`} key={title}>
                <div className="tool-card-top">
                  <span className="tool-icon"><Icon aria-hidden="true" /></span>
                  <span className="tool-tag">{tag}</span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <span className="tool-index">0{index + 1}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="marketing-process" id="proceso" aria-labelledby="process-title">
          <div className="section-heading section-heading-centered">
            <p className="section-kicker">Cómo funciona</p>
            <h2 id="process-title">De archivo a resultado, sin fricción.</h2>
            <p>Cuatro pasos reconocibles mantienen el control en tus manos.</p>
          </div>
          <ol className="process-list">
            {steps.map(({ icon: Icon, title, copy }, index) => (
              <li key={title}>
                <span className="process-number">0{index + 1}</span>
                <span className="process-icon"><Icon aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="results-section" id="resultados" aria-labelledby="results-title">
          <div className="results-copy">
            <p className="section-kicker">El detalle decide</p>
            <h2 id="results-title">Inspecciona la mejora antes de descargar.</h2>
            <p>
              El visor comparativo mantiene el original y el resultado lado a lado,
              con zoom de alta resolución para comprobar bordes, textura y nitidez.
            </p>
            <ul>
              <li><Check aria-hidden="true" /> Factores de ampliación de 2× a 10×</li>
              <li><Check aria-hidden="true" /> Control de fidelidad y formato de salida</li>
              <li><Check aria-hidden="true" /> Resultado completo antes de descargar</li>
            </ul>
            <Link className="marketing-text-link" to={appPath}>{actionLabel}<ArrowRight aria-hidden="true" /></Link>
          </div>
          <figure className="results-visual">
            <img src={upscaleDemo} alt="Comparación de una fotografía antes y después de ampliarla con IA" />
            <figcaption><span>Antes</span><span>Después</span></figcaption>
          </figure>
        </section>

        <section className="marketing-final-cta">
          <div className="final-orbit" aria-hidden="true" />
          <Sparkles aria-hidden="true" />
          <h2>Tu próxima imagen puede llegar más lejos.</h2>
          <p>Entra al taller, elige una herramienta y transforma tu primer archivo.</p>
          <Link className="marketing-primary" to={appPath}>{actionLabel}<ArrowRight aria-hidden="true" /></Link>
        </section>
      </main>

      <footer className="marketing-footer">
        <Link className="marketing-brand" to="/">
          <span className="marketing-brand-mark"><Sparkles aria-hidden="true" /></span>
          <span>Altura Gráfica <strong>IA</strong></span>
        </Link>
        <p>© 2026 Altura Gráfica IA. Taller de imagen inteligente.</p>
        <div><a href="#herramientas">Herramientas</a><Link to={appPath}>Acceder</Link></div>
      </footer>
    </div>
  );
}
