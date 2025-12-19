/**
 * ============================================================================
 * 💰 SEGUIDOR DE GASTOS - GOOGLE APPS SCRIPT
 * ============================================================================
 * 
 * Este script automatiza la extracción de gastos desde correos de notificación
 * bancaria en Gmail y los organiza en una Google Sheet.
 * 
 * ¿CÓMO FUNCIONA?
 * 1. Busca correos específicos en Gmail usando comandos de búsqueda.
 * 2. Extrae la información clave (Monto, Comercio, Fecha) usando Expresiones Regulares (Regex).
 * 3. Categoriza automáticamente el gasto según reglas definidas por el usuario.
 * 4. Guarda todo en una hoja de cálculo y genera reportes.
 */

// --- CONFIGURACIÓN PRINCIPAL ---
// Centralizamos las variables cambiantes aquí para no tocar el código profundo.
const CONFIG = {
    // Filtro de búsqueda de Gmail. 
    // "from:" limita el remitente, "subject:" el asunto, y "after:" la fecha de inicio.
    SEARCH_QUERY: 'from:enviodigital@bancochile.cl subject:"Compra con Tarjeta de Crédito" after:2025-01-01',
    
    // Nombres de las hojas en Google Sheets
    SHEET_NAME: 'Gastos',            // Aquí se guardan los datos procesados
    CONFIG_SHEET_NAME: 'Configuracion', // Aquí se guardan las reglas de categorías
    
    // Encabezados de las columnas. El script los escribirá si la hoja es nueva.
    HEADERS: ['Fecha', 'Comercio', 'Monto', 'Categoría', 'Medio Pago', 'ID Mensaje', 'Texto Original']
};

/**
 * ⚙️ CONFIGURACIÓN DEL MENÚ
 * Se ejecuta automáticamente cuando abres la hoja de cálculo.
 * Crea un menú personalizado en la barra superior.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('💰 Seguidor Gastos')
        .addItem('📥 Traer Gastos de Gmail', 'procesarGastos') // Botón principal
        .addSeparator()
        .addItem('📊 Actualizar Dashboard', 'crearDashboard')   // Genera gráficos
        .addItem('🤖 Generar Análisis IA', 'generarResumenParaIA') // Ayuda para prompts
        .addSeparator()
        .addItem('🔄 Recategorizar Todo', 'recategorizarHistorico') // Mantenimiento
        .addToUi();
}

/**
 * 🚀 FUNCIÓN PRINCIPAL: PROCESAR GASTOS
 * Esta es la función que orquesta todo el trabajo sucio.
 */
function procesarGastos() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Preparación de hojas
    let sheet = getOrCreateSheet(spreadsheet, CONFIG.SHEET_NAME);
    ensureConfigSheet(spreadsheet); // Nos aseguramos que exista la config
    
    // 2. Obtener historial para no duplicar
    // Leemos los IDs de mensaje ya guardados para ignorarlos si vuelven a aparecer.
    const processedIds = getProcessedMessageIds(sheet);
    
    // 3. Obtener reglas de categorización vigentes
    const rules = getCategorizationRules(spreadsheet);

    // 4. Buscar correos en Gmail
    // GmailApp.search funciona igual que la barra de búsqueda de Gmail.
    const threads = GmailApp.search(CONFIG.SEARCH_QUERY);
    const newRows = [];
    
    console.log(`🔍 Hilos encontrados: ${threads.length}`);

    // 5. Iterar sobre cada hilo y mensaje
    threads.forEach(thread => {
        const messages = thread.getMessages();
        messages.forEach(message => {
            const msgId = message.getId();

            // Si ya procesamos este ID, lo saltamos inmediatamente. Eficiencia pura.
            if (processedIds.has(msgId)) return;

            // Extraemos info del cuerpo del correo
            const body = message.getPlainBody();
            const extractedData = extractDataFromEmail(body);

            if (extractedData) {
                // Si logramos extraer datos, intentamos categorizarlos
                const category = categorizeMerchant(extractedData.merchant, rules);

                // Preparamos la fila tal como la espera la hoja de cálculo
                newRows.push([
                    extractedData.date,
                    extractedData.merchant,
                    extractedData.amount,
                    category, // Categoría automática (o vacía si no hay regla)
                    extractedData.paymentMethod,
                    msgId,
                    extractedData.originalText // Guardamos esto para depurar si el regex falló sutilmente
                ]);
            }
        });
    });

    // 6. Guardar en lote (Batch Write)
    // Escribir en la hoja es lento. Es mejor acumular todo en 'newRows' y escribir una sola vez.
    if (newRows.length > 0) {
        const lastRow = sheet.getLastRow();
        // getRange(filaInicio, colInicio, numFilas, numCols)
        sheet.getRange(lastRow + 1, 1, newRows.length, CONFIG.HEADERS.length).setValues(newRows);
        console.log(`✅ Se agregaron ${newRows.length} nuevos gastos.`);
    } else {
        console.log("✅ No se encontraron nuevos gastos para procesar.");
    }
}

