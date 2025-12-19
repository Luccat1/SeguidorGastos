/**
 * Configuración del Script
 */
const CONFIG = {
    // CAMBIO: Buscamos desde principio de año para el análisis anual real
    SEARCH_QUERY: 'from:enviodigital@bancochile.cl subject:"Compra con Tarjeta de Crédito" after:2025-01-01',
    SHEET_NAME: 'Gastos', // Nombre de la hoja donde se guardarán los datos
    CONFIG_SHEET_NAME: 'Configuracion', // Nueva hoja para reglas
    HEADERS: ['Fecha', 'Comercio', 'Monto', 'Categoría', 'Medio Pago', 'ID Mensaje', 'Texto Original']
};

/**
 * Trigger que se ejecuta al abrir la hoja de cálculo.
 * Crea un menú personalizado para usar las funciones fácilmente.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('💰 Seguidor Gastos')
        .addItem('📥 Traer Gastos de Gmail', 'procesarGastos')
        .addSeparator()
        .addItem('📊 Actualizar Dashboard', 'crearDashboard')
        .addItem('🤖 Generar Análisis IA', 'generarResumenParaIA')
        .addSeparator()
        .addItem('🔄 Recategorizar Todo', 'recategorizarHistorico')
        .addToUi();
}

/**
 * Función Principal: Busca correos y los procesa
 */
function procesarGastos() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

    // Crear hoja de Gastos si no existe
    if (!sheet) {
        sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
        sheet.appendRow(CONFIG.HEADERS);
        // Negrita a los encabezados
        sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold");
    }

    // Asegurar que exista la hoja de Configuración
    ensureConfigSheet(spreadsheet);

    // Obtener reglas de categorización
    const rules = getCategorizationRules(spreadsheet);

    // Obtener IDs ya procesados para evitar duplicados
    // Asumimos que el ID Mensaje está en la columna 6 (índice 5 comenzando de 0, pero getRange usa 1-index)
    const lastRow = sheet.getLastRow();
    let processedIds = textToSet([]);

    if (lastRow > 1) {
        const idColumnValues = sheet.getRange(2, 6, lastRow - 1, 1).getValues();
        processedIds = textToSet(idColumnValues);
    }

    // Buscar hilos de correo
    const threads = GmailApp.search(CONFIG.SEARCH_QUERY);
    const newRows = [];

    console.log(`Encontrados ${threads.length} hilos correspondientes a la búsqueda.`);

    threads.forEach(thread => {
        const messages = thread.getMessages();
        messages.forEach(message => {
            const msgId = message.getId();

            // Si ya procesamos este ID, lo saltamos
            if (processedIds.has(msgId)) {
                return;
            }

            const body = message.getPlainBody();
            const extractedData = extractDataFromEmail(body);

            if (extractedData) {
                // AUTO-CATEGORIZACIÓN
                const category = categorizeMerchant(extractedData.merchant, rules);

                // Preparar fila: ['Fecha', 'Comercio', 'Monto', 'Categoría', 'Medio Pago', 'ID Mensaje', 'Texto Original']
                newRows.push([
                    extractedData.date,
                    extractedData.merchant,
                    extractedData.amount,
                    category, // Categoría automática o vacía
                    extractedData.paymentMethod,
                    msgId,
                    extractedData.originalText // Opcional, para debug
                ]);
            }
        });
    });

    // Escribir nuevos datos en lote
    if (newRows.length > 0) {
        sheet.getRange(lastRow + 1, 1, newRows.length, CONFIG.HEADERS.length).setValues(newRows);
        console.log(`Se agregaron ${newRows.length} nuevos gastos.`);
    } else {
        console.log("No se encontraron nuevos gastos.");
    }
}

/**
 * Crea la hoja de configuración si no existe y añade ejemplos
 */
