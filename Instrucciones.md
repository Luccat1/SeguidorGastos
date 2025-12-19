# Instrucciones de Instalación

1. Abre tu Google Sheet de Gastos.
2. Ve a **Extensiones** > **Apps Script**.
3. Reemplaza todo el código existente con el contenido actualizado de `Code.js`.
4. Guarda el proyecto.
5. **IMPORTANTE**: Recarga la pestaña de tu Google Sheet (F5 o Cmd+R).

## ¡Nuevo Menú

Al recargar la hoja, verás un nuevo menú en la barra superior llamado **"💰 Seguidor Gastos"**.
Desde ahí puedes ejecutar todo con un clic:

* **📥 Traer Gastos de Gmail**: Busca correos nuevos y los añade.
* **📊 Actualizar Dashboard**: Crea/Actualiza gráficos.
* **🤖 Generar Análisis IA**: Copia el resumen para Gemini.
* **🔄 Recategorizar Todo**: Aplica tus reglas a gastos antiguos.

## Configuración Inicial (Solo si es nuevo)

1. Usa "Traer Gastos de Gmail" para empezar.
2. Si faltan categorías, se creará la hoja "Configuracion". Edítala.
3. Usa "Recategorizar Todo" si cambias reglas.

## Automatización (Triggers)

*El menú es para uso manual, pero la descarga de correos seguirá siendo automática cada hora si configuraste el Trigger.*
