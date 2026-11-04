import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc from '@/components/LegalDoc';
import { LEGAL, TERMS_UPDATED } from '@/lib/legal';

export const metadata: Metadata = { title: 'Política de privacidad | Apk Price Value' };

export default function Privacidad() {
  return (
    <LegalDoc title="Política de tratamiento de datos personales">
      <p>
        En {LEGAL.app} cuidamos tus datos. Este documento explica qué información recogemos, para qué la usamos, con quién la
        compartimos y cómo puedes ejercer tus derechos, conforme al artículo 15 de la Constitución Política de Colombia, la Ley 1581
        de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y las demás normas que los modifiquen o complementen.
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li><strong>Responsable:</strong> {LEGAL.name}</li>
        <li><strong>Documento de identificación:</strong> {LEGAL.id}</li>
        <li><strong>Domicilio:</strong> {LEGAL.address}, {LEGAL.city}</li>
        <li><strong>Correo para solicitudes:</strong> {LEGAL.email}</li>
        <li><strong>Teléfono:</strong> {LEGAL.phone}</li>
        <li><strong>Sitio web:</strong> {LEGAL.site}</li>
      </ul>
      <p>
        El área encargada de atender consultas, reclamos y solicitudes sobre datos personales es el propio responsable, a través del
        correo indicado.
      </p>

      <h2>2. Qué datos recogemos</h2>
      <h3>Datos de tu cuenta</h3>
      <ul>
        <li>Nombre o nombre del negocio, y correo electrónico (si lo tienes disponible en el método de acceso que uses).</li>
        <li>Contraseña, que guardamos cifrada. Nunca la vemos ni la guardamos en texto legible.</li>
        <li>
          Si entras con Google, Facebook o TikTok, el identificador de tu cuenta en esa plataforma y los datos básicos que ella
          comparta (nombre y, cuando lo permite, correo). TikTok no comparte el correo.
        </li>
        <li>La fecha y la versión de estos documentos que aceptaste, como prueba de tu autorización.</li>
      </ul>
      <h3>Datos de tu negocio que tú escribes</h3>
      <p>
        Proveedores, insumos y precios, gastos fijos, personal y salarios, equipos, productos, recetas, cálculos guardados y
        configuración. Si ingresas datos de otras personas (por ejemplo, empleados o contactos de proveedores), declaras que tienes
        derecho a hacerlo.
      </p>
      <h3>Datos técnicos</h3>
      <p>
        Dirección IP, tipo de navegador y fechas de acceso, que quedan en los registros del servidor por seguridad, y una cookie de
        sesión para mantenerte conectado.
      </p>
      <h3>Búsquedas</h3>
      <p>Las palabras que escribes en el buscador de proveedores se envían al servicio de búsqueda para obtener resultados.</p>
      <p>
        No solicitamos datos sensibles (como salud, origen étnico u opiniones políticas), ni datos de niños, niñas o adolescentes. El
        servicio está dirigido a mayores de 18 años.
      </p>

      <h2>3. Para qué usamos tus datos</h2>
      <ul>
        <li>Crear y administrar tu cuenta y permitirte iniciar sesión.</li>
        <li>Prestarte el servicio: guardar tus datos, calcular costos y precios y buscar proveedores.</li>
        <li>Proteger la plataforma y prevenir fraudes o usos indebidos.</li>
        <li>Atender tus consultas, peticiones, quejas y reclamos.</li>
        <li>Enviarte avisos del servicio, como cambios en estos documentos, seguridad y, cuando existan planes de pago, facturación.</li>
        <li>Cumplir obligaciones legales, contables y tributarias.</li>
        <li>Mejorar el servicio con estadísticas agregadas que no te identifican.</li>
      </ul>
      <p>
        No vendemos tus datos. Si algún día queremos enviarte promociones, te pediremos una autorización aparte, que podrás retirar
        cuando quieras.
      </p>

      <h2>4. Tu autorización</h2>
      <p>
        Al crear tu cuenta marcando la casilla de aceptación, o al continuar con Google, Facebook o TikTok después de ver el aviso,
        nos das tu autorización previa, expresa e informada para tratar tus datos con las finalidades de esta política. Guardamos
        la fecha y la versión aceptadas. Puedes revocarla en cualquier momento eliminando tu cuenta o escribiéndonos.
      </p>

      <h2>5. Tus derechos como titular</h2>
      <p>De acuerdo con el artículo 8 de la Ley 1581 de 2012, puedes:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Solicitar prueba de la autorización que nos diste.</li>
        <li>Ser informado, si lo pides, sobre el uso que hemos dado a tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la ley.</li>
        <li>Revocar la autorización y pedir la supresión de tus datos, cuando no haya un deber legal o contractual de conservarlos.</li>
        <li>Acceder de forma gratuita a tus datos personales.</li>
      </ul>

      <h2>6. Cómo ejercer tus derechos</h2>
      <ul>
        <li>
          <strong>Dentro de la app:</strong> en <Link href="/app/cuenta">Mi cuenta</Link> puedes descargar una copia de tus datos y
          eliminar tu cuenta.
        </li>
        <li>
          <strong>Por correo:</strong> escribe a {LEGAL.email} indicando tu nombre, tu correo de la cuenta y qué necesitas.
        </li>
      </ul>
      <p>
        <strong>Consultas:</strong> las respondemos en máximo diez (10) días hábiles. Si no podemos, te avisaremos el motivo y la
        nueva fecha, que no superará cinco (5) días hábiles más.
      </p>
      <p>
        <strong>Reclamos</strong> (corregir, actualizar, suprimir o por presunto incumplimiento): deben incluir tu identificación, la
        descripción de los hechos, una dirección de respuesta y los documentos que quieras aportar. Los respondemos en máximo quince
        (15) días hábiles, prorrogables por ocho (8) días hábiles más con aviso previo. Solo puedes acudir a la SIC después de haber
        agotado este trámite con nosotros.
      </p>

      <h2>7. Con quién compartimos datos</h2>
      <p>Usamos proveedores que tratan datos por nuestra cuenta, como encargados del tratamiento:</p>
      <ul>
        <li><strong>Vercel Inc.</strong>: alojamiento de la aplicación.</li>
        <li><strong>Neon, Inc.</strong>: base de datos donde se guarda tu información.</li>
        <li><strong>Serper</strong>: buscador de proveedores. Recibe solo los términos que buscas, no los datos de tu cuenta.</li>
        <li><strong>Google, Meta (Facebook) y TikTok</strong>: solo si eliges iniciar sesión con ellos.</li>
        <li><strong>Pasarela de pagos</strong>: cuando existan planes de pago, el proveedor que procese los cobros.</li>
      </ul>
      <p>
        También podemos entregar información a una autoridad cuando una norma o una orden judicial lo exija. Fuera de esos casos, no
        compartimos tus datos con terceros.
      </p>

      <h2>8. Transmisión y transferencia internacional</h2>
      <p>
        Nuestros proveedores pueden tener sus servidores fuera de Colombia, principalmente en Estados Unidos. Con tu autorización, tus
        datos pueden transmitirse o transferirse a esos países. Exigimos a nuestros proveedores medidas de seguridad adecuadas y
        solo los usamos para prestar el servicio.
      </p>

      <h2>9. Seguridad</h2>
      <p>
        Usamos conexión cifrada (HTTPS), contraseñas cifradas, sesiones protegidas y separación de datos entre usuarios, de modo que
        cada persona solo accede a su información. Ningún sistema es completamente seguro. Si ocurre un incidente que afecte tus
        datos, lo informaremos a la SIC y a las personas afectadas cuando la ley lo exija.
      </p>

      <h2>10. Cuánto tiempo conservamos tus datos</h2>
      <p>
        Mientras tengas tu cuenta activa. Si la eliminas, borramos tus datos, salvo aquellos que debamos conservar por normas
        contables, tributarias o por una orden de autoridad. Las copias de seguridad de nuestros proveedores pueden tardar un tiempo
        adicional en desaparecer.
      </p>

      <h2>11. Cookies</h2>
      <p>
        Usamos únicamente una cookie de sesión necesaria para mantenerte conectado. No usamos cookies de publicidad ni de análisis.
        Si en el futuro las agregamos, te lo informaremos y, cuando corresponda, te pediremos autorización.
      </p>

      <h2>12. Cambios a esta política</h2>
      <p>
        Podemos actualizar esta política. Si el cambio es importante, te avisaremos en la app o por correo antes de que aplique. La
        versión vigente es la publicada en esta página, con su fecha.
      </p>

      <h2>13. Vigencia</h2>
      <p>
        Esta política rige desde el {TERMS_UPDATED}. La base de datos de usuarios estará vigente mientras exista el servicio y durante
        el tiempo adicional que exijan las normas aplicables.
      </p>

      <p className="muted small">
        Consulta también los <Link href="/terminos">Términos y condiciones</Link>.
      </p>
    </LegalDoc>
  );
}