function ensureConfigSheet(spreadsheet) {
    let sheet = spreadsheet.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
    if (!sheet) {
        sheet = spreadsheet.insertSheet(CONFIG.CONFIG_SHEET_NAME);
        sheet.appendRow(["Palabra Clave", "Categoría"]);
        sheet.getRange(1, 1, 1, 2).setFontWeight("bold");

        // Añadir ejemplos por defecto
        const examples = [
            ["Uber Trip", "Transporte"],
            ["Uber Eats", "Comida"],
            ["Paris", "Tiendas"],
            ["Jumbo", "Supermercado"],
            ["Unimarc", "Supermercado"],
            ["Netflix", "Suscripciones"],
            ["TUU*CAFETERIAS", "Alimentacion"]
        ];
        sheet.getRange(2, 1, examples.length, 2).setValues(examples);
        console.log("Se creó la hoja de Configuración con ejemplos.");
    }
}

/**
 * Lee las reglas de la hoja Configuración
 * Retorna un array de objetos: [{keyword: 'uber', category: 'Transporte'}, ...]
 */
function getCategorizationRules(spreadsheet) {
    const sheet = spreadsheet.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    // Filtramos filas vacías y convertimos a minúsculas la keyword para buscar fácil
    const rules = data
        .filter(row => row[0] && row[1])
        .map(row => ({
            keyword: row[0].toString().toLowerCase(),
            category: row[1].toString()
        }));

    // ORDENAR POR LARGO DE KEYWORD (Descendente)
    // Esto asegura que "Uber Eats" se revise antes que "Uber", evitando falsos positivos.
    return rules.sort((a, b) => b.keyword.length - a.keyword.length);
}

/**
 * Busca coincidencia de keyword en el nombre del comercio
 */
function categorizeMerchant(merchantName, rules) {
    const lowerMerchant = merchantName.toLowerCase();
    for (const rule of rules) {
        if (lowerMerchant.includes(rule.keyword)) {
            return rule.category;
        }
    }
    return ""; // Sin categoría
}

/**
 * HERRAMIENTA EXTERNA: Recategorizar todo el historial
 * Ejecuta esto si cambiaste las reglas y quieres actualizar los gastos viejos.
 */
function recategorizarHistorico() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    ensureConfigSheet(spreadsheet); // Por si acaso
    const rules = getCategorizationRules(spreadsheet);

    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
        console.log("No hay datos para recategorizar.");
        return;
    }

    // Leemos Comercios (Col B -> index 2) y Categorías (Col D -> index 4)
    // GetRange usa indices base 1.
    // Columna 2 es B. Columna 4 es D.
    const range = sheet.getRange(2, 1, lastRow - 1, CONFIG.HEADERS.length);
    const data = range.getValues();
    let updatesCount = 0;

    // Índices en el array (base 0): Mercante están en index 1, Categoría en index 3
    // Ver HEADERS: ['Fecha', 'Comercio', 'Monto', 'Categoría', ...]
    const IDX_MERCHANT = 1;
    const IDX_CATEGORY = 3;

    const newData = data.map(row => {
        const merchant = row[IDX_MERCHANT];
        const currentCat = row[IDX_CATEGORY];

        // Solo categorizar si está vacío (Opcional: quitar condición para forzar overwrite)
        if (currentCat === "") {
            const newCat = categorizeMerchant(merchant, rules);
            if (newCat) {
                row[IDX_CATEGORY] = newCat;
                updatesCount++;
            }
        }
        return row;
    });

    if (updatesCount > 0) {
        range.setValues(newData);
        console.log(`Se actualizaron ${updatesCount} filas con nuevas categorías.`);
    } else {
        console.log("No se encontraron filas pendientes de categorización.");
    }
}

/**
 * Crea o actualiza la hoja de Dashboard con Análisis Mensual y Anual
 */
