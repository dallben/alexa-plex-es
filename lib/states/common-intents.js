/**
 * Tells the user about new functionality in this app
 * @param request
 * @param response
 */
var whatsNewIntent = function(request, response) {
    response.say("¡En este momento, todo es nuevo! Consulta la aplicación de Alexa para obtener una descripción detallada de lo que puedes hacer con esta skill.");
};

module.exports = {
    whatsNewIntent: whatsNewIntent
};
