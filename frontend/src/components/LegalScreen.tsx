import React from "react";
import { useTranslation } from "react-i18next";

type LegalDocumentType = "privacy" | "terms";

interface LegalScreenProps {
  documentType: LegalDocumentType;
  forceLight?: boolean;
}

interface Section {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export default function LegalScreen({ documentType, forceLight = false }: LegalScreenProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language?.startsWith("es");

  const page = getLegalContent(documentType, isSpanish);
  const articleClass = forceLight
    ? "max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm"
    : "max-w-4xl mx-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-sm";
  const titleClass = forceLight
    ? "text-2xl sm:text-3xl font-black tracking-tight text-slate-900"
    : "text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-100";
  const metaClass = forceLight
    ? "mt-2 text-sm text-slate-500"
    : "mt-2 text-sm text-slate-500 dark:text-zinc-400";
  const sectionTitleClass = forceLight
    ? "text-lg sm:text-xl font-bold text-slate-900"
    : "text-lg sm:text-xl font-bold text-slate-900 dark:text-zinc-100";
  const bodyTextClass = forceLight
    ? "text-sm leading-relaxed text-slate-700"
    : "text-sm leading-relaxed text-slate-700 dark:text-zinc-300";

  return (
    <article className={articleClass}>
      <h1 className={titleClass}>{page.title}</h1>
      <p className={metaClass}>
        <strong>{isSpanish ? "Ultima actualizacion" : "Last updated"}:</strong> August 23, 2026
      </p>

      <div className="mt-6 space-y-6">
        {page.sections.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className={sectionTitleClass}>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className={bodyTextClass}>
                {paragraph}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className={`list-disc pl-5 space-y-1 ${bodyTextClass}`}>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

function getLegalContent(documentType: LegalDocumentType, isSpanish: boolean): { title: string; sections: Section[] } {
  if (documentType === "privacy") {
    return isSpanish
      ? {
          title: "Politica de Privacidad",
          sections: [
            {
              title: "1. Datos que recopilamos",
              bullets: [
                "Datos de cuenta: nombre, correo electronico, credenciales cifradas y preferencias de perfil.",
                "Datos de nutricion: planes, recetas, listas de compra y preferencias que introduces.",
                "Datos tecnicos: tipo de dispositivo, navegador, direccion IP, diagnosticos y registros de uso.",
              ],
            },
            {
              title: "2. Como usamos los datos",
              bullets: [
                "Para prestar y mantener el servicio.",
                "Para personalizar la experiencia y mejorar funciones.",
                "Para proteger cuentas, prevenir abusos y aplicar politicas.",
                "Para soporte tecnico, monitorizacion y cumplimiento legal.",
              ],
            },
            {
              title: "3. Comparticion y conservacion",
              paragraphs: [
                "No vendemos datos personales. Solo compartimos la informacion estrictamente necesaria con proveedores de infraestructura, autenticacion y monitorizacion bajo obligaciones de confidencialidad.",
                "Conservamos los datos mientras sea necesario para prestar el servicio y cumplir obligaciones legales. Puedes solicitar eliminacion de cuenta, sujeta a retenciones obligatorias por ley.",
              ],
            },
            {
              title: "4. Tus derechos",
              paragraphs: [
                "Segun la legislacion aplicable, puedes solicitar acceso, rectificacion, eliminacion, portabilidad u oposicion al tratamiento de tus datos.",
                "Contacto de privacidad: privacy@vitalitynutri.com",
              ],
            },
            {
              title: "5. Cambios de esta politica",
              paragraphs: [
                "Podemos actualizar esta politica periodicamente. La fecha de ultima actualizacion indica la version vigente.",
              ],
            },
          ],
        }
      : {
          title: "Privacy Policy",
          sections: [
            {
              title: "1. Data We Collect",
              bullets: [
                "Account data: name, email address, encrypted credentials, and profile preferences.",
                "Nutrition data: meal plans, recipes, grocery lists, and food preferences you provide.",
                "Technical data: device/browser details, IP address, diagnostics, and usage logs.",
              ],
            },
            {
              title: "2. How We Use Data",
              bullets: [
                "To provide and maintain the service.",
                "To personalize your experience and improve features.",
                "To protect accounts, prevent abuse, and enforce policies.",
                "To support operations, reliability monitoring, and legal compliance.",
              ],
            },
            {
              title: "3. Sharing and Retention",
              paragraphs: [
                "We do not sell personal data. We only share limited information with infrastructure, authentication, and monitoring providers under confidentiality obligations.",
                "We retain data for as long as needed to provide the service and fulfill legal obligations. You may request account deletion, subject to mandatory legal retention.",
              ],
            },
            {
              title: "4. Your Rights",
              paragraphs: [
                "Depending on applicable law, you may request access, correction, deletion, portability, or objection to processing.",
                "Privacy contact: privacy@vitalitynutri.com",
              ],
            },
            {
              title: "5. Policy Updates",
              paragraphs: [
                "We may update this policy periodically. The last updated date reflects the current version.",
              ],
            },
          ],
        };
  }

  return isSpanish
    ? {
        title: "Terminos y Condiciones",
        sections: [
          {
            title: "1. Uso del servicio",
            paragraphs: [
              "Al usar VitalityNutri, aceptas estos terminos. Debes tener al menos 16 anos y mantener segura tu cuenta.",
            ],
          },
          {
            title: "2. Uso permitido",
            bullets: [
              "No usar el servicio para fines ilegales o fraudulentos.",
              "No intentar acceso no autorizado ni comprometer la seguridad.",
              "No interferir con la estabilidad o disponibilidad de la plataforma.",
            ],
          },
          {
            title: "3. Descargo sobre salud",
            paragraphs: [
              "VitalityNutri ofrece herramientas informativas de planificacion nutricional. No constituye consejo medico, diagnostico ni tratamiento.",
              "Consulta siempre a un profesional sanitario cualificado para decisiones medicas o dieteticas.",
            ],
          },
          {
            title: "4. Responsabilidad y terminacion",
            paragraphs: [
              "El servicio se ofrece tal cual y segun disponibilidad. Podemos modificar funciones o suspender acceso por razones legales, de seguridad u operativas.",
              "En la maxima medida permitida por ley, no seremos responsables de danos indirectos, incidentales o consecuenciales.",
            ],
          },
          {
            title: "5. Contacto",
            paragraphs: [
              "Consultas legales: legal@vitalitynutri.com",
            ],
          },
        ],
      }
    : {
        title: "Terms and Conditions",
        sections: [
          {
            title: "1. Service Use",
            paragraphs: [
              "By using VitalityNutri, you accept these terms. You must be at least 16 years old and keep your account secure.",
            ],
          },
          {
            title: "2. Acceptable Use",
            bullets: [
              "Do not use the service for unlawful or fraudulent purposes.",
              "Do not attempt unauthorized access or compromise security.",
              "Do not interfere with platform stability or availability.",
            ],
          },
          {
            title: "3. Health Disclaimer",
            paragraphs: [
              "VitalityNutri provides informational meal-planning tools and is not medical advice, diagnosis, or treatment.",
              "Always consult a qualified healthcare professional for medical or dietary decisions.",
            ],
          },
          {
            title: "4. Liability and Termination",
            paragraphs: [
              "The service is provided as is and as available. We may change features or suspend access for legal, security, or operational reasons.",
              "To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages.",
            ],
          },
          {
            title: "5. Contact",
            paragraphs: [
              "Legal inquiries: legal@vitalitynutri.com",
            ],
          },
        ],
      };
}