function crearDashboard() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName("Dashboard");

    // Si existe la versión antigua o esta misma, la borramos para recrear limpia
    const oldSheet = spreadsheet.getSheetByName("Resumen Mensual");
    if (oldSheet) spreadsheet.deleteSheet(oldSheet);

    if (spreadsheet.getSheetByName("Dashboard")) {
        spreadsheet.deleteSheet(spreadsheet.getSheetByName("Dashboard"));
    }

    sheet = spreadsheet.insertSheet("Dashboard", 0);

    // --- SECCIÓN 1: CABECERA ---
    sheet.getRange("A1").setValue("Tablero de Control Financiero").setFontSize(16).setFontWeight("bold");
    sheet.getRange("A2").setValue("Vista de Evolución Mensual");

    // --- SECCIÓN 2: MATRIZ DE EVOLUCIÓN (Pivot Table via Query) ---
    // Filas: Año, Mes. Columnas: Categorías. Valores: Suma(Monto)
    // Query trick: "label month(A)+1 'Mes', year(A) 'Año'" para que sea legible
    const queryCell = sheet.getRange("A5");
    // Nota: Usamos Columna+1 para mes porque QUERY devuelve index 0-11
    const formula = `=QUERY(Gastos!A:E; "SELECT YEAR(A), MONTH(A)+1, SUM(C) WHERE D <> '' GROUP BY YEAR(A), MONTH(A)+1 PIVOT D LABEL YEAR(A) 'Año', MONTH(A)+1 'Mes'"; 1)`;
    queryCell.setFormula(formula);

    // FIXME: Formatting Bug Fix
    // 1. Formato Moneda SOLO a los valores (Columna C en adelante aprox)
    sheet.getRange("C5:Z100").setNumberFormat("$#,##0");

    // 2. Formato Texto/Numero a Año y Mes (Columna A y B) para evitar "$2.025"
    sheet.getRange("A5:B100").setNumberFormat("0");
    sheet.getRange("A5:B100").setHorizontalAlignment("center");

    // --- SECCIÓN 3: GRÁFICOS ---

    // 3.1 Gráfico de Barras Apiladas (Evolución)
    // Intentamos detectar el rango dinámicamente. Asumimos max 12 meses visualizables y 6 categorías.
    const chartEvolution = sheet.newChart()
        .asColumnChart()
        .setStacked()
        .addRange(sheet.getRange("A5:H18")) // Rango aproximado, incluye Año/Mes + Categorías
        .setTitle("Evolución de Gastos por Categoría")
        .setPosition(5, 5, 0, 0) // Posición a la derecha de la tabla (Fila 5, Col E aprox)
        .build();

    sheet.insertChart(chartEvolution);

    // --- SECCIÓN 4: TOP GASTOS ---
    sheet.getRange("A25").setValue("Top 5 Gastos Históricos").setFontWeight("bold");
    sheet.getRange("A26").setFormula(`=QUERY(Gastos!A:E; "SELECT A, B, D, C ORDER BY C DESC LIMIT 5 LABEL A 'Fecha', B 'Comercio', D 'Categoría', C 'Monto'"; 1)`);

    // Format Fecha (Col A) in Top 5 section
    sheet.getRange("A27:A35").setNumberFormat("dd/MM/yyyy");
    sheet.getRange("D27:D35").setNumberFormat("$#,##0");

    console.log("Dashboard avanzado creado exitosamente.");
}

/**
 * Genera un resumen de texto para pegar en Gemini/ChatGPT
 */