// ============================================================================
// 🧠 LÓGICA DE EXTRACCIÓN (REGEX)
// ============================================================================

/**
 * Analiza el texto del correo para encontrar precios, fechas y nombres.
 * Utiliza Expresiones Regulares (Regex) para ser flexible ante variantes.
 * @param {string} body - El contenido texto plano del correo.
 * @return {Object|null} - Objeto con datos o null si no encuentra nada.
 */
function extractDataFromEmail(body) {
    // Regex desglosado:
    // 1. "compra por $" -> ancla de inicio
    // 2. ([\d.]+) -> Captura el monto (dígitos y puntos). Grupo 1.
    // 3. "con Tarjeta... ****" -> Texto intermedio
    // 4. (\d{4}) -> Captura últimos 4 dígitos tarjeta. Grupo 2.
    // 5. "en" ... ([\s\S]+?) ... "el" -> Captura el comercio de forma no agresiva. Grupo 3.
    // 6. Fechas y horas al final. Grupos 4 y 5.
    const regex = /compra\s+por\s+\$([\d.]+)\s+con\s+Tarjeta\s+de\s+Crédito\s+\*\*\*\*(\d{4})\s+en\s+([\s\S]+?)\s+el\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/i;
    
    const match = body.match(regex);

    if (!match) return null; // Si no calza el patrón, no es un correo válido.

    // Extraemos los grupos capturados
    const rawAmount = match[1];
    const cardLast4 = match[2];
    const merchant = match[3].trim().replace(/\n/g, ' '); // Limpiamos saltos de línea del nombre
    const dateStr = match[4];
    const timeStr = match[5];

    // Convertimos "19.990" (string) a 19990 (número) para poder sumar después
    const amount = parseFloat(rawAmount.replace(/\./g, ''));

    return {
        date: `${dateStr} ${timeStr}`,
        merchant: merchant,
        amount: amount,
        paymentMethod: `Tarjeta ****${cardLast4}`,
        originalText: match[0]
    };
}

// ============================================================================
// 🏷️ CATEGORIZACIÓN
// ============================================================================

/**
 * Asigna una categoría basándose en palabras clave.
 * @param {string} merchantName - El nombre del comercio (ej: "UBER EATS HELADOS").
 * @param {Array} rules - Lista de reglas [{keyword: 'uber', category: 'Transporte'}].
 */
function categorizeMerchant(merchantName, rules) {
    if (!merchantName) return "";
    const lowerMerchant = merchantName.toLowerCase();
    
    for (const rule of rules) {
        // Simplemente chequeamos si la palabra clave está dentro del nombre del comercio
        if (lowerMerchant.includes(rule.keyword)) {
            return rule.category;
        }
    }
    return ""; // Si no hay coincidencias, devolvemos vacío para llenar manual después.
}

/**
 * Lee las reglas definidas por el usuario en la hoja "Configuracion".
 * Ordena las reglas por longitud para que las más específicas tengan prioridad 
 * (Ej: "Uber Eats" antes que "Uber").
 */
function getCategorizationRules(spreadsheet) {
    const sheet = spreadsheet.getSheetByName(CONFIG.CONFIG_SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) return [];

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    
    return data
        .filter(row => row[0] && row[1]) // Filtrar filas vacías
        .map(row => ({
            keyword: row[0].toString().toLowerCase(),
            category: row[1].toString()
        }))
        .sort((a, b) => b.keyword.length - a.keyword.length); // Ordenar por especificidad
}

// ============================================================================
// 📊 DASHBOARD Y GRÁFICOS
// ============================================================================

