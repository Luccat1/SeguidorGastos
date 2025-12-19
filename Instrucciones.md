# 💰 Seguidor de Gastos Automático

Bienvenido a tu sistema de control de gastos. Este proyecto conecta tu Gmail con Google Sheets para registrar automáticamente tus compras con tarjeta de crédito.

## 🚀 Instalación Rápida

1.  **Abre tu Hoja de Cálculo**: Donde quieres tener tus gastos.
2.  **Abre el Editor**: Ve al menú `Extensiones` > `Apps Script`.
3.  **Copia el Código**: Pega todo el contenido de `Code.js` en el archivo principal del editor, reemplazando lo que haya.
4.  **Guarda**: Presiona el icono de disquete 💾 o `Ctrl+S`.
5.  **Recarga**: Vuelve a la pestaña de tu Google Sheet y recarga la página (F5).

> Verás aparecer un nuevo menú llamado **"💰 Seguidor Gastos"** en la barra superior pasados unos segundos.

## 📖 Uso del Menú

El sistema está diseñado para ser manual o automático, pero siempre tienes el control desde el menú:

*   **📥 Traer Gastos de Gmail**: Escanea tu bandeja de entrada buscando correos nuevos del banco y los añade a la hoja.
*   **📊 Actualizar Dashboard**: Borra y regenera la pestaña "Dashboard" con gráficos frescos de tus datos actuales.
*   **🤖 Generar Análisis IA**: Crea un resumen listo para copiar y pegar en ChatGPT/Gemini para que te dé consejos financieros personalizados.
*   **🔄 Recategorizar Todo**: Si añades nuevas reglas en la hoja `Configuracion` (ej: "Uber" = "Transporte"), usa este botón para que reconozca los gastos antiguos.

## ⚙️ Configuración (Categorías)
En la hoja **Configuracion** puedes definir tus propias reglas.
*   **Columna A (Palabra Clave)**: Texto que identifica al comercio (ej: "Netflix").
*   **Columna B (Categoría)**: La categoría a asignar (ej: "Entretenimiento").

El sistema busca la *Palabra Clave* dentro del nombre del comercio del banco.

## ⏰ Automatización (Triggers)

Para que el sistema revise tus correos automáticamente cada hora sin que tengas que presionar nada:

1.  En el editor de Apps Script, haz clic en el icono del **reloj (Activadores)** en la barra lateral izquierda.
2.  Abajo a la derecha, haz clic en el botón azul **"Añadir activador"**.
3.  Configura las opciones así:
    *   **Función a ejecutar**: `procesarGastos`
    *   **Despliegue**: `Head` (Principal)
    *   **Fuente del evento**: `Según tiempo`
    *   **Tipo de activador basado en el tiempo**: `Temporizador por horas`
    *   **Intervalo**: `Cada hora` (o lo que prefieras)
4.  Haz clic en **Guardar**.

¡Listo! Ahora tu hoja se actualizará sola.

---
*Desarrollado con ❤️ y JavaScript.*