function generarResumenParaIA() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet || sheet.getLastRow() <= 1) {
        console.log("No hay datos para analizar.");
        return;
    }

    // Obtener datos (Fecha, Comercio, Monto, Categoría)
    // HEADERS: ['Fecha', 'Comercio', 'Monto', 'Categoría', ...]
    // Indices (base 0): 0, 1, 2, 3
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

    // Agrupar por Categoría
    const resumen = {};
    let total = 0;

    data.forEach(row => {
        const monto = parseFloat(row[2]) || 0;
        const cat = row[3] || "Sin Categoría";

        if (!resumen[cat]) resumen[cat] = 0;
        resumen[cat] += monto;
        total += monto;
    });

    // Formatear texto
    let texto = "Actúa como mi asistentente financiero. Analiza mis gastos de este periodo:\n\n";
    texto += `Gasto Total: $${total.toLocaleString('es-CL')}\n\n`;
    texto += "Desglose por Categoría:\n";

    // Ordenar por monto
    const categoriasOrdenadas = Object.keys(resumen).sort((a, b) => resumen[b] - resumen[a]);

    categoriasOrdenadas.forEach(cat => {
        const monto = resumen[cat];
        const porcentaje = ((monto / total) * 100).toFixed(1);
        texto += `- ${cat}: $${monto.toLocaleString('es-CL')} (${porcentaje}%)\n`;
    });

    texto += "\nPor favor dime:\n1. ¿Dónde se va la mayor parte de mi presupuesto?\n2. ¿Qué categoría te parece inusualmente alta?\n3. Consejos para reducir gastos en la categoría principal.";

    console.log("--- COPIA EL SIGUIENTE TEXTO ---");
    console.log(texto);
    console.log("--------------------------------");

    // Intento de mostrar en alerta (si se ejecuta desde el botón en la hoja, no desde editor)
    try {
        SpreadsheetApp.getUi().alert("Copia este texto del log (Ver -> Registros):", texto, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
        // Si corre desde el editor, no hay UI, solo log.
    }
}
function extractDataFromEmail(body) {
    // Regex más flexible:
    // 1. \s+ en lugar de espacios para aceptar saltos de línea.
    // 2. ([\s\S]+?) para el comercio por si tiene saltos de línea.
    const regex = /compra\s+por\s+\$([\d.]+)\s+con\s+Tarjeta\s+de\s+Crédito\s+\*\*\*\*(\d{4})\s+en\s+([\s\S]+?)\s+el\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/i;
    const match = body.match(regex);

    if (!match) {
        // Debug: Descomenta la siguiente línea si quieres ver por qué falla en los logs
        // console.log("Falló regex en cuerpo: " + body.substring(0, 100) + "...");
        return null;
    }

    const rawAmount = match[1];
    const cardLast4 = match[2];
    const merchant = match[3].trim().replace(/\n/g, ' '); // Limpiar saltos de línea del nombre
    const dateStr = match[4];
    const timeStr = match[5];

    const amount = parseFloat(rawAmount.replace(/\./g, ''));

    return {
        date: `${dateStr} ${timeStr}`,
        merchant: merchant,
        amount: amount,
        paymentMethod: `Tarjeta ****${cardLast4}`,
        originalText: match[0]
    };
}

/**
 * FUNCIÓN DE DIAGNÓSTICO
 * Ejecuta esta función si 'procesarGastos' dice que no encuentra nada.
 * Te mostrará en los registros exactamente cómo Apps Script "ve" el correo.
 */
function debugEmails() {
    const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 3); // Solo primeros 3 hilos
    console.log(`Debug: Encontrados ${threads.length} hilos.`);

    if (threads.length === 0) {
        console.log("No se encontraron correos con ese criterio.");
        return;
    }

    const messages = threads[0].getMessages();
    const body = messages[0].getPlainBody();

    console.log("--- INICIO CUERPO ---");
    console.log(body);
    console.log("--- FIN CUERPO ---");

    const extract = extractDataFromEmail(body);
    console.log("Intento de extracción:", extract);
}

/**
 * Helper: Convierte array de arrays a Set para búsqueda rápida
 */
function textToSet(values) {
    const set = new Set();
    values.forEach(row => {
        if (row[0]) set.add(row[0].toString());
    });
    return set;
}

/**
 * FUNCIÓN DE PRUEBA
 * Ejecuta esto para verificar que el regex funciona con tus ejemplos
 */
function testRegex() {
    const examples = [
        `Luciano Andre Cataldo Alvarado:
Te informamos que se ha realizado una compra por $19.790 con Tarjeta de Crédito ****0990 en PARIS VINA DEL MAR VINA DEL MAR CL el 13/12/2025 17:01.
Revisa Saldos y Movimientos en App Mi Banco o Banco en Línea.`,

        `Te informamos que se ha realizado una compra por $10.605 con Tarjeta de Crédito ****0990 en PAYU *UBER TRIP SANTIAGO CL el 13/12/2025 17:52.`,

        `Te informamos que se ha realizado una compra por $20.531 con Tarjeta de Crédito ****0990 en PAYU *UBER TRIP SANTIAGO CL el 13/12/2025 20:07.`
    ];

    console.log("Iniciando pruebas de Regex...");

    examples.forEach((example, index) => {
        const result = extractDataFromEmail(example);
        console.log(`Ejemplo ${index + 1}:`);
        if (result) {
            console.log(`  - Comercio: ${result.merchant}`);
            console.log(`  - Monto: ${result.amount}`);
            console.log(`  - Fecha: ${result.date}`);
        } else {
            console.error("  - NO SE ENCONTRÓ COINCIDENCIA");
        }
    });
}