/**
 * Genera un Dashboard usando QUERY (lenguaje estilo SQL de Google Sheets)
 * y gráficos nativos. Es destructiva: borra el dashboard anterior y lo hace de nuevo.
 */
function crearDashboard() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Limpieza de hojas antiguas
    const oldSummary = spreadsheet.getSheetByName("Resumen Mensual");
    if (oldSummary) spreadsheet.deleteSheet(oldSummary);
    
    let sheet = spreadsheet.getSheetByName("Dashboard");
    if (sheet) spreadsheet.deleteSheet(sheet);
    
    // Crear hoja nueva al principio (posición 0)
    sheet = spreadsheet.insertSheet("Dashboard", 0);

    // Título
    sheet.getRange("A1").setValue("Tablero de Control Financiero").setFontSize(16).setFontWeight("bold");
    sheet.getRange("A2").setValue("Vista de Evolución Mensual");

    // --- TABLA DINÁMICA CON FORMULA QUERY ---
    // Usamos QUERY porque es potente y dinámico.
    // Agrupa por Año y Mes, pivota por Categoría, y suma los Costos (Columna C).
    const queryCell = sheet.getRange("A5");
    const formula = `=QUERY(Gastos!A:E; "SELECT YEAR(A), MONTH(A)+1, SUM(C) WHERE D <> '' GROUP BY YEAR(A), MONTH(A)+1 PIVOT D LABEL YEAR(A) 'Año', MONTH(A)+1 'Mes'"; 1)`;
    queryCell.setFormula(formula);

    // Formateo visual de la tabla generada
    sheet.getRange("C5:Z100").setNumberFormat("$#,##0"); // Formato Dinero
    sheet.getRange("A5:B100").setHorizontalAlignment("center"); // Centrar Fechas

    // --- GRÁFICO ---
    const chart = sheet.newChart()
        .asColumnChart()
        .setStacked()
        .addRange(sheet.getRange("A5:H15")) // Rango estimado
        .setTitle("Evolución de Gastos por Categoría")
        .setPosition(5, 5, 0, 0) // Posición visual
        .build();
    sheet.insertChart(chart);

    // --- TOP GASTOS ---
    sheet.getRange("A25").setValue("Top 5 Gastos Históricos").setFontWeight("bold");
    sheet.getRange("A26").setFormula(`=QUERY(Gastos!A:E; "SELECT A, B, D, C ORDER BY C DESC LIMIT 5 LABEL A 'Fecha', B 'Comercio', D 'Categoría', C 'Monto'"; 1)`);
    
    // Ajuste formatos para Top Gastos
    sheet.getRange("A27:A35").setNumberFormat("dd/MM/yyyy");
    sheet.getRange("D27:D35").setNumberFormat("$#,##0");
}

/**
 * Genera un prompt estructurado para copiar y pegar en una IA (ChatGPT/Gemini).
 * Analiza porcentajes de gasto y pide consejos.
 */
function generarResumenParaIA() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) return;

    // Obtenemos solo datos relevantes (Col 0 a 3: Fecha, Comercio, Monto, Categoria)
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

    // Sumarización en memoria
    const resumen = {};
    let grandTotal = 0;

    data.forEach(row => {
        const monto = parseFloat(row[2]) || 0; // Columna 2 es Monto
        const cat = row[3] || "Sin Categoría"; // Columna 3 es Categoría
        if (!resumen[cat]) resumen[cat] = 0;
        resumen[cat] += monto;
        grandTotal += monto;
    });

    // Construcción del Prompt
    let prompt = "Actúa como mi asesor financiero personal. Aquí está el desglose de mis gastos recientes:\n\n";
    prompt += `Gasto Total: $${grandTotal.toLocaleString('es-CL')}\n\n`;
    
    // Ordenamos categorías por mayor gasto
    Object.keys(resumen)
        .sort((a, b) => resumen[b] - resumen[a])
        .forEach(cat => {
            const monto = resumen[cat];
            const pct = ((monto / grandTotal) * 100).toFixed(1);
            prompt += `- ${cat}: $${monto.toLocaleString('es-CL')} (${pct}%)\n`;
        });

    prompt += "\nPor favor responde:\n1. ¿Cuál es la anomalía más grande en mi presupuesto?\n2. Dame 3 consejos concretos para reducir la categoría principal.\n3. ¿Mi distribución de gastos parece saludable?";

    // Mostrar al usuario
    console.log("📝 --- COPIA ESTE PROMPT PARA TU IA ---");
    console.log(prompt);
    console.log("📝 ------------------------------------");
    
    try {
        SpreadsheetApp.getUi().alert("Prompt generado en Registros (Logs). Copialo desde Ver -> Ejecuciones.");
    } catch (e) { /* Sin UI disponible */ }
}

