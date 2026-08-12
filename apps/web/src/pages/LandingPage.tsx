import {
  ArrowRight,
  Check,
  Crop,
  History,
  Image as ImageIcon,
  Maximize,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import landingHero from "../assets/landing-hero.jpg";
import upscaleDemo from "../assets/upscale-demo.jpg";
import { useAuth } from "../auth/context";

const features = [
  {
    icon: ImageIcon,
    title: "Escalador IA",
    copy: "Amplía fotos e ilustraciones hasta 10× conservando textura y bordes nítidos. Listo para impresión.",
  },
  {
    icon: Crop,
    title: "Quitar fondo",
    copy: "Recorte automático con transparencia real. Conserva cabello y bordes difíciles en segundos.",
  },
  {
    icon: Maximize,
    title: "Expandir lienzo",
    copy: "Añade margen por cualquier borde y rellena el espacio nuevo con outpainting coherente.",
  },
  {
    icon: History,
    title: "Historial",
    copy: "Tus resultados organizados con dimensiones, créditos consumidos y descarga directa.",
  },
];

const steps = [
  { title: "Sube", copy: "Arrastra tu imagen en PNG, JPG o WebP." },
  { title: "Configura", copy: "Elige factor, fidelidad y formato de salida." },
  { title: "Procesa", copy: "El motor IA reconstruye detalle real, no ruido." },
  { title: "Descarga", copy: "Exporta en alta resolución al instante." },
];

export function LandingPage() {
  const { user } = useAuth();
  const appPath = user ? "/studio/upscaler" : "/login";

  return (
    <div className="marketing-page reference-landing">
      <header className="reference-header">
        <div className="reference-header-inner">
          <Link className="reference-brand" to="/" aria-label="Altura Gráfica IA">
            <span className="reference-brand-mark">A</span>
            <span>Altura Gráfica IA</span>
          </Link>
          <nav className="reference-navigation" aria-label="Principal">
            <a href="#caracteristicas">Características</a>
            <a href="#proceso">Cómo funciona</a>
            <Link className="reference-button reference-button-small" to={appPath}>
              Probar ahora <ArrowRight aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="reference-hero">
          <div className="reference-grid-bg" aria-hidden="true" />
          <div className="reference-glow reference-glow-primary" aria-hidden="true" />
          <div className="reference-glow reference-glow-secondary" aria-hidden="true" />
          <div className="reference-container reference-hero-grid">
            <div>
              <div className="reference-pill">
                <Sparkles aria-hidden="true" />
                Motor de imagen impulsado por IA
              </div>
              <h1>
                Imágenes de <span>alto impacto</span>
                <br />sin perder calidad
              </h1>
              <p className="reference-hero-copy">
                Escalado inteligente, recorte automático y expansión de lienzo
                en una interfaz clara. Diseñado para creadores, equipos de
                producto y estudios visuales.
              </p>
              <div className="reference-hero-actions">
                <Link className="reference-button" to={appPath}>
                  Probar ahora <ArrowRight aria-hidden="true" />
                </Link>
                <a className="reference-button-secondary" href="#caracteristicas">
                  Ver características
                </a>
              </div>
              <ul className="reference-proof">
                <li><Check aria-hidden="true" /> Sin tarjeta de crédito</li>
                <li><Check aria-hidden="true" /> 2 créditos por imagen</li>
                <li><Check aria-hidden="true" /> Resultados en segundos</li>
              </ul>
            </div>
            <div className="reference-hero-visual">
              <img
                src={landingHero}
                alt="Visual abstracto de imágenes ampliadas por inteligencia artificial"
              />
              <div className="reference-render-card">
                <span><Zap aria-hidden="true" /></span>
                <div>
                  <strong>Render en ~6 segundos</strong>
                  <small>Escalado 4× · 4096 px</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="reference-stats-section">
          <dl className="reference-container reference-stats">
            <div><dt>Ampliación máxima</dt><dd>10×</dd></div>
            <div><dt>Tiempo por imagen</dt><dd>~6s</dd></div>
            <div><dt>Herramientas IA</dt><dd>4</dd></div>
            <div><dt>Créditos por render</dt><dd>2</dd></div>
          </dl>
        </section>

        <section className="reference-features" id="caracteristicas">
          <div className="reference-container">
            <div className="reference-section-heading">
              <p>Herramientas</p>
              <h2>Todo el flujo en un solo lugar</h2>
              <span>Cuatro funciones conectadas: sube, configura, procesa y descarga.</span>
            </div>
            <div className="reference-feature-grid">
              {features.map(({ icon: Icon, title, copy }) => (
                <article className="reference-feature-card" key={title}>
                  <span className="reference-feature-icon"><Icon aria-hidden="true" /></span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="reference-process" id="proceso">
          <div className="reference-container">
            <div className="reference-section-heading reference-section-heading-compact">
              <p>Cómo funciona</p>
              <h2>Cuatro pasos, cero fricción</h2>
            </div>
            <ol className="reference-process-grid">
              {steps.map(({ title, copy }, index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="reference-results">
          <div className="reference-container">
            <div className="reference-results-card">
              <div className="reference-results-glow" aria-hidden="true" />
              <div className="reference-results-grid">
                <div>
                  <p className="reference-kicker">Resultados reales</p>
                  <h2>De borroso a nítido en segundos</h2>
                  <p className="reference-results-copy">
                    El escalador IA recupera detalle y textura incluso en
                    ampliaciones grandes. Compara el original con el resultado
                    procesado.
                  </p>
                  <ul>
                    <li><Check aria-hidden="true" /> Hasta 10× de ampliación</li>
                    <li><Check aria-hidden="true" /> Control de fidelidad de textura</li>
                    <li><Check aria-hidden="true" /> Exporta en PNG, JPG o WebP</li>
                  </ul>
                </div>
                <img
                  src={upscaleDemo}
                  alt="Comparativa antes y después de ampliar una imagen con IA"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="reference-cta-section">
          <div className="reference-cta-card">
            <div className="reference-grid-bg" aria-hidden="true" />
            <div>
              <h2>Empieza a editar en segundos</h2>
              <p>
                Sin instalaciones ni configuración. Sube tu primera imagen y
                descubre la diferencia.
              </p>
              <Link className="reference-button reference-button-large" to={appPath}>
                Probar Altura Gráfica IA <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="reference-footer">
        <div className="reference-container reference-footer-inner">
          <div className="reference-footer-brand">
            <span className="reference-brand-mark reference-brand-mark-small">A</span>
            <strong>Altura Gráfica IA</strong>
          </div>
          <p>© 2026 Altura Gráfica IA. Todos los derechos reservados.</p>
          <div className="reference-footer-links">
            <a href="#caracteristicas">Características</a>
            <Link to={appPath}>App</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
