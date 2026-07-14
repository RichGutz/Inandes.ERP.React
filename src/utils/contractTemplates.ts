// src/utils/contractTemplates.ts

export const CONTRATO_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: A4;
            margin: 2.2cm 2.0cm 2.0cm 2.0cm;
        }
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.3;
            color: #000;
            text-align: justify;
            font-size: 10.5pt;
        }
        .header-container {
            width: 100%;
            margin-bottom: 30px;
            text-align: left;
        }
        #fixed-logo-header {
            position: fixed;
            top: -1.4cm;
            left: 0cm;
            width: 130px;
            z-index: 1000;
        }
        .logo {
            width: 130px;
            display: block;
            margin-bottom: 15px;
        }
        .header-title {
            font-weight: bold;
            font-size: 11pt;
            text-transform: uppercase;
            text-align: center;
            display: block;
            width: 100%;
            margin-top: 10px;
        }
        .clause-title {
            font-weight: bold;
            margin-top: 15px;
            margin-bottom: 10px;
            text-decoration: underline;
        }
        .clause-text {
            margin-left: 18pt;
            text-indent: -18pt;
            margin-bottom: 8px;
            text-align: justify;
        }
        .titular-records {
            margin-left: 20pt;
            margin-bottom: 15px;
        }
        .placeholder {
            font-weight: bold;
        }
        .signature-table {
            width: 100%;
            margin-top: 40px;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .signature-cell {
            width: 50%;
            padding: 15px 15px 40px 15px;
            vertical-align: top;
            text-align: center;
        }
        .line {
            border-top: 1px solid black;
            margin-bottom: 8px;
            width: 85%;
            margin-left: auto;
            margin-right: auto;
        }
        table.penalty,
        table.dynamic-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 9.5pt;
        }
        table.penalty th,
        table.penalty td,
        table.dynamic-table th,
        table.dynamic-table td {
            border: 1px solid black;
            padding: 6px;
            text-align: center;
        }
        p {
            margin-bottom: 10px;
        }
        .declara-list {
            margin-left: 12pt;
            text-indent: -12pt;
            margin-bottom: 8px;
            text-align: justify;
        }
        .no-underline-title {
            font-weight: bold;
            font-size: 11pt;
            text-transform: uppercase;
            text-align: center;
            margin-top: 10px;
            text-decoration: none;
            display: block;
        }
        .keep-together {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    <div id="fixed-logo-header">
        <img src="{{LOGO_PATH}}" class="logo" alt="Logo INANDES">
    </div>

    <div class="header-container">
        <div class="header-title">CONTRATO PRIVADO DE SUSCRIPCION DE CUOTAS DE PARTICIPACION DE FONDO DE INVERSION PRIVADO</div>
    </div>

    <p>Conste por el presente documento, el Contrato Privado de Suscripción de Cuotas de Participación de Fondo de Inversión (en adelante el “CONTRATO”) que celebran y suscriben, por una parte, <b>INANDES ACTIVOS ALTERNATIVOS S.A.C.</b>, identificada con RUC N° 20601555256, con domicilio en Calle Los Tulipanes N° 147 oficina 306, Edificio Blu Building, Urb. El Polo Hunt, Distrito de Santiago de Surco, provincia y departamento de Lima, debidamente representada por el Sr. Juan Ricardo Gallo Pizarro identificado(a) con DNI No. 02816271, según poderes que constan inscritos en la Partida Electrónica N° 13710953 del Registro de Personas Jurídicas de Lima (en adelante “INANDES”), en su carácter de sociedad administradora de fondos de inversión privados y, por otra parte:</p>

    <div class="titular-records">
        {{TITULAR_RECORDS}}
    </div>

    <p>Todos declarando su domicilio en <span class="placeholder">{{TITULAR_DOMICILIO}}</span> (en adelante los “PARTICIPES”); En términos y contenidos en las siguientes cláusulas:</p>

    <div class="clause-title">PRIMERA: ANTECEDENTES</div>
    <div class="clause-text">1.1 INANDES es una sociedad anónima cerrada constituida bajo las leyes de la República del Perú, mediante escritura pública de fecha 14 de septiembre del 2016. Está inscrita en la partida electrónica 13710953 del Registro de Personas Jurídicas de Lima y con RUC 20601555256. El domicilio actual de la empresa se encuentra en Calle Los Tulipanes N° 147 oficina 306, Edificio Blu Building, Urb. El Polo Hunt, distrito de Santiago de Surco, provincia y departamento de Lima CP 15023.</div>
    <div class="clause-text">1.2 INANDES actualmente administra los fondos de inversión: <b><span class="placeholder">{{FONDO_NOMBRE}}</span></b> (RUC <span class="placeholder">{{FONDO_RUC}}</span>).</div>
    <div class="clause-text">1.3 INANDES fue constituida para dedicarse a la administración de fondos de inversión cuyos certificados de participación se coloquen exclusivamente por oferta privada dado que no se encuentra sujeta a la supervisión de la SUPERINTENDENCIA DEL MERCADO DE VALORES (SMV).</div>
    <div class="clause-text">1.4 Por lo tanto, los FONDOS no serán inscritos en el REGISTRO PUBLICO DEL MERCADO DE VALORES de la SMV, por cuanto sus cuotas de participación están siendo colocadas por oferta privada.</div>
    <div class="clause-text">1.5 Los PARTICIPES son personas naturales, que se encuentran plenamente facultados(as) para realizar inversiones en valores, tales como cuotas de participación en fondos de inversión.</div>
    <div class="clause-text">1.6 Los PARTICIPES declaran haber leído y entendido en su totalidad el REGLAMENTO DE PARTICIPACION del FONDO. Asimismo, declaran que han analizado la información disponible sobre el FONDO, incluyendo el REGLAMENTO DE PARTICIPACION, así como el texto del presente contrato y la información encontrada es suficiente para tomar una decisión informada de inversión.</div>
    <div class="clause-text">1.7 Los PARTICIPES conocen, entienden y aceptan todos los aspectos del REGLAMENTO DE PARTICIPACION del FONDO, incluyendo su política de inversión, factores, perfil de riesgo, condiciones para la recuperación de los fondos invertidos y otras condiciones, así como las advertencias realizadas en el mismo.</div>

    <div class="clause-title">SEGUNDA: SOBRE LA INVERSION</div>
    <div class="clause-text">2.1 El presente CONTRATO tiene por objeto establecer los términos y condiciones bajo los cuales los PARTICIPES suscriben las cuotas de participación del FONDO y por lo tanto adquieren la condición de partícipes del mismo.</div>
    <div class="clause-text">2.2 Las partes acuerdan que los PARTICIPES adquieren cuotas por un valor total de <b><span class="placeholder">{{MONEDA_ISO}} {{MONTO_NUM}}</span></b> (<span class="placeholder">{{MONTO_LETRAS}}</span> <span class="placeholder">{{MONEDA_NOMBRE}}</span>), las cuales estarán representadas en el CERTIFICADO N° <span class="placeholder">{{NUMERO_CERTIFICADO}}</span>. El precio de adquisición de dichas cuotas deberá ser pagado en forma simultánea con la celebración y suscripción del presente contrato.</div>
    <div class="clause-text">2.3 Los PARTICIPES acuerdan que el plazo en que ejercerán su opción de venta del CERTIFICADO DE PARTICIPACIÓN mencionado en el párrafo anterior, a los FONDOS, incluyendo todo aporte adicional que pudieran haber hecho, será ejercido en un plazo de <b><span class="placeholder">{{PLAZO_MESES}}</span></b> (<span class="placeholder">{{PLAZO_LETRAS}}</span>) meses posteriores a la fecha que aparezca en EL CERTIFICADO DE PARTICIPACIÓN.</div>
    <div class="clause-text">2.4 Fecha de cierre de la inversión: Desde el deposito hasta el primer cierre de bimestre o trimestre mas el plazo elegido.</div>
    <div class="clause-text">2.5 Si el cliente no deseara ejercer la opción de venta del CERTIFICADO DE PARTICIPACIÓN descrito en el párrafo anterior, podrá solicitar la firma de un nuevo contrato con una nueva fecha.</div>
    <div class="clause-text">2.6 {{DISTRIBUCION_GANANCIAS_TEXT}}</div>
    <div class="clause-text">2.7 LOS PARTICIPES declaran que los siguientes son los porcentajes que a cada uno le corresponden sobre el CERTIFICADO DE PARTICIPACION:</div>
    {{PARTICIPACION_TABLE}}

    <div class="clause-title">TERCERA: DECLARACION DE LOS PARTICIPES</div>
    <div class="clause-text">3.1 Los PARTICIPES dejan expresa constancia de su decisión de suscribir cuotas de participación del(os) FONDO(S) y por lo tanto convertirse en partícipes del(os) mismo(s), sujetándose a las disposiciones del reglamento de participación del FONDO(S).</div>
    <div class="clause-text">3.2 Los PARTICIPES están de acuerdo en que la rentabilidad de su inversión será proporcional al tiempo que han establecido en el punto 2.3. Esta meta de rentabilidad no tiene efecto retroactivo en caso ocurra lo previsto en el punto 2.4.</div>
    <div class="clause-text">3.3 Los PARTICIPES dejan expresa constancia que ha recibido de forma física o virtual, una copia del reglamento de participación del (os) FONDO(S), y ha sido adecuadamente informado acerca de los objetivos, políticas, plan de inversión, operatividad, gastos y manejo administrativo del FONDO.</div>
    <div class="clause-text">3.4 Los PARTICIPES dejan expresa constancia que conocen y comprenden los riesgos a que se encuentran sujetas las inversiones que realizará el(los) FONDO(S).</div>
    <div class="clause-text">3.5 Los PARTICIPES dejan expresa constancia que conoce y acepta que el (los) FONDO(s) no está(n) inscrito(s) en el REGISTRO PUBLICO DEL MERCADO DE VALORES de la SMV, toda vez que la colocación de sus cuotas se realizará por oferta privada, y que por lo tanto ni el (los) FONDO(S) ni INANDES se encuentran sujetos a la supervisión de la SMV, ni sus partícipes contarán con la protección de las normas peruanas del mercado de valores.</div>
    <div class="clause-text">3.6 Los PARTICIPES dejan expresa constancia que conoce y acepta que INANDES es el administrador del FONDO y como tal percibirá diversas comisiones, las cuales declara conocer y aceptar.</div>

    <div class="clause-title">CUARTA: OBLIGACIONES DE INANDES</div>
    <div class="clause-text">4.1 Por su parte INANDES se obliga a invertir los recursos del(os) FONDO(S), a nombre y por cuenta de éste, de conformidad con lo dispuesto en las normas correspondientes del reglamento de participación del FONDO(S).</div>
    <div class="clause-text">4.2 INANDES se obliga a dar a conocer a los partícipes de forma virtual o física el estado de las inversiones mediante un documento conocido como “FACT SHEET” o “ESTADO DE INVERSIONES” del(os) FONDO(S).</div>
    <div class="clause-text">4.3 INANDES se obliga a supervisar que todas las actividades que efectúe el FONDO respeten las leyes vigentes que resulten de aplicación a los fondos colocados por oferta privada.</div>
    <div class="clause-text">4.4 INANDES se obliga a representar al FONDO ante todo tipo de autoridades, sean éstas públicas o privadas.</div>
    <div class="clause-text">4.5 INANDES se obliga a llevar y actualizar los libros contables del FONDO.</div>
    <div class="clause-text">4.6 INANDES se obliga a cumplir con las demás obligaciones establecidas en el reglamento de participación del FONDO.</div>
    <div class="clause-text">4.7 INANDES se obliga por instrucción expresa de LOS PARTICIPES a depositar las ganancias provenientes de LA INVERSION en las proporciones y a las cuentas que se muestran a continuación:</div>
    {{DEPOSITO_TABLE}}

    <div class="clause-title">QUINTA: SOBRE EL APORTE AL FONDO</div>
    <div class="clause-text">5.1 Los PARTICIPES deberán realizar los aportes al patrimonio del FONDO de acuerdo con lo dispuesto en el reglamento de participación del mismo.</div>

    <div class="clause-title">SEXTA: OTRAS OBLIGACIONES</div>
    <div class="clause-text">6.1 Todo aquello que no se haya estipulado expresamente en el presente Contrato en relación a los derechos, obligaciones y responsabilidades del FONDO, de los PARTICIPES y de INANDES, se regirá por las disposiciones del reglamento de participación del FONDO, la Ley de Títulos Valores, Ley 27287 y la Ley General de Sociedades, Ley 26887, sus normas modificatorias, ampliatorias y sustitutorias, y las demás normas que se dicten sobre la materia y que sean aplicables a los fondos de inversión colocados por oferta privada.</div>

    <div class="clause-title">SEPTIMA: VALIDEZ DEL CONTRATO EN OTRAS JURISDICCIONES</div>
    <div class="clause-text">7.1 Cualquier disposición, estipulación o acuerdo de este Contrato que sea o pudiera convertirse en prohibida, inválida, ineficaz o inejecutable en cualquier jurisdicción, carecerá de validez para la referida jurisdicción sólo en lo que se refiere a tal disposición, estipulación o acuerdo en la jurisdicción correspondiente, sin invalidar las disposiciones restantes de este Contrato, o afectar la validez, eficacia o ejecutabilidad de dicha disposición, estipulación o acuerdo en cualquier otra jurisdicción.</div>

    <div class="clause-title">OCTAVA: NEGOCIACIONES PREVIAS</div>
    <div class="clause-text">8.1 El presente Contrato contiene todos los acuerdos y estipulaciones a los que han arribado las partes y reemplaza y prevalece sobre cualquier negociación, oferta, acuerdo, entendimiento, contrato o convenio que las partes hayan sostenido, cursado o pactado según sea el caso, con anterioridad a la fecha de celebración de este documento.</div>

    <div class="clause-title">NOVENA: VIGENCIA DEL CONTRATO</div>
    <div class="clause-text">9.1 El presente CONTRATO entrará en vigor desde el momento en que los PARTICIPES adquieran dicha condición, conforme a lo dispuesto en el REGLAMENTO DE PARTICIPACION del FONDO(S).</div>
    <div class="clause-text">9.2 La adquisición de la calidad de PARTICIPES del FONDO(S) presupone la sujeción de los partícipes a las condiciones señaladas en el presente Contrato de suscripción, el reglamento de participación del(os) FONDO(S) y las normas que regulan los fondos de inversión colocados por oferta privada.</div>
    <div class="clause-text">9.3 El presente CONTRATO quedará sin efecto a partir del momento en que los PARTICIPES transfiera a una tercera o terceras personas todas las cuotas de participación que mantengan en el(os) FONDO(S), ejerzan su derecho de separación del mismo o cuando sus cuotas de participación sean redimidas al vencimiento del plazo de vigencia del FONDO(S).</div>

    <div class="clause-title">DECIMA: OPCION DE VENTA DEL CONTRATO</div>
    <div class="clause-text">10.1 Los fondos provenientes del ejercicio de la opción de venta del contrato establecida en el punto 2.3 será transferida por los FONDOS a la cuenta establecida de los PARTICIPES en un plazo no mayor a <b><span class="placeholder">{{PLAZO_RESCATE_DIAS}}</span></b> días.</div>
    <div class="clause-text">10.2 En caso de que los PARTICIPES deseen ejercer la opción de venta del contrato antes de la fecha determinada en el párrafo 2.3, deberán asumir una penalidad (sobre el capital total administrado en el punto 2.2) por cada mes o fracción de mes que falte para la fecha establecida en el punto 2.3; siempre y cuando haya transcurrido un período mínimo de permanencia. La tabla siguiente señala los plazos mínimos de permanencia de la inversión y la penalización.</div>

    <table class="penalty">
        <tr>
            <th>PLAZO CERTIFICADO</th>
            <th>PLAZO MINIMO PERMANENCIA</th>
            <th>% PENALIZACION</th>
            <th>FECHA DE INICIO DE VALIDEZ DE OPCION DE VENTA</th>
        </tr>
        <tr>
            <td><span class="placeholder">{{PLAZO_MESES}}</span></td>
            <td><span class="placeholder">{{PLAZO_MINIMO_PERMANENCIA}}</span></td>
            <td><span class="placeholder">{{PENALIDAD_PORCENTAJE}}</span></td>
            <td><span class="placeholder">{{FECHA_INICIO_VALIDEZ_VENTA}}</span></td>
        </tr>
    </table>

    <div style="page-break-before: always;"></div>
    <div class="keep-together">
        <div class="clause-title">DECIMO PRIMERA: CONTROVERSIAS</div>
        <div class="clause-text">11.1 Cualquier controversia que pudiera suscitarse entre INANDES y los partícipes del(os) FONDO(S) por causa de la celebración, interpretación o ejecución del presente CONTRATO, incluyendo aquellas relativas a su posible nulidad, que no pueda ser resuelta por éstas directamente en forma amigable, será sometida a un arbitraje de derecho ante el Centro Arbitral de la Cámara de Comercio de Lima, de acuerdo con lo estipulado en el REGLAMENTO DE PARTICIPACION del FONDO(S).</div>
    </div>

    <p style="margin-top: 20px;">En fe de lo cual se celebra y suscribe el presente Contrato, en dos ejemplares de igual tenor y valor, a los <span class="placeholder">{{FECHA_CONTRATO_LARGA}}</span>.</p>

    <br>

    <table class="signature-table">
        <tr>
            <td class="signature-cell">
                <div class="line"></div>
                <b>por INANDES ACTIVOS <br>ALTERNATIVOS S.A.C.</b><br>
                Juan Ricardo Gallo Pizarro<br>
                DNI 02816271
            </td>
            <td class="signature-cell">
                <div class="line"></div>
                <b>EL PARTICIPE</b><br>
                <span class="placeholder">{{P1_NOMBRE}}</span><br>
                DNI <span class="placeholder">{{P1_DNI}}</span>
            </td>
        </tr>
        <tr>
            <td class="signature-cell">{{P2_BLOCK}}</td>
            <td class="signature-cell">{{P3_BLOCK}}</td>
        </tr>
        <tr>
            <td class="signature-cell">{{P4_BLOCK}}</td>
            <td class="signature-cell"></td>
        </tr>
    </table>

    <div style="page-break-before: always;"></div>

    <div class="no-underline-title">DECLARACIÓN DE RECEPCIÓN, LECTURA Y ENTENDIMIENTO DEL REGLAMENTO DE PARTICIPACIÒN Y DEL CONTRATO DE SUSCRIPCIÒN DE CUOTAS DEL <span class="placeholder">{{FONDO_NOMBRE}}</span>.</div>

    <p style="margin-top: 15px;">Nosotros, <b><span class="placeholder">{{PARTICIPES_LISTA}}</span></b>, quienes firmamos y estamos de acuerdo con el contrato de suscripción de cuotas del <b><span class="placeholder">{{FONDO_NOMBRE}}</span></b> (“PARTICIPES”) declaramos en libre y pleno uso de nuestras facultades que:</p>

    <div class="declara-list">1. Hemos recibido una copia del Reglamento de Participación y del Contrato de Suscripción de Cuotas del <b><span class="placeholder">{{FONDO_NOMBRE}}</span></b> – FONDO DE INVERSION PRIVADO.</div>
    <div class="declara-list">2. Hemos leído la integridad del documento, he realizado las consultas pertinentes y todas las preguntas han sido respondidas a satisfacción.</div>
    <div class="declara-list">3. Comprendemos que el <b><span class="placeholder">{{FONDO_NOMBRE}}</span></b> – FONDO DE INVERSION PRIVADO no está supervisado por la SUPERINTENDENCIA DEL MERCADO DE VALORES (SMV).</div>
    <div class="declara-list">4. Soy o somos consciente(s) de que se trata de una inversión ilíquida.</div>
    <div class="declara-list">5. Tenemos pleno conocimiento que existe un periodo mínimo de permanencia en donde no podemos solicitar por adelantado la ejecución de la opción de venta.</div>
    <div class="declara-list">6. Se nos ha informado que existe una penalidad por ejercer la opción de venta antes del plazo pactado en el contrato de suscripción de cuotas.</div>
    <div class="declara-list">7. Estamos completamente de acuerdo con el contenido de los documentos expuestos ante mi persona y nos comprometemos a cumplirlos en lo que nos corresponde en nuestra calidad de partícipes del <b><span class="placeholder">{{FONDO_NOMBRE}}</span></b>.</div>
    <div class="declara-list">8. El inversionista reconoce que existe un periodo minimo de permanencia de su inversión y se somete a las penalidades expuestas por rescates anticipados.</div>

    <br>
    <p>Lima, <span class="placeholder">{{FECHA_CONTRATO_LARGA}}</span></p>

    <table class="signature-table">
        <tr>
            <td class="signature-cell">
                <div class="line"></div>
                <b>EL PARTICIPE</b><br>
                <span class="placeholder">{{P1_NOMBRE}}</span><br>
                DNI <span class="placeholder">{{P1_DNI}}</span>
            </td>
            <td class="signature-cell">{{P2_BLOCK}}</td>
        </tr>
        <tr>
            <td class="signature-cell">{{P3_BLOCK}}</td>
            <td class="signature-cell">{{P4_BLOCK}}</td>
        </tr>
    </table>
</body>
</html>`;

export const CERTIFICADO_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: A4 landscape;
            margin: 1.5cm;
        }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            text-align: justify;
        }
        .certificate-container {
            width: 100%;
            height: 100%;
            border: 0px solid #ccc;
            padding: 20px;
            position: relative;
            zoom: 0.9;
        }
        .header-container {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
            justify-content: space-between;
        }
        .logo-box {
            width: 150px;
            flex-shrink: 0;
        }
        .side-spacer {
            width: 150px;
            flex-shrink: 0;
        }
        .logo-efi {
            width: 150px;
        }
        .center-box {
            flex-grow: 1;
            text-align: center;
        }
        .fondo-info {
            font-weight: bold;
            font-size: 14pt;
            text-transform: uppercase;
            margin-bottom: 2px;
        }
        .ruc-info {
            font-size: 10pt;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .cert-title {
            font-size: 16pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 5px 0 0 0;
        }
        .content-text {
            font-size: 12.5pt;
            margin-bottom: 40px;
            line-height: 1.8;
            text-align: justify;
        }
        .placeholder {
            font-weight: bold;
        }
        .footer {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
        }
        .place-date {
            font-size: 12pt;
        }
        .signature-block {
            text-align: center;
            width: 250px;
        }
        .signature-img {
            width: 180px;
            height: auto;
            margin-bottom: 5px;
        }
        .signature-line {
            border-top: 1.5px solid #000;
            margin: 5px 0;
        }
        .signature-name {
            font-weight: bold;
            font-size: 11pt;
        }
        .signature-dni {
            font-size: 10pt;
        }
        .note {
            position: absolute;
            bottom: 0;
            left: 20px;
            font-size: 8.5pt;
            font-weight: bold;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="certificate-container">
        <div class="header-container">
            <div class="logo-box">
                <img src="{{LOGO_EFI_PATH}}" class="logo-efi" alt="Logo EFI">
            </div>
            <div class="center-box">
                <div class="fondo-info">{{FONDO_NOMBRE}}</div>
                <div class="ruc-info">RUC {{FONDO_RUC}}</div>
                <div class="cert-title">CERTIFICADO DE PARTICIPACIÓN N° {{CERTIFICADO_NUM}}</div>
            </div>
            <div class="side-spacer"></div>
        </div>

        <div class="content-text">
            <span class="placeholder">INANDES ACTIVOS ALTERNATIVOS S.A.C.</span>, sociedad administradora del <span class="placeholder">{{FONDO_NOMBRE}}</span>, certifica que <span class="placeholder">{{TITULARES_TEXT}}</span>, identificados(as) apropiadamente, mantiene(n) en la cuenta del <span class="placeholder">{{FONDO_NOMBRE}}</span>, la suma de <span class="placeholder">{{MONEDA_ISO}} {{MONTO_NUM}}</span> (<span class="placeholder">{{MONTO_LETRAS}}</span>), para la suscripción de <span class="placeholder">{{CUOTAS_NUM}}</span> cuotas de participación, de acuerdo a lo estipulado por el reglamento del <span class="placeholder">{{FONDO_NOMBRE}}</span>.
        </div>

        <div class="footer">
            <div class="place-date">Lima, {{FECHA_CERTIFICADO_LARGA}}</div>

            <div class="signature-block">
                <img src="{{FIRMA_PATH}}" class="signature-img" alt="Firma Ricardo Gallo">
                <div class="signature-line"></div>
                <div class="signature-name">J. Ricardo Gallo Pizarro</div>
                <div class="signature-dni">DNI 02816271</div>
            </div>
        </div>

        <div class="note">
            NOTA: EL PRESENTE CERTIFICADO ANULA CUALQUIER OTRO QUE PUDIERA HABER SIDO ENTREGADO EN FECHA ANTERIOR
        </div>
    </div>
</body>
</html>`;