// ============================================================================
// 🛠️ HERRAMIENTAS Y UTILIDADES (HELPERS)
// ============================================================================

/**
 * Función helper para obtener los IDs ya procesados.
 * Esto evita duplicados y hace el script idempotente.
 */
function getProcessedMessageIds(sheet) {
    const lastRow = sheet.getLastRow();
    // Asumimos que ID Mensaje es la columna 6 (índice 5 en getRange, pero la fila 5 en array... espera)
    // HEADERS: [..., 'ID Mensaje' (index 5)] -> Columna F (6)
    if (lastRow <= 1) return new Set();
    
    // getRange(fila, col). Column 6 = F.
    const data = sheet.getRange(2, 6, lastRow - 1, 1).getValues(); 
    return new Set(data.map(r => r[0].toString()));
}

/**
 * Asegura que exista la hoja con encabezados correctos.
 */
function getOrCreateSheet(spreadsheet, name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
        sheet = spreadsheet.insertSheet(name);
        sheet.appendRow(CONFIG.HEADERS);
        sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight("bold");
    }
    return sheet;
}

/**
 * Crea la hoja de configuración por defecto si no existe.
 */
function ensureConfigSheet(spreadsheet) {
    if (!spreadsheet.getSheetByName(CONFIG.CONFIG_SHEET_NAME)) {
        const sheet = spreadsheet.insertSheet(CONFIG.CONFIG_SHEET_NAME);
        sheet.appendRow(["Palabra Clave", "Categoría"]); // Headers
        sheet.getRange("A1:B1").setFontWeight("bold");
        
        // Datos seed (semilla)
        sheet.getRange(2, 1, 5, 2).setValues([
            ["Uber", "Transporte"],
            ["Jumbo", "Supermercado"],
            ["Netflix", "Suscripciones"],
            ["Paris", "Tiendas"],
            ["Starbucks", "Café"]
        ]);
    }
}

/**
 * Mantenimiento: Vuelve a pasar reglas a todo el historial.
 * Útil cuando agregas nuevas reglas y quieres aplicarlas "hacia atrás".
 */
function recategorizarHistorico() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) return;
    
    const rules = getCategorizationRules(SpreadsheetApp.getActiveSpreadsheet());
    const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, CONFIG.HEADERS.length);
    const data = dataRange.getValues();
    
    let changes = 0;
    data.forEach(row => {
        // Index 1: Comercio, Index 3: Categoría
        if (row[3] === "") { // Solo rellenar si está vacío
            const cat = categorizeMerchant(row[1], rules);
            if (cat) {
                row[3] = cat;
                changes++;
            }
        }
    });

    if (changes > 0) {
        dataRange.setValues(data);
        console.log(`✅ Recategorización terminada. ${changes} filas actualizadas.`);
    } else {
        console.log("No se requirieron cambios.");
    }
}

// ============================================================================
// 🧪 ZONA DE PRUEBAS Y DEBUG
// Uso exclusivo para desarrollo. No se usa en producción automática.
// ============================================================================

/**
 * Ejecuta esto para ver en consola cómo ve el script los últimos 3 correos reales.
 */
function debugEmails() {
    const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, 3);
    if (threads.length === 0) return console.log("No se encontraron correos.");
    
    console.log("--- DEBUG CORREO REAL ---");
    const body = threads[0].getMessages()[0].getPlainBody();
    console.log(body.substring(0, 500) + "..."); // Solo primeros 500 chars
    console.log("--- EXTRACCIÓN ---");
    console.log(extractDataFromEmail(body));
}

/**
 * Prueba local del Regex con ejemplos estáticos.
 */
function testRegex() {
    const testCases = [
        `Te informamos que se ha realizado una compra por $10.605 con Tarjeta de Crédito ****0990 en PAYU *UBER TRIP SANTIAGO CL el 13/12/2025 17:52.`
    ];
    
    testCases.forEach(t => console.log(extractDataFromEmail(t)));
}
