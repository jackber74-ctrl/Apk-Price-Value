import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDoc from '@/components/LegalDoc';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = { title: 'Términos y condiciones | Apk Price Value' };

export default function Terminos() {
  return (
    <LegalDoc title="Términos y condiciones de uso">
      <h2>1. Quiénes somos y qué aceptas</h2>
      <p>
        {LEGAL.app} (el «Servicio») es ofrecido por {LEGAL.name}, identificado con {LEGAL.id}, con domicilio en {LEGAL.city} (en
        adelante, «nosotros»). Al crear una cuenta, marcar la casilla de aceptación o usar el Servicio, aceptas estos términos y la{' '}
        <Link href="/privacidad">Política de privacidad</Link>. Si no estás de acuerdo, no uses el Servicio.
      </p>

      <h2>2. Qué hace el Servicio</h2>
      <p>
        Es una herramienta para calcular el costo y el precio sugerido de productos y servicios, guardar tus proveedores, insumos,
        gastos y productos, y buscar proveedores en línea. Tiene un modo simple y un modo avanzado.
      </p>

      <h2>3. Tu cuenta</h2>
      <ul>
        <li>Debes ser mayor de 18 años y tener capacidad legal para obligarte.</li>
        <li>La información que nos des debe ser veraz y estar actualizada.</li>
        <li>Eres responsable de tu contraseña y de lo que ocurra con tu cuenta. Avísanos si sospechas un uso no autorizado.</li>
        <li>Puedes entrar con correo y contraseña o con Google, Facebook o TikTok. Cada método crea o usa una cuenta propia.</li>
      </ul>

      <h2>4. Uso permitido</h2>
      <p>Te comprometes a no:</p>
      <ul>
        <li>Usar el Servicio para fines ilegales o para engañar a terceros.</li>
        <li>Intentar acceder a datos de otros usuarios, vulnerar la seguridad o sobrecargar el Servicio.</li>
        <li>Copiar, revender o extraer de forma masiva el Servicio o sus resultados sin autorización escrita.</li>
        <li>Ingresar datos de otras personas sin tener derecho a hacerlo.</li>
      </ul>

      <h2>5. Los cálculos son una guía</h2>
      <p>
        Los precios, márgenes, costos laborales y puntos de equilibrio que calcula el Servicio son orientativos. Dependen de los
        datos que ingresas y de parámetros (como salarios mínimos, impuestos y prestaciones) que pueden cambiar. No constituyen
        asesoría contable, tributaria, laboral, legal ni financiera. Antes de decidir, valida los resultados con un profesional. La
        decisión final sobre tus precios es tuya.
      </p>

      <h2>6. Búsqueda de proveedores y enlaces de terceros</h2>
      <p>
        Los resultados del buscador y los enlaces a tiendas provienen de terceros. No controlamos sus precios, disponibilidad,
        calidad ni condiciones, y no somos parte de tus compras. Los precios pueden cambiar o estar desactualizados. Algunos enlaces
        pueden generarnos una comisión de afiliado sin costo adicional para ti. Cuando sea así, lo indicaremos.
      </p>

      <h2>7. Planes, precios y pagos</h2>
      <ul>
        <li>El Servicio tiene un plan gratuito y puede tener planes de pago. Sus características y precios se muestran en la app antes de contratarlos.</li>
        <li>Los precios se expresan en pesos colombianos (COP) e incluyen los impuestos que apliquen, salvo que se indique lo contrario.</li>
        <li>Si un plan se renueva automáticamente, lo diremos de forma clara antes del pago, con la fecha y el valor del siguiente cobro.</li>
        <li>Puedes cancelar la renovación cuando quieras. Seguirás usando el plan hasta el final del período ya pagado.</li>
        <li>Emitiremos la factura electrónica cuando la normativa lo exija.</li>
        <li>Los cambios de precio se avisan con anticipación y no afectan el período ya pagado.</li>
      </ul>

      <h2>8. Derecho de retracto y reversión del pago</h2>
      <p>
        Si contratas un plan a distancia, tienes los derechos que reconoce la Ley 1480 de 2011 (Estatuto del Consumidor), incluidos
        el derecho de retracto dentro de los cinco (5) días hábiles siguientes a la contratación y la reversión del pago en los
        casos que la ley permite (artículos 47 y 51). El retracto tiene las excepciones de la misma ley, por ejemplo, los servicios
        cuya prestación haya comenzado con tu acuerdo. Para ejercerlos, escribe a {LEGAL.email}.
      </p>

      <h2>9. Tu contenido</h2>
      <p>
        Los datos que ingresas siguen siendo tuyos. Nos autorizas a almacenarlos y tratarlos solo para prestarte el Servicio, según la{' '}
        <Link href="/privacidad">Política de privacidad</Link>. Puedes descargarlos o eliminarlos desde <Link href="/app/cuenta">Mi cuenta</Link>.
      </p>

      <h2>10. Propiedad intelectual</h2>
      <p>
        El software, el diseño, los textos y la marca del Servicio pertenecen a {LEGAL.name} y están protegidos por la Ley 23 de 1982,
        la Decisión Andina 351 de 1993 y demás normas aplicables. Te damos una licencia personal, limitada, no exclusiva e
        intransferible para usar el Servicio mientras cumplas estos términos.
      </p>

      <h2>11. Disponibilidad</h2>
      <p>
        Trabajamos para que el Servicio funcione de manera continua, pero puede haber interrupciones por mantenimiento, fallas de
        proveedores o causas ajenas a nosotros. Podemos mejorar, cambiar o retirar funciones, avisándote cuando afecte de forma
        importante el plan que contrataste.
      </p>

      <h2>12. Límite de responsabilidad</h2>
      <p>
        En la medida permitida por la ley, no respondemos por pérdidas indirectas, lucro cesante o decisiones comerciales tomadas con
        base en los cálculos o en los resultados de búsqueda, ni por el contenido o las acciones de terceros. Nada de lo aquí
        dispuesto limita los derechos irrenunciables que la ley te reconoce como consumidor, ni nuestra responsabilidad por dolo o
        culpa grave.
      </p>

      <h2>13. Suspensión y terminación</h2>
      <p>
        Puedes dejar de usar el Servicio y eliminar tu cuenta cuando quieras. Podemos suspender o cerrar una cuenta que incumpla estos
        términos o ponga en riesgo a otros usuarios o la plataforma, avisándote cuando sea posible.
      </p>

      <h2>14. Cambios a estos términos</h2>
      <p>
        Podemos actualizarlos. Te avisaremos en la app o por correo cuando el cambio sea importante. Si sigues usando el Servicio
        después de la fecha de entrada en vigencia, se entiende que aceptas la nueva versión. Si no la aceptas, puedes eliminar tu cuenta.
      </p>

      <h2>15. Ley aplicable y solución de conflictos</h2>
      <p>
        Estos términos se rigen por las leyes de la República de Colombia. Intentaremos resolver cualquier diferencia de forma directa
        y amistosa. Si no es posible, podrás acudir a la Superintendencia de Industria y Comercio y a los jueces competentes de
        Colombia.
      </p>

      <h2>16. Contacto y PQRS</h2>
      <p>
        Para peticiones, quejas, reclamos o sugerencias: {LEGAL.email}, {LEGAL.phone}, {LEGAL.address}. Los atendemos dentro de los
        plazos que establece la ley.
      </p>
    </LegalDoc>
  );
}